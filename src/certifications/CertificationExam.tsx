import { useState, useEffect, useRef, useCallback } from "react";
import axios from "axios";
import { UseSession } from "../contexts/SessionContext"; // ⚠️ ajustá esta ruta según dónde quede esta carpeta
import { UseTheme } from "../contexts/ThemeContext";     // ⚠️ ídem
import "./certificationExam.css";

// ══════════════════════════════════════════════════════════════════════════════
//  TIPOS — reflejan lo que devuelve certificationRouter.js
// ══════════════════════════════════════════════════════════════════════════════
interface CertQuestion { id: number; moduleId: number; question: string; options: string[]; }
interface CertModule   { id: number; title: string; }
interface ConfettiColors { dark: string[]; light: string[]; }

interface AttemptPayload {
  attemptId: string;
  questions: CertQuestion[];
  modules:   CertModule[];
  expiresAt: string;
  answers:   Record<string, number>;
  flagged:   number[];
  passingScore:               number;
  timeWarningEnabled:         boolean;
  timeWarningPercent:         number;
  timeWarningDurationSeconds: number;
  timeLimitMinutes:           number;
  showConfetti:               boolean;
  confettiColors:             ConfettiColors;
}

interface SubmitResult {
  passed: boolean; score: number; correct: number; total: number;
  passingScore: number; expired: boolean;
  showConfetti: boolean; confettiColors: ConfettiColors;
}

// Las reglas se muestran mapeando este array — agregar una nueva regla es
// sumar un string acá, no hace falta tocar el JSX.
const EXAM_RULES: string[] = [
  "¿Estás seguro/a que deseás canjear tu voucher para rendir esta certificación? Esta acción consume un ticket de tu cuenta.",
  "Una vez que ingreses, el examen comenzará: no podrá pausarse ni continuarse en otro momento.",
  "Vas a disponer de un tiempo límite para completar el examen. Cuando se agote, se enviará automáticamente con las respuestas que hayas cargado hasta ese momento.",
  "Antes de enviar el examen a validación vas a poder revisar las preguntas que hayas marcado con dudas.",
  "Se verificará que no estés usando un segundo monitor ni tengas otras pestañas de este examen abiertas, para garantizar la integridad de la evaluación.",
  "El examen debe rendirse en una computadora de escritorio o notebook (Windows, Linux o macOS) — no está disponible en celulares ni tablets.",
  "Si tu dispositivo cuenta con cámara y/o micrófono, se solicitará permiso para usarlos durante el examen, con el fin de validar que lo estés rindiendo vos y sin ayuda de terceros.",
];

type Phase = "loading" | "mobile_blocked" | "rules" | "device_check" | "permissions" | "ready" | "exam" | "review" | "result";
type CheckStatus = "pending" | "ok" | "fail" | "unknown";

// ── Helpers de detección de dispositivo ─────────────────────────────────────
// No hay forma de detectar OS con certeza total sin navigator.userAgentData
// (poco soportado) — nos apoyamos en UA + puntero para distinguir mobile de
// desktop, que es lo que realmente pide la regla (excluir celulares/tablets).
function isMobileDevice(): boolean {
  const ua = navigator.userAgent || "";
  const uaMobile = /Android|iPhone|iPad|iPod|Mobile|Tablet/i.test(ua);
  const coarsePointer = window.matchMedia?.("(pointer: coarse)").matches ?? false;
  return uaMobile || coarsePointer;
}

// Segundo monitor — Window Management API (solo Chromium reciente). En
// navegadores sin soporte no podemos saberlo: devolvemos "unknown" en vez
// de bloquear por un falso negativo del navegador.
async function checkSecondMonitor(): Promise<CheckStatus> {
  try {
    const anyWindow = window as any;
    if (typeof anyWindow.getScreenDetails === "function") {
      const details = await anyWindow.getScreenDetails();
      return details.screens.length > 1 ? "fail" : "ok";
    }
    if (typeof (window.screen as any).isExtended === "boolean") {
      return (window.screen as any).isExtended ? "fail" : "ok";
    }
    return "unknown";
  } catch {
    return "unknown"; // permiso denegado o API no soportada
  }
}

// Segunda pestaña de ESTE examen — vía BroadcastChannel. Cada pestaña que
// entra a este mismo examen escucha "ping" y responde "pong"; si al mandar
// nuestro propio ping recibimos una respuesta, hay otra pestaña abierta.
function pingForDuplicateTab(channel: BroadcastChannel): Promise<CheckStatus> {
  return new Promise((resolve) => {
    let resolved = false;
    const onMessage = (ev: MessageEvent) => {
      if (ev.data === "pong" && !resolved) {
        resolved = true;
        channel.removeEventListener("message", onMessage);
        resolve("fail");
      }
    };
    channel.addEventListener("message", onMessage);
    channel.postMessage("ping");
    setTimeout(() => {
      if (!resolved) {
        resolved = true;
        channel.removeEventListener("message", onMessage);
        resolve("ok");
      }
    }, 400);
  });
}

function formatDuration(ms: number): string {
  const totalSec = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

// ══════════════════════════════════════════════════════════════════════════════
//  Sub-componente: espectro de audio (canvas + AnalyserNode)
// ══════════════════════════════════════════════════════════════════════════════
function AudioSpectrum({ stream }: { stream: MediaStream }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx2d = canvas.getContext("2d");
    if (!ctx2d) return;

    const audioCtx  = new (window.AudioContext || (window as any).webkitAudioContext)();
    const source    = audioCtx.createMediaStreamSource(stream);
    const analyser  = audioCtx.createAnalyser();
    analyser.fftSize = 64;
    source.connect(analyser);

    const bufferLength = analyser.frequencyBinCount;
    const dataArray     = new Uint8Array(bufferLength);
    let rafId: number;

    const draw = () => {
      rafId = requestAnimationFrame(draw);
      analyser.getByteFrequencyData(dataArray);
      const w = canvas.width, h = canvas.height;
      ctx2d.clearRect(0, 0, w, h);
      const barWidth = w / bufferLength;
      for (let i = 0; i < bufferLength; i++) {
        const barHeight = (dataArray[i] / 255) * h;
        ctx2d.fillStyle = "#ccff00";
        ctx2d.fillRect(i * barWidth, h - barHeight, barWidth - 1, barHeight);
      }
    };
    draw();

    return () => {
      cancelAnimationFrame(rafId);
      source.disconnect();
      audioCtx.close().catch(() => {});
    };
  }, [stream]);

  return (
    <div className="cex-audio-box">
      <canvas ref={canvasRef} width={160} height={48} />
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
//  Sub-componente: confetti (canvas, sin dependencias externas)
// ══════════════════════════════════════════════════════════════════════════════
function ConfettiBurst({ colors }: { colors: string[] }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.width  = window.innerWidth;
    canvas.height = window.innerHeight;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    interface Particle {
      x: number; y: number; vx: number; vy: number;
      size: number; color: string; rotation: number; rotSpeed: number;
    }

    const particles: Particle[] = Array.from({ length: 160 }, () => ({
      x: Math.random() * canvas.width,
      y: -20 - Math.random() * canvas.height * 0.3,
      vx: (Math.random() - 0.5) * 4,
      vy: 2 + Math.random() * 3,
      size: 6 + Math.random() * 6,
      color: colors[Math.floor(Math.random() * colors.length)],
      rotation: Math.random() * 360,
      rotSpeed: (Math.random() - 0.5) * 10,
    }));

    let rafId: number;
    let frame = 0;
    const MAX_FRAMES = 260; // ~4.3s a 60fps

    const draw = () => {
      frame++;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      particles.forEach(p => {
        p.x += p.vx; p.y += p.vy; p.vy += 0.05; p.rotation += p.rotSpeed;
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate((p.rotation * Math.PI) / 180);
        ctx.fillStyle = p.color;
        ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size * 0.6);
        ctx.restore();
      });
      if (frame < MAX_FRAMES) rafId = requestAnimationFrame(draw);
      else ctx.clearRect(0, 0, canvas.width, canvas.height);
    };
    draw();

    return () => cancelAnimationFrame(rafId);
  }, [colors]);

  return <canvas ref={canvasRef} className="cex-confetti-canvas" />;
}

// ══════════════════════════════════════════════════════════════════════════════
//  COMPONENTE PRINCIPAL — motor genérico de examen de certificación
// ══════════════════════════════════════════════════════════════════════════════
export default function CertificationExam({ certId, title }: { certId: string; title: string }) {
  const { user }  = UseSession();
  const { theme } = UseTheme();
  const isLight   = theme === "light";

  const [phase, setPhase] = useState<Phase>("loading");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const [attempt,  setAttempt]  = useState<AttemptPayload | null>(null);

  // ── Checks de dispositivo ──────────────────────────────────────────────
  const [tabCheck,     setTabCheck]     = useState<CheckStatus>("pending");
  const [monitorCheck, setMonitorCheck] = useState<CheckStatus>("pending");
  const broadcastRef = useRef<BroadcastChannel | null>(null);

  // ── Permisos de cámara/micrófono ───────────────────────────────────────
  const [needsCamera, setNeedsCamera] = useState(false);
  const [needsMic,    setNeedsMic]    = useState(false);
  const [camGranted,  setCamGranted]  = useState<CheckStatus>("pending");
  const [micGranted,  setMicGranted]  = useState<CheckStatus>("pending");
  const streamRef = useRef<MediaStream | null>(null);

  // ── Examen en curso ─────────────────────────────────────────────────────
  const [currentQuestionId, setCurrentQuestionId] = useState<number | null>(null);
  const [answers, setAnswers] = useState<Record<string, number>>({});
  const [flagged, setFlagged] = useState<number[]>([]);
  const [remainingMs, setRemainingMs] = useState(0);
  const [timeWarningShown, setTimeWarningShown] = useState(false);
  const [showTimeToast, setShowTimeToast] = useState(false);
  const [fullscreenLost, setFullscreenLost] = useState(false);
  const submittingRef = useRef(false);

  const [result, setResult] = useState<SubmitResult | null>(null);

  // ═══════════════════════════════════════════════════════════════════════
  //  Carga inicial — ¿hay un examen en curso? (permite reanudar sin re-cobrar)
  // ═══════════════════════════════════════════════════════════════════════
  useEffect(() => {
    if (!user) return;

    if (isMobileDevice()) {
      setPhase("mobile_blocked");
      return;
    }

    axios.get(`${import.meta.env.VITE_API_URL}/api/certification/${certId}/status`, { withCredentials: true })
      .then(({ data }) => {
        if (data.inProgress) {
          setAttempt(data);
          setAnswers(data.answers ?? {});
          setFlagged(data.flagged ?? []);
        
          setPhase("device_check"); // reanudando — se saltea la pantalla de reglas/canje
        } else {
          setPhase("rules");
        }
      })
      .catch(() => setPhase("rules"));
  }, [user, certId]);

  // ═══════════════════════════════════════════════════════════════════════
  //  Device check — segundo monitor + pestaña duplicada
  // ═══════════════════════════════════════════════════════════════════════
  const runDeviceChecks = useCallback(async () => {
    setTabCheck("pending");
    setMonitorCheck("pending");

    const channelName = `cert-${certId}-${user?.uid ?? "anon"}`;
    if (!broadcastRef.current) {
      broadcastRef.current = new BroadcastChannel(channelName);
      // Responder los pings de otras pestañas para que ELLAS también nos detecten
      broadcastRef.current.onmessage = (ev) => {
        if (ev.data === "ping") broadcastRef.current?.postMessage("pong");
      };
    }

    const [tabResult, monitorResult] = await Promise.all([
      pingForDuplicateTab(broadcastRef.current),
      checkSecondMonitor(),
    ]);

    setTabCheck(tabResult);
    setMonitorCheck(monitorResult);
  }, [certId, user?.uid]);

  useEffect(() => {
    if (phase === "device_check") runDeviceChecks();
  }, [phase, runDeviceChecks]);

  const deviceChecksPassed = tabCheck === "ok" && (monitorCheck === "ok" || monitorCheck === "unknown");

  // ═══════════════════════════════════════════════════════════════════════
  //  Permisos de cámara/micrófono
  // ═══════════════════════════════════════════════════════════════════════
  const requestMediaPermissions = useCallback(async () => {
    let devices: MediaDeviceInfo[] = [];
    try {
      devices = await navigator.mediaDevices.enumerateDevices();
    } catch {
      // no se pudo enumerar — asumimos que no hay dispositivos, no bloqueamos
    }

    const hasCam = devices.some(d => d.kind === "videoinput");
    const hasMic = devices.some(d => d.kind === "audioinput");
    setNeedsCamera(hasCam);
    setNeedsMic(hasMic);

    if (!hasCam && !hasMic) {
      setCamGranted("ok"); setMicGranted("ok");
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: hasCam, audio: hasMic,
      });
      streamRef.current = stream;
      setCamGranted(hasCam ? "ok" : "ok");
      setMicGranted(hasMic ? "ok" : "ok");
    } catch {
      setCamGranted(hasCam ? "fail" : "ok");
      setMicGranted(hasMic ? "fail" : "ok");
    }
  }, []);

  useEffect(() => {
    if (phase === "permissions") requestMediaPermissions();
  }, [phase, requestMediaPermissions]);

  const permissionsOk =
    (!needsCamera || camGranted === "ok") &&
    (!needsMic    || micGranted === "ok");

  // ═══════════════════════════════════════════════════════════════════════
  //  Empezar (o reanudar) el examen — consume voucher solo si es la 1ra vez
  // ═══════════════════════════════════════════════════════════════════════
  const startExam = async () => {
    setErrorMsg(null);
    try {
      const { data } = await axios.post<AttemptPayload>(
        `${import.meta.env.VITE_API_URL}/api/certification/${certId}/start`,
        {}, { withCredentials: true }
      );
      setAttempt(data);
      setAnswers(data.answers ?? {});
      setFlagged(data.flagged ?? []);
      setCurrentQuestionId(data.questions[0]?.id ?? null);

      try { await document.documentElement.requestFullscreen(); } catch { /* no bloqueamos si falla */ }

      setPhase("exam");
    } catch (err: any) {
      const code = err.response?.data?.code;
      if (code === "NO_VOUCHER") {
        setErrorMsg("No tenés un voucher disponible para rendir esta certificación.");
      } else {
        setErrorMsg("No se pudo iniciar el examen. Intentá de nuevo.");
      }
    }
  };

  // ═══════════════════════════════════════════════════════════════════════
  //  Timer — remainingMs se recalcula desde expiresAt (autoridad del backend)
  // ═══════════════════════════════════════════════════════════════════════
  useEffect(() => {
    if (!attempt || (phase !== "exam" && phase !== "review")) return;

    const expiresAtMs = new Date(attempt.expiresAt).getTime();
    const totalMs      = attempt.timeLimitMinutes * 60 * 1000;
    const warningAtMs  = totalMs * (attempt.timeWarningPercent / 100);

    const tick = () => {
      const remaining = expiresAtMs - Date.now();
      setRemainingMs(Math.max(0, remaining));

      if (
        attempt.timeWarningEnabled &&
        !timeWarningShown &&
        remaining <= warningAtMs &&
        remaining > 0
      ) {
        setTimeWarningShown(true);
        setShowTimeToast(true);
        logEvent("time_warning_shown", { remainingMs: remaining });
        setTimeout(() => setShowTimeToast(false), attempt.timeWarningDurationSeconds * 1000);
      }

      if (remaining <= 0 && !submittingRef.current) {
        submittingRef.current = true;
        submitExam();
      }
    };

    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, [attempt, phase, timeWarningShown]); // eslint-disable-line react-hooks/exhaustive-deps

  // ═══════════════════════════════════════════════════════════════════════
  //  Fullscreen — detecta salida y muestra overlay bloqueante
  // ═══════════════════════════════════════════════════════════════════════
  useEffect(() => {
    if (phase !== "exam" && phase !== "review") return;

    const onFsChange = () => {
      const inFs = !!document.fullscreenElement;
      setFullscreenLost(!inFs);
      if (!inFs) logEvent("fullscreen_exited");
    };
    document.addEventListener("fullscreenchange", onFsChange);
    return () => document.removeEventListener("fullscreenchange", onFsChange);
  }, [phase]);

  const reenterFullscreen = async () => {
    try {
      await document.documentElement.requestFullscreen();
      setFullscreenLost(false);
    } catch { /* el navegador puede rechazarlo sin gesto reciente */ }
  };

  // ═══════════════════════════════════════════════════════════════════════
  //  Visibilidad de pestaña — solo auditoría, no se puede bloquear de verdad
  // ═══════════════════════════════════════════════════════════════════════
  useEffect(() => {
    if (phase !== "exam" && phase !== "review") return;
    const onVisibility = () => {
      logEvent(document.hidden ? "tab_hidden" : "tab_visible");
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => document.removeEventListener("visibilitychange", onVisibility);
  }, [phase]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Helpers de API ──────────────────────────────────────────────────────
  const logEvent = (type: string, meta: Record<string, unknown> = {}) => {
    axios.post(
      `${import.meta.env.VITE_API_URL}/api/certification/${certId}/event`,
      { type, meta }, { withCredentials: true }
    ).catch(() => {});
  };

  const saveAnswer = (questionId: number, selected: number) => {
    setAnswers(prev => ({ ...prev, [String(questionId)]: selected }));
    axios.patch(
      `${import.meta.env.VITE_API_URL}/api/certification/${certId}/answer`,
      { questionId, selected }, { withCredentials: true }
    ).catch(() => {});
  };

  const toggleFlag = (questionId: number) => {
    const isFlagged = flagged.includes(questionId);
    const updated = isFlagged ? flagged.filter(id => id !== questionId) : [...flagged, questionId];
    setFlagged(updated);
    axios.patch(
      `${import.meta.env.VITE_API_URL}/api/certification/${certId}/answer`,
      { questionId, flagged: !isFlagged }, { withCredentials: true }
    ).catch(() => {});
  };

  const submitExam = async () => {
    try {
      const { data } = await axios.post<SubmitResult>(
        `${import.meta.env.VITE_API_URL}/api/certification/${certId}/submit`,
        {}, { withCredentials: true }
      );
      setResult(data);
      cleanupMedia();
      if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
      setPhase("result");
    } catch {
      setErrorMsg("Hubo un problema al enviar el examen. Contactá a soporte.");
    }
  };

  const cleanupMedia = () => {
    streamRef.current?.getTracks().forEach(t => t.stop());
    streamRef.current = null;
  };

  useEffect(() => () => { cleanupMedia(); broadcastRef.current?.close(); }, []);

  // ═══════════════════════════════════════════════════════════════════════
  //  Render
  // ═══════════════════════════════════════════════════════════════════════
  if (phase === "loading") {
    return (
      <div className={`cex-wrap ${isLight ? "light" : ""}`}>
        <div className="cex-loading">
          <span className="cex-loading-dot" /><span className="cex-loading-dot" /><span className="cex-loading-dot" />
        </div>
      </div>
    );
  }

  // ── Mobile bloqueado — se muestra igual la pantalla, pero sin poder avanzar
  if (phase === "mobile_blocked") {
    return (
      <div className={`cex-wrap ${isLight ? "light" : ""}`}>
        <span className="cex-eyebrow">// {title}</span>
        <h2 className="cex-title">Certificación</h2>
        <div className="cex-card">
          <div className="cex-alert">
            <span className="cex-alert-icon">🚫</span>
            <span className="cex-alert-text">
              Este examen no puede rendirse desde un celular ni una tablet. Ingresá desde una
              computadora de escritorio o notebook (Windows, Linux o macOS) para continuar.
            </span>
          </div>
        </div>
      </div>
    );
  }

  // ── Pantalla de reglas + confirmación de canje ───────────────────────────
  if (phase === "rules") {
    return (
      <div className={`cex-wrap ${isLight ? "light" : ""}`}>
        <span className="cex-eyebrow">// CERTIFICACIÓN</span>
        <h2 className="cex-title">{title}</h2>
        <div className="cex-card">
          <h3 className="cex-card-title">Antes de empezar</h3>
          <ul className="cex-rules-list">
            {EXAM_RULES.map((rule, i) => (
              <li key={i}>
                <span className="cex-rules-index">{i + 1}</span>
                <span>{rule}</span>
              </li>
            ))}
          </ul>
                    {errorMsg && (
            <div className="cex-alert">
              <span className="cex-alert-icon">⚠</span>
              <span className="cex-alert-text">{errorMsg}</span>
            </div>
          )}
          <div className="cex-btn-row">
            <button className="cex-btn cex-btn--accent" onClick={() => setPhase("device_check")}>
              SÍ, QUIERO CANJEAR MI VOUCHER Y EMPEZAR
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ── Verificación de dispositivo (segundo monitor / pestaña duplicada) ────
  if (phase === "device_check") {
    const bothPending = tabCheck === "pending" || monitorCheck === "pending";
    return (
      <div className={`cex-wrap ${isLight ? "light" : ""}`}>
        <span className="cex-eyebrow">// CERTIFICACIÓN</span>
        <h2 className="cex-title">{title}</h2>
        <div className="cex-card">
          <h3 className="cex-card-title">Verificación de integridad</h3>

          <div className="cex-checklist">
            <div className="cex-check-item">
              <span className={`cex-check-status cex-check-status--${
                tabCheck === "pending" ? "pending" : tabCheck === "ok" ? "ok" : "fail"
              }`}>
                {tabCheck === "pending" ? "…" : tabCheck === "ok" ? "✓" : "✕"}
              </span>
              <span>Sin otras pestañas de este examen abiertas</span>
            </div>
            <div className="cex-check-item">
              <span className={`cex-check-status cex-check-status--${
                monitorCheck === "pending" ? "pending" :
                monitorCheck === "ok" ? "ok" :
                monitorCheck === "unknown" ? "unknown" : "fail"
              }`}>
                {monitorCheck === "pending" ? "…" :
                 monitorCheck === "ok" ? "✓" :
                 monitorCheck === "unknown" ? "?" : "✕"}
              </span>
              <span>
                Sin segundo monitor conectado
                {monitorCheck === "unknown" && (
                  <span style={{ opacity: 0.5, fontWeight: 500 }}> — no verificable en este navegador</span>
                )}
              </span>
            </div>
          </div>

          {tabCheck === "fail" && (
            <div className="cex-alert">
              <span className="cex-alert-icon">⚠</span>
              <span className="cex-alert-text">
                Detectamos otra pestaña de este examen abierta. Cerrala y volvé a intentar.
              </span>
            </div>
          )}
          {monitorCheck === "fail" && (
            <div className="cex-alert">
              <span className="cex-alert-icon">⚠</span>
              <span className="cex-alert-text">
                Detectamos un segundo monitor conectado. Desconectalo para continuar — el examen
                requiere una única pantalla visible.
              </span>
            </div>
          )}

          <div className="cex-btn-row">
            {!deviceChecksPassed && !bothPending && (
              <button className="cex-btn" onClick={runDeviceChecks}>
                VOLVER A VERIFICAR
              </button>
            )}
            <button
              className="cex-btn cex-btn--accent"
              disabled={bothPending || !deviceChecksPassed}
              onClick={() => setPhase("permissions")}
            >
              CONTINUAR →
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ── Permisos de cámara / micrófono ────────────────────────────────────────
  if (phase === "permissions") {
    const stillWaiting = (needsCamera && camGranted === "pending") || (needsMic && micGranted === "pending");
    return (
      <div className={`cex-wrap ${isLight ? "light" : ""}`}>
        <span className="cex-eyebrow">// CERTIFICACIÓN</span>
        <h2 className="cex-title">{title}</h2>
        <div className="cex-card">
          <h3 className="cex-card-title">Permisos de cámara y micrófono</h3>
          <p style={{ fontSize: "0.85rem", opacity: 0.75, lineHeight: 1.6, marginBottom: 24 }}>
            Vamos a usar tu cámara y micrófono (si tu dispositivo los tiene) durante el examen,
            únicamente para validar que lo estés rindiendo vos y sin ayuda de terceros.
          </p>

          {!needsCamera && !needsMic ? (
            <div className="cex-alert cex-alert--ok">
              <span className="cex-alert-icon">✓</span>
              <span className="cex-alert-text">
                No detectamos cámara ni micrófono en este dispositivo — podés continuar sin problema.
              </span>
            </div>
          ) : (
            <div className="cex-checklist">
              {needsCamera && (
                <div className="cex-check-item">
                  <span className={`cex-check-status cex-check-status--${
                    camGranted === "pending" ? "pending" : camGranted === "ok" ? "ok" : "fail"
                  }`}>
                    {camGranted === "pending" ? "…" : camGranted === "ok" ? "✓" : "✕"}
                  </span>
                  <span>Permiso de cámara</span>
                </div>
              )}
              {needsMic && (
                <div className="cex-check-item">
                  <span className={`cex-check-status cex-check-status--${
                    micGranted === "pending" ? "pending" : micGranted === "ok" ? "ok" : "fail"
                  }`}>
                    {micGranted === "pending" ? "…" : micGranted === "ok" ? "✓" : "✕"}
                  </span>
                  <span>Permiso de micrófono</span>
                </div>
              )}
            </div>
          )}

          {(camGranted === "fail" || micGranted === "fail") && (
            <div className="cex-alert">
              <span className="cex-alert-icon">⚠</span>
              <span className="cex-alert-text">
                Necesitamos que autorices el acceso para poder continuar. Revisá los permisos del
                sitio en tu navegador y volvé a intentar.
              </span>
            </div>
          )}

          <div className="cex-btn-row">
            {(camGranted === "fail" || micGranted === "fail") && (
              <button className="cex-btn" onClick={requestMediaPermissions}>
                REINTENTAR
              </button>
            )}
            <button
              className="cex-btn cex-btn--accent"
              disabled={stillWaiting || !permissionsOk}
              onClick={() => setPhase("ready")}
            >
              CONTINUAR →
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ── Pantalla final antes de arrancar — o reanudación directa ─────────────
  if (phase === "ready") {
    return (
      <div className={`cex-wrap ${isLight ? "light" : ""}`}>
        <span className="cex-eyebrow">// CERTIFICACIÓN</span>
        <h2 className="cex-title">{title}</h2>
        <div className="cex-card">
          <h3 className="cex-card-title">Todo listo</h3>
          <p style={{ fontSize: "0.85rem", opacity: 0.75, lineHeight: 1.6, marginBottom: 24 }}>
            Al tocar "Empezar examen" se va a consumir tu voucher, la pantalla pasará a modo
            completo y el temporizador comenzará a correr. No vas a poder pausarlo.
          </p>
          {errorMsg && (
            <div className="cex-alert">
              <span className="cex-alert-icon">⚠</span>
              <span className="cex-alert-text">{errorMsg}</span>
            </div>
          )}
          <div className="cex-btn-row">
            <button className="cex-btn cex-btn--accent" onClick={startExam}>
              EMPEZAR EXAMEN →
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ── Examen / revisión ──────────────────────────────────────────────────
  if ((phase === "exam" || phase === "review") && attempt) {
    const currentQuestion = attempt.questions.find(q => q.id === currentQuestionId) ?? attempt.questions[0];
    const totalMs   = attempt.timeLimitMinutes * 60 * 1000;
    const pctLeft   = totalMs > 0 ? remainingMs / totalMs : 0;
    const timerClass = pctLeft <= 0.1 ? "cex-timer--danger" : pctLeft <= attempt.timeWarningPercent / 100 ? "cex-timer--warning" : "";

    const answeredCount = Object.keys(answers).length;
    const letters = ["A", "B", "C", "D", "E"];

    return (
      <div className={`cex-wrap ${isLight ? "light" : ""}`}>
        {fullscreenLost && (
          <div className="cex-fullscreen-lost">
            <span className="cex-fullscreen-lost-icon">⛶</span>
            <p className="cex-fullscreen-lost-text">
              Saliste del modo pantalla completa. El examen sigue corriendo — volvé a pantalla
              completa para continuar viéndolo con normalidad. Este evento queda registrado.
            </p>
            <button className="cex-btn cex-btn--accent" onClick={reenterFullscreen}>
              VOLVER A PANTALLA COMPLETA
            </button>
          </div>
        )}

        {showTimeToast && (
          <div className="cex-time-toast">
            ⏱ Queda poco tiempo — {formatDuration(remainingMs)} restantes
          </div>
        )}

        <div className="cex-exam-header">
          <span className="cex-progress-label">
            {answeredCount} / {attempt.questions.length} respondidas
          </span>
          <span className={`cex-timer ${timerClass}`}>{formatDuration(remainingMs)}</span>
        </div>

        {phase === "exam" && (
          <div className="cex-exam-layout">
            <aside className="cex-sidebar">
              <p className="cex-sidebar-title">// MÓDULOS</p>
              {attempt.questions.map((q, i) => {
                const isAnswered = answers[String(q.id)] !== undefined;
                const isFlagged  = flagged.includes(q.id);
                const mod = attempt.modules.find(m => m.id === q.moduleId);
                return (
                  <div
                    key={q.id}
                    className={`cex-sidebar-item${q.id === currentQuestionId ? " active" : ""}${isAnswered ? " answered" : ""}${isFlagged ? " flagged" : ""}`}
                    onClick={() => setCurrentQuestionId(q.id)}
                  >
                    <span className="cex-sidebar-dot" />
                    <span>{mod?.title ?? `Módulo ${i + 1}`}</span>
                  </div>
                );
              })}
            </aside>

            <div>
              {currentQuestion && (
                <div className="cex-question-card">
                  <span className="cex-question-module">
                    {attempt.modules.find(m => m.id === currentQuestion.moduleId)?.title}
                  </span>
                  <h3 className="cex-question-text">{currentQuestion.question}</h3>

                  <div className="cex-options">
                    {currentQuestion.options.map((opt, i) => (
                      <button
                        key={i}
                        className={`cex-option${answers[String(currentQuestion.id)] === i ? " selected" : ""}`}
                        onClick={() => saveAnswer(currentQuestion.id, i)}
                      >
                        <span className="cex-option-letter">{letters[i]}</span>
                        {opt}
                      </button>
                    ))}
                  </div>

                  <div className="cex-question-footer">
                    <button
                      className={`cex-flag-btn${flagged.includes(currentQuestion.id) ? " active" : ""}`}
                      onClick={() => toggleFlag(currentQuestion.id)}
                    >
                      {flagged.includes(currentQuestion.id) ? "★ MARCADA PARA REVISAR" : "☆ MARCAR PARA REVISAR"}
                    </button>

                    <div className="cex-btn-row" style={{ marginTop: 0 }}>
                      {(() => {
                        const idx = attempt.questions.findIndex(q => q.id === currentQuestion.id);
                        const isLast = idx === attempt.questions.length - 1;
                        return isLast ? (
                          <button className="cex-btn cex-btn--accent" onClick={() => setPhase("review")}>
                            IR A REVISIÓN FINAL →
                          </button>
                        ) : (
                          <button
                            className="cex-btn cex-btn--accent"
                            onClick={() => setCurrentQuestionId(attempt.questions[idx + 1].id)}
                          >
                            SIGUIENTE →
                          </button>
                        );
                      })()}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {phase === "review" && (
          <div className="cex-card" style={{ maxWidth: 720 }}>
            <h3 className="cex-card-title">Revisión final</h3>
            <p style={{ fontSize: "0.82rem", opacity: 0.7, marginBottom: 20 }}>
              Revisá las preguntas marcadas o sin responder antes de enviar. Una vez enviado, no
              vas a poder modificar tus respuestas.
            </p>

            <div className="cex-review-list">
              {attempt.questions.map((q, i) => {
                const isAnswered = answers[String(q.id)] !== undefined;
                const isFlagged  = flagged.includes(q.id);
                return (
                  <div key={q.id} className="cex-review-item" onClick={() => { setCurrentQuestionId(q.id); setPhase("exam"); }}>
                    <span>Pregunta {i + 1} — {attempt.modules.find(m => m.id === q.moduleId)?.title}</span>
                    <div className="cex-review-tags">
                      {isFlagged && <span className="cex-review-tag cex-review-tag--flagged">MARCADA</span>}
                      {!isAnswered && <span className="cex-review-tag cex-review-tag--unanswered">SIN RESPONDER</span>}
                      {isAnswered && !isFlagged && <span className="cex-review-tag cex-review-tag--ok">OK</span>}
                    </div>
                  </div>
                );
              })}
            </div>

            {errorMsg && (
              <div className="cex-alert">
                <span className="cex-alert-icon">⚠</span>
                <span className="cex-alert-text">{errorMsg}</span>
              </div>
            )}

            <div className="cex-btn-row">
              <button className="cex-btn" onClick={() => setPhase("exam")}>
                ← VOLVER AL EXAMEN
              </button>
              <button className="cex-btn cex-btn--accent" onClick={submitExam}>
                ENVIAR EXAMEN A VALIDACIÓN
              </button>
            </div>
          </div>
        )}

        <div className="cex-media-dock">
          {streamRef.current && needsCamera && (
            <div className="cex-webcam-box">
              <video
                autoPlay muted playsInline
                ref={(el) => { if (el && streamRef.current) el.srcObject = streamRef.current; }}
              />
            </div>
          )}
          {streamRef.current && needsMic && <AudioSpectrum stream={streamRef.current} />}
        </div>
      </div>
    );
  }

  // ── Resultado final ─────────────────────────────────────────────────────
  if (phase === "result" && result) {
    return (
      <div className={`cex-wrap ${isLight ? "light" : ""}`}>
        {result.showConfetti && (
          <ConfettiBurst colors={isLight ? result.confettiColors.light : result.confettiColors.dark} />
        )}
        <div className="cex-result">
          <div className={`cex-result-badge cex-result-badge--${result.passed ? "passed" : "failed"}`}>
            {result.passed ? "✓" : "✕"}
          </div>
          <h2 className="cex-result-title">
            {result.expired ? "TIEMPO AGOTADO" : result.passed ? "¡CERTIFICADO!" : "NO APROBADO"}
          </h2>
          <p className="cex-result-score">
            {result.correct} / {result.total} correctas · {Math.round(result.score * 100)}%
            {" "}(mínimo {Math.round(result.passingScore * 100)}%)
          </p>
          <a href="/dashboard?tab=cursos" className="cex-btn cex-btn--accent">
            VOLVER AL DASHBOARD
          </a>
        </div>
      </div>
    );
  }

  return null;
}