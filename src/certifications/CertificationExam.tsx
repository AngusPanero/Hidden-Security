import { useState, useEffect, useRef, useCallback, Fragment } from "react";
import type { ReactNode } from "react";
import axios from "axios";
import { UseSession } from "../contexts/SessionContext"; // ⚠️ ajustá según dónde quede esta carpeta
import { UseTheme } from "../contexts/ThemeContext";     // ⚠️ ídem
import "./certificationExam.css";

// ══════════════════════════════════════════════════════════════════════════════
//  TIPOS — todo lo que llega acá ya viene sanitizado por el backend: no hay
//  respuestas correctas, pesos ni preguntas futuras. El front solo muestra.
// ══════════════════════════════════════════════════════════════════════════════
interface ConfettiColors { dark: string[]; light: string[]; }

interface CaseTransition { beforePosition: number; html: string; isNew: boolean; }
interface CaseInfo {
  id: string; kind: "sjt" | "exp"; name: string;
  position: number; size: number;
  contextHtml: string;
  transitions: CaseTransition[];
}
interface ExamQuestion {
  id: string;
  number: number;
  kind: "sjt" | "exp" | "ind";
  module: string | null;
  responseType: "single" | "multi" | "truefalse";
  difficulty: string | null;
  text: string;
  options: string[];
  selected: number[];
  flagged: boolean;
  case: CaseInfo | null;
}
interface MapItem { number: number; state: "done" | "current" | "locked"; answered: boolean; flagged: boolean; inCase: boolean; }
interface ReviewItem { questionId: string; number: number; answered: boolean; flagged: boolean; }
interface ExamView {
  phase: "exam" | "review";
  total: number;
  currentIndex: number;
  isLast: boolean;
  question: ExamQuestion | null;
  review: { queue: ReviewItem[]; index: number } | null;
  map: MapItem[];
  progress: { answered: number; flagged: number; unanswered: number };
}

interface AttemptPayload {
  attemptId: string;
  expiresAt: string;
  serverNow: string;
  passingScore:               number;
  totalQuestions:             number;
  timeWarningEnabled:         boolean;
  timeWarningPercent:         number;
  timeWarningDurationSeconds: number;
  timeLimitMinutes:           number;
  showConfetti:               boolean;
  confettiColors:             ConfettiColors;
  view: ExamView;
}

interface SubmitResult {
  passed: boolean; expired: boolean;
  score: number; correct: number; total: number; passingScore: number;
  byModule: { module: string; correct: number; total: number; score: number }[];
  certifiedSkill: string | null;
  showConfetti: boolean; confettiColors: ConfettiColors;
  // Contexto de reintentos (lo calcula el servidor)
  previousBest: number | null;  // mejor % antes de este intento
  bestScore:    number;         // mejor % vigente después de este intento
  isNewBest:    boolean;        // este intento superó al mejor anterior
  wasCertified: boolean;        // ya estaba aprobado antes de este intento
  certified:    boolean;        // certificación vigente después del intento
  attempts:     number;
}

// Resultado vigente del usuario en esta certificación (intentos anteriores)
interface PreviousSummary {
  attempts:      number;
  passed:        boolean;
  passedAt:      string | null;
  bestScore:     number;
  bestAt:        string | null;
  lastScore:     number;
  lastResult:    "passed" | "failed" | "expired" | "violation" | null;
  lastAttemptAt: string | null;
  passingScore:  number;
}

const EXAM_RULES: string[] = [
  "¿Estás seguro/a que deseás canjear tu voucher para rendir esta certificación? Esta acción consume un ticket de tu cuenta.",
  "Una vez que ingreses, el examen comenzará: no podrá pausarse ni continuarse en otro momento.",
  "Vas a disponer de 2 horas para completar el examen. Cuando se agote el tiempo, se enviará automáticamente con las respuestas que hayas cargado hasta ese momento.",
  "El examen tiene 80 preguntas, entre casos prácticos y preguntas individuales. Las preguntas se responden en orden y no se puede volver atrás.",
  "Si tenés dudas con una pregunta, marcala para revisar: al llegar al final vas a poder volver únicamente a las preguntas marcadas antes de enviar el examen.",
  "Para aprobar necesitás obtener al menos el 80% del puntaje.",
  "Se verificará de forma continua que no estés usando un segundo monitor ni tengas otras pestañas de este examen abiertas — la verificación no se hace una sola vez, sino durante todo el examen.",
  "El examen debe rendirse en una computadora de escritorio o notebook (Windows, Linux o macOS) — no está disponible en celulares ni tablets.",
  "Si tu dispositivo cuenta con cámara y/o micrófono, se solicitará permiso para usarlos durante el examen, con el fin de validar que lo estés rindiendo vos y sin ayuda de terceros.",
];

const VIOLATION_GRACE_SECONDS = 30;
const LETTERS = ["A", "B", "C", "D", "E", "F", "G", "H"];

type Phase = "loading" | "mobile_blocked" | "previous" | "rules" | "device_check" | "permissions" | "ready" | "exam" | "review" | "result";
type CheckStatus = "pending" | "ok" | "fail" | "unknown";

function isMobileDevice(): boolean {
  const ua = navigator.userAgent || "";
  const uaMobile = /Android|iPhone|iPad|iPod|Mobile|Tablet/i.test(ua);
  const coarsePointer = window.matchMedia?.("(pointer: coarse)").matches ?? false;
  return uaMobile || coarsePointer;
}

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
    return "unknown";
  }
}

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

function violationReasonLabel(reason: string): string {
  switch (reason) {
    case "second_monitor_connected": return "Se detectó un segundo monitor conectado durante el examen.";
    case "duplicate_tab_detected":   return "Se detectó otra pestaña de este examen abierta.";
    default: return "Se detectó una infracción de integridad durante el examen.";
  }
}

// `código` → <code>. Sin dangerouslySetInnerHTML: el texto se escapa por React.
function renderInline(text: string): ReactNode[] {
  return text.split("`").map((chunk, i) =>
    i % 2 === 1 ? <code key={i} className="cex-inline-code">{chunk}</code> : <Fragment key={i}>{chunk}</Fragment>
  );
}

// Los enunciados del banco usan doble espacio como salto y " - " como viñetas.
function QuestionText({ text }: { text: string }) {
  const blocks = text.split(/\s{2,}/).map(b => b.trim()).filter(Boolean);
  return (
    <div className="cex-question-text">
      {blocks.map((b, i) =>
        b.startsWith("- ") ? (
          <ul key={i} className="cex-question-list">
            {b.slice(2).split(/\s-\s/).map((li, j) => <li key={j}>{renderInline(li)}</li>)}
          </ul>
        ) : (
          <p key={i}>{renderInline(b)}</p>
        )
      )}
    </div>
  );
}

const pct = (n: number | null | undefined) => `${Math.round((n ?? 0) * 100)}%`;
const fmtDate = (d: string | null) =>
  d ? new Date(d).toLocaleDateString("es-AR", { day: "2-digit", month: "short", year: "numeric" }) : "—";
const lastResultLabel = (r: PreviousSummary["lastResult"]) =>
  r === "passed" ? "Aprobado" : r === "expired" ? "Tiempo agotado" : r === "violation" ? "Suspendido" : "No aprobado";

const responseTypeLabel = (t: ExamQuestion["responseType"]) =>
  t === "multi" ? "Selección múltiple" : t === "truefalse" ? "Verdadero / Falso" : "Opción única";

// ══════════════════════════════════════════════════════════════════════════════
//  Sub-componente: medidor de micrófono
//  Barras simétricas desde el centro, con el color de acento del tema actual
//  (lee --cex-accent del CSS) y nítido en pantallas retina.
// ══════════════════════════════════════════════════════════════════════════════
function AudioSpectrum({ stream }: { stream: MediaStream }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [active, setActive] = useState(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx2d = canvas.getContext("2d");
    if (!ctx2d) return;

    const dpr = window.devicePixelRatio || 1;
    const cssW = canvas.clientWidth, cssH = canvas.clientHeight;
    canvas.width = cssW * dpr; canvas.height = cssH * dpr;
    ctx2d.scale(dpr, dpr);

    const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
    const source   = audioCtx.createMediaStreamSource(stream);
    const analyser = audioCtx.createAnalyser();
    analyser.fftSize = 64;
    analyser.smoothingTimeConstant = 0.75;
    source.connect(analyser);

    const BARS = 24;
    const data = new Uint8Array(analyser.frequencyBinCount);
    const accent = getComputedStyle(canvas).getPropertyValue("--cex-accent").trim() || "#ccff00";
    const idle   = getComputedStyle(canvas).getPropertyValue("--cex-border").trim() || "rgba(255,255,255,0.1)";
    let rafId: number;
    let lastActive = false;

    const draw = () => {
      rafId = requestAnimationFrame(draw);
      analyser.getByteFrequencyData(data);
      ctx2d.clearRect(0, 0, cssW, cssH);

      const gap = 3;
      const barW = (cssW - gap * (BARS - 1)) / BARS;
      const mid = cssH / 2;
      let sum = 0;

      for (let i = 0; i < BARS; i++) {
        // Bins de voz (graves/medios) repartidos en espejo desde el centro
        const bin = Math.abs(i - (BARS - 1) / 2) | 0;
        const v = data[bin] / 255;
        sum += v;
        const h = Math.max(2, v * (cssH - 4));
        ctx2d.fillStyle = v > 0.04 ? accent : idle;
        ctx2d.globalAlpha = v > 0.04 ? 0.35 + v * 0.65 : 1;
        const x = i * (barW + gap);
        ctx2d.beginPath();
        if (ctx2d.roundRect) ctx2d.roundRect(x, mid - h / 2, barW, h, Math.min(barW / 2, 2));
        else ctx2d.rect(x, mid - h / 2, barW, h);
        ctx2d.fill();
      }
      ctx2d.globalAlpha = 1;

      const isActive = sum / BARS > 0.06;
      if (isActive !== lastActive) { lastActive = isActive; setActive(isActive); }
    };
    draw();

    return () => {
      cancelAnimationFrame(rafId);
      source.disconnect();
      audioCtx.close().catch(() => {});
    };
  }, [stream]);

  return (
    <div className={`cex-mic${active ? " is-active" : ""}`}>
      <span className="cex-mic-label">MIC</span>
      <canvas ref={canvasRef} className="cex-mic-canvas" />
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
//  Sub-componente: panel de supervisión (cámara + micrófono) — va en la
//  columna izquierda, así nunca tapa la pregunta ni las opciones.
// ══════════════════════════════════════════════════════════════════════════════
function MonitorPanel({ stream, camera, mic }: { stream: MediaStream; camera: boolean; mic: boolean }) {
  return (
    <div className="cex-monitor">
      <div className="cex-monitor-head">
        <span className="cex-monitor-rec" />
        <span>SUPERVISIÓN ACTIVA</span>
      </div>
      {camera && (
        <div className="cex-monitor-cam">
          <video
            autoPlay muted playsInline
            ref={(el) => { if (el && el.srcObject !== stream) el.srcObject = stream; }}
          />
          <i className="cex-cam-corner tl" /><i className="cex-cam-corner tr" />
          <i className="cex-cam-corner bl" /><i className="cex-cam-corner br" />
          <span className="cex-monitor-live">● LIVE</span>
        </div>
      )}
      {mic && <AudioSpectrum stream={stream} />}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
//  Sub-componente: confetti
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
    const MAX_FRAMES = 260;

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
//  Sub-componente: panel de contexto del caso (SJT / Exploratorio)
//  El HTML viene del banco del servidor (contenido propio, no de usuarios).
// ══════════════════════════════════════════════════════════════════════════════
function CaseContextPanel({ info, defaultOpen }: { info: CaseInfo; defaultOpen: boolean }) {
  const [open, setOpen] = useState(defaultOpen);
  useEffect(() => setOpen(defaultOpen), [info.id, defaultOpen]);

  return (
    <div className={`cex-context cex-context--${info.kind}`}>
      <button type="button" className="cex-context-header" onClick={() => setOpen(o => !o)}>
        <span className={`cex-badge cex-badge--${info.kind}`}>
          {info.kind === "sjt" ? "Escenario SJT" : "Caso exploratorio"}
        </span>
        <span className="cex-context-title">{info.name}</span>
        <span className="cex-context-pos">PREG. {info.position}/{info.size}</span>
        <span className="cex-context-toggle">{open ? "▲ OCULTAR" : "▼ VER CONTEXTO"}</span>
      </button>
      {open && <div className="cex-context-body" dangerouslySetInnerHTML={{ __html: info.contextHtml }} />}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
//  COMPONENTE PRINCIPAL
// ══════════════════════════════════════════════════════════════════════════════
export default function CertificationExam({ certId, title }: { certId: string; title: string }) {
  const { user }  = UseSession();
  const { theme } = UseTheme();
  const isLight   = theme === "light";
  const API = `${import.meta.env.VITE_API_URL}/api/certification/${certId}`;

  const [phase, setPhase] = useState<Phase>("loading");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const [attempt,  setAttempt]  = useState<AttemptPayload | null>(null);
  const [view,     setView]     = useState<ExamView | null>(null);
  const [resuming, setResuming] = useState(false);
  const clockOffsetRef = useRef(0); // serverNow − Date.now(), para que el timer no dependa del reloj local

  const [tabCheck,     setTabCheck]     = useState<CheckStatus>("pending");
  const [monitorCheck, setMonitorCheck] = useState<CheckStatus>("pending");
  const broadcastRef = useRef<BroadcastChannel | null>(null);

  const [needsCamera, setNeedsCamera] = useState(false);
  const [needsMic,    setNeedsMic]    = useState(false);
  const [camGranted,  setCamGranted]  = useState<CheckStatus>("pending");
  const [micGranted,  setMicGranted]  = useState<CheckStatus>("pending");
  const streamRef = useRef<MediaStream | null>(null);

  const [remainingMs, setRemainingMs] = useState(0);
  const [timeWarningShown, setTimeWarningShown] = useState(false);
  const [showTimeToast, setShowTimeToast] = useState(false);
  const [fullscreenLost, setFullscreenLost] = useState(false);
  const [navBusy, setNavBusy] = useState(false);
  const [confirmSubmit, setConfirmSubmit] = useState(false);
  const submittingRef = useRef(false);

  // Guardados en vuelo: se encadenan para que /next nunca corra antes de que
  // el servidor tenga la última selección, y solo se aplica la respuesta más nueva.
  const saveChainRef = useRef<Promise<unknown>>(Promise.resolve());
  const saveSeqRef   = useRef(0);

  // ── Violación de integridad (segundo monitor detectado durante el examen) ─
  const [violationCountdown, setViolationCountdown] = useState<number | null>(null);
  const violationActiveRef = useRef(false); // evita disparar el countdown más de una vez en simultáneo
  const [suspendedReason, setSuspendedReason] = useState<string | null>(null);

  const [result, setResult] = useState<SubmitResult | null>(null);
  const [previous, setPrevious] = useState<PreviousSummary | null>(null);

  const applyAttempt = (data: AttemptPayload) => {
    clockOffsetRef.current = new Date(data.serverNow).getTime() - Date.now();
    setAttempt(data);
    setView(data.view);
  };

  // La fase de pantalla sigue a la fase del servidor una vez arrancado el examen.
  useEffect(() => {
    if (!view) return;
    setPhase(p => (p === "exam" || p === "review") ? view.phase : p);
  }, [view]);

  // ═══════════════════════════════════════════════════════════════════════
  //  Carga inicial
  // ═══════════════════════════════════════════════════════════════════════
  useEffect(() => {
    if (!user) return;

    if (isMobileDevice()) {
      setPhase("mobile_blocked");
      return;
    }

    axios.get(`${API}/status`, { withCredentials: true })
      .then(({ data }) => {
        if (data.inProgress) {
          applyAttempt(data);
          setResuming(true);
          // Reanudando: se saltea la pantalla de reglas/canje (ya se pagó el
          // voucher), pero SÍ se revalida device_check y permissions — la
          // cámara/micrófono no persisten entre refrescos de página.
          setPhase("device_check");
        } else if (data.expired && data.result) {
          // El tiempo se agotó con la pestaña cerrada: el servidor ya lo corrigió.
          setResult(data.result);
          setPhase("result");
        } else if (data.previous?.attempts > 0) {
          // Ya rindió antes: mostramos su resultado ANTES de que pueda gastar otro voucher.
          setPrevious(data.previous);
          setPhase("previous");
        } else {
          setPhase("rules");
        }
      })
      .catch(() => setPhase("rules"));
  }, [user, certId]); // eslint-disable-line react-hooks/exhaustive-deps

  // ═══════════════════════════════════════════════════════════════════════
  //  Device check inicial (pestaña duplicada + monitor) — corre una vez al
  //  entrar a la fase, o al tocar "volver a verificar"
  // ═══════════════════════════════════════════════════════════════════════
  const runDeviceChecks = useCallback(async () => {
    setTabCheck("pending");
    setMonitorCheck("pending");

    const channelName = `cert-${certId}-${user?.uid ?? "anon"}`;
    if (!broadcastRef.current) {
      broadcastRef.current = new BroadcastChannel(channelName);
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
  //  Watcher CONTINUO de segundo monitor — corre en todas las fases desde
  //  que se pasó la verificación inicial hasta que termina el examen.
  //  Antes de arrancar (permissions/ready): si detecta el monitor, patea de
  //  vuelta a device_check (no se gastó voucher, no hace falta gracia).
  //  Durante el examen (exam/review): dispara el overlay de 30s de gracia.
  // ═══════════════════════════════════════════════════════════════════════
  useEffect(() => {
    const watchedPhases: Phase[] = ["permissions", "ready", "exam", "review"];
    if (!watchedPhases.includes(phase)) return;

    let cancelled = false;
    let screenDetailsCleanup: (() => void) | null = null;

    const handleCheck = async () => {
      const status = await checkSecondMonitor();
      if (cancelled) return;

      if (status === "fail") {
        setMonitorCheck("fail");

        if (phase === "exam" || phase === "review") {
          if (!violationActiveRef.current) {
            violationActiveRef.current = true;
            logEvent("second_monitor_detected_during_exam");
            setViolationCountdown(VIOLATION_GRACE_SECONDS);
          }
        } else {
          // Antes de arrancar el examen: todavía no se gastó voucher,
          // simplemente se lo vuelve a mandar a verificar.
          logEvent("second_monitor_kicked_to_device_check");
          setPhase("device_check");
        }
      } else if (status === "ok") {
        setMonitorCheck(prev => (prev === "fail" ? "ok" : prev));
        if (violationActiveRef.current) {
          violationActiveRef.current = false;
          setViolationCountdown(null);
          logEvent("second_monitor_disconnected");
        }
      }
    };

    // Poll cada 2.5s — funciona en cualquier navegador, aunque no soporte
    // la Window Management API (fallback confiable).
    const interval = setInterval(handleCheck, 2500);

    // Si el navegador soporta getScreenDetails(), además escuchamos el
    // evento nativo para detectar el cambio casi instantáneamente.
    (async () => {
      try {
        const anyWindow = window as any;
        if (typeof anyWindow.getScreenDetails === "function") {
          const details = await anyWindow.getScreenDetails();
          const onScreensChange = () => handleCheck();
          details.addEventListener("screenschange", onScreensChange);
          screenDetailsCleanup = () => details.removeEventListener("screenschange", onScreensChange);
        }
      } catch {
        // permiso no otorgado o API no soportada — el polling ya cubre esto
      }
    })();

    return () => {
      cancelled = true;
      clearInterval(interval);
      screenDetailsCleanup?.();
    };
  }, [phase]); // eslint-disable-line react-hooks/exhaustive-deps

  // Pestaña duplicada DURANTE el examen: si otra pestaña abre el examen y
  // hace ping, esta responde pong (la otra queda bloqueada en device_check)
  // y además se registra el intento en la auditoría.
  useEffect(() => {
    if (phase !== "exam" && phase !== "review") return;
    const ch = broadcastRef.current;
    if (!ch) return;
    const onMsg = (ev: MessageEvent) => { if (ev.data === "ping") logEvent("duplicate_tab_ping_received"); };
    ch.addEventListener("message", onMsg);
    return () => ch.removeEventListener("message", onMsg);
  }, [phase]); // eslint-disable-line react-hooks/exhaustive-deps

  // Cuenta regresiva de gracia — si llega a 0, se cancela la certificación
  useEffect(() => {
    if (violationCountdown === null) return;
    if (violationCountdown <= 0) {
      reportViolationAndFail("second_monitor_connected");
      return;
    }
    const t = setTimeout(() => setViolationCountdown(v => (v !== null ? v - 1 : null)), 1000);
    return () => clearTimeout(t);
  }, [violationCountdown]); // eslint-disable-line react-hooks/exhaustive-deps

  // ═══════════════════════════════════════════════════════════════════════
  //  Permisos de cámara/micrófono
  // ═══════════════════════════════════════════════════════════════════════
  const requestMediaPermissions = useCallback(async () => {
    let devices: MediaDeviceInfo[] = [];
    try {
      devices = await navigator.mediaDevices.enumerateDevices();
    } catch { /* asumimos sin dispositivos, no bloqueamos */ }

    const hasCam = devices.some(d => d.kind === "videoinput");
    const hasMic = devices.some(d => d.kind === "audioinput");
    setNeedsCamera(hasCam);
    setNeedsMic(hasMic);

    if (!hasCam && !hasMic) {
      setCamGranted("ok"); setMicGranted("ok");
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: hasCam, audio: hasMic });
      streamRef.current = stream;
      setCamGranted("ok");
      setMicGranted("ok");
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
  //  Empezar (o reanudar) el examen
  // ═══════════════════════════════════════════════════════════════════════
  const startExam = async () => {
    setErrorMsg(null);
    try {
      const { data } = await axios.post<AttemptPayload>(`${API}/start`, {}, { withCredentials: true });
      applyAttempt(data);

      try { await document.documentElement.requestFullscreen(); } catch { /* no bloqueamos */ }

      setPhase(data.view.phase);
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
  //  Timer principal (fuente de verdad: expiresAt del servidor)
  // ═══════════════════════════════════════════════════════════════════════
  useEffect(() => {
    if (!attempt || (phase !== "exam" && phase !== "review")) return;

    const expiresAtMs = new Date(attempt.expiresAt).getTime();
    const totalMs      = attempt.timeLimitMinutes * 60 * 1000;
    const warningAtMs  = totalMs * (attempt.timeWarningPercent / 100);

    const tick = () => {
      const remaining = expiresAtMs - (Date.now() + clockOffsetRef.current);
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
        submitExam();
      }
    };

    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, [attempt, phase, timeWarningShown]); // eslint-disable-line react-hooks/exhaustive-deps

  // ═══════════════════════════════════════════════════════════════════════
  //  Fullscreen
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
  }, [phase]); // eslint-disable-line react-hooks/exhaustive-deps

  const reenterFullscreen = async () => {
    try {
      await document.documentElement.requestFullscreen();
      setFullscreenLost(false);
    } catch { /* puede requerir gesto reciente */ }
  };

  // ═══════════════════════════════════════════════════════════════════════
  //  Visibilidad de pestaña — solo auditoría
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
    axios.post(`${API}/event`, { type, meta }, { withCredentials: true }).catch(() => {});
  };

  // Maneja errores comunes de las rutas de navegación/respuesta.
  const handleExamError = (err: any) => {
    const status = err?.response?.status;
    if (status === 410) { submitExam(); return; }               // se agotó el tiempo
    if (err?.response?.data?.view) setView(err.response.data.view); // 409: el servidor manda el estado real
  };

  // Envía al servidor la pregunta (actual o marcada en revisión). Optimista en
  // pantalla; el servidor valida si se puede tocar y devuelve el estado real.
  const patchQuestion = (questionId: string, body: { selected?: number[]; flagged?: boolean }) => {
    setView(v => (v && v.question && v.question.id === questionId)
      ? { ...v, question: { ...v.question, ...(body.selected ? { selected: body.selected } : {}), ...(typeof body.flagged === "boolean" ? { flagged: body.flagged } : {}) } }
      : v);

    const seq = ++saveSeqRef.current;
    const p = saveChainRef.current.then(() =>
      axios.patch<{ view: ExamView }>(`${API}/answer`, { questionId, ...body }, { withCredentials: true })
        .then(({ data }) => { if (seq === saveSeqRef.current) setView(data.view); })
        .catch(handleExamError)
    );
    saveChainRef.current = p;
    return p;
  };

  const selectOption = (q: ExamQuestion, displayIdx: number) => {
    let next: number[];
    if (q.responseType === "multi") {
      next = q.selected.includes(displayIdx)
        ? q.selected.filter(i => i !== displayIdx)
        : [...q.selected, displayIdx].sort((a, b) => a - b);
    } else {
      next = q.selected[0] === displayIdx ? [] : [displayIdx];
    }
    patchQuestion(q.id, { selected: next });
  };

  const toggleFlag = (q: ExamQuestion) => patchQuestion(q.id, { flagged: !q.flagged });

  const goNext = async () => {
    if (!view?.question || navBusy) return;
    setNavBusy(true);
    try {
      await saveChainRef.current; // primero que lleguen las respuestas pendientes
      const { data } = await axios.post<{ view: ExamView }>(`${API}/next`, { questionId: view.question.id }, { withCredentials: true });
      setView(data.view);
      window.scrollTo({ top: 0 });
    } catch (err) {
      handleExamError(err);
    } finally {
      setNavBusy(false);
    }
  };

  const goReview = async (index: number) => {
    if (navBusy) return;
    setNavBusy(true);
    try {
      await saveChainRef.current;
      const { data } = await axios.post<{ view: ExamView }>(`${API}/review/goto`, { index }, { withCredentials: true });
      setView(data.view);
      window.scrollTo({ top: 0 });
    } catch (err) {
      handleExamError(err);
    } finally {
      setNavBusy(false);
    }
  };

  const submitExam = async () => {
    if (submittingRef.current) return;
    submittingRef.current = true;
    setConfirmSubmit(false);
    try {
      await saveChainRef.current.catch(() => {});
      const { data } = await axios.post<SubmitResult>(`${API}/submit`, {}, { withCredentials: true });
      setResult(data);
      cleanupMedia();
      if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
      setPhase("result");
    } catch {
      submittingRef.current = false;
      setErrorMsg("Hubo un problema al enviar el examen. Contactá a soporte.");
    }
  };

  // Cancela la certificación por una infracción de integridad detectada —
  // distinto de submitExam: acá no se corrigen respuestas, se fuerza el
  // fracaso con un motivo específico registrado en el historial.
  const reportViolationAndFail = async (reason: string) => {
    setViolationCountdown(null);
    violationActiveRef.current = false;
    submittingRef.current = true;
    try {
      await axios.post(`${API}/violation`, { reason }, { withCredentials: true });
    } catch { /* igual mostramos la pantalla de suspendido del lado del cliente */ }
    cleanupMedia();
    if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
    setSuspendedReason(reason);
    setPhase("result");
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

  // ── Ya rindió esta certificación: resultado vigente + opción de reintentar ──
  if (phase === "previous" && previous) {
    const passedBefore = previous.passed;
    const passing = previous.passingScore;
    return (
      <div className={`cex-wrap ${isLight ? "light" : ""}`}>
        <span className="cex-eyebrow">// CERTIFICACIÓN</span>
        <h2 className="cex-title">{title}</h2>
        <div className="cex-card">
          <h3 className="cex-card-title">Ya rendiste esta certificación</h3>
          <p style={{ fontSize: "0.82rem", opacity: 0.7, lineHeight: 1.6, margin: "0 0 20px" }}>
            Tenés {previous.attempts} intento{previous.attempts > 1 ? "s" : ""} registrado{previous.attempts > 1 ? "s" : ""}.
            {" "}Este es tu resultado vigente:
          </p>

          <div className={`cex-prev-score cex-prev-score--${passedBefore ? "passed" : "failed"}`}>
            <div>
              <span className="cex-prev-label">{passedBefore ? "// MEJOR RESULTADO" : "// MEJOR INTENTO"}</span>
              <span className="cex-prev-pct">{pct(previous.bestScore)}</span>
            </div>
            <span className={`cex-prev-badge cex-prev-badge--${passedBefore ? "passed" : "failed"}`}>
              {passedBefore ? "✓ APROBADA" : "✕ NO APROBADA"}
            </span>
          </div>
          <div className="cex-prev-bar">
            <i style={{ width: pct(previous.bestScore) }} />
            <b style={{ left: pct(passing) }} title={`Mínimo ${pct(passing)}`} />
          </div>

          <div className="cex-prev-stats">
            <div><span>// INTENTOS</span><strong>{previous.attempts}</strong></div>
            <div><span>// ÚLTIMO INTENTO</span><strong>{pct(previous.lastScore)}</strong><em>{lastResultLabel(previous.lastResult)} · {fmtDate(previous.lastAttemptAt)}</em></div>
            <div><span>// MÍNIMO PARA APROBAR</span><strong>{pct(passing)}</strong></div>
          </div>

          {passedBefore ? (
            <div className="cex-alert cex-alert--ok">
              <span className="cex-alert-icon">★</span>
              <span className="cex-alert-text">
                Ya estás certificado/a con un {pct(previous.bestScore)}. Podés volver a rendir para mejorar
                tu nota: si sacás una calificación inferior <strong>no vas a perder tu certificación ni tu
                progreso</strong>, y si superás el {pct(previous.bestScore)}, ese nuevo porcentaje pasa a ser tu
                resultado oficial.
              </span>
            </div>
          ) : (
            <div className="cex-alert cex-alert--warning">
              <span className="cex-alert-icon">↻</span>
              <span className="cex-alert-text">
                Todavía no alcanzaste el {pct(passing)} necesario. Podés volver a rendir ahora — cada intento
                consume un voucher y se guarda siempre tu mejor resultado.
              </span>
            </div>
          )}

          <div className="cex-btn-row">
            <a href="/dashboard?tab=cursos" className="cex-btn">VOLVER</a>
            <button className="cex-btn cex-btn--accent" onClick={() => setPhase("rules")}>
              {passedBefore ? "REINTENTAR PARA MEJORAR MI NOTA →" : "REINTENTAR →"}
            </button>
          </div>
        </div>
      </div>
    );
  }

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

  if (phase === "device_check") {
    const bothPending = tabCheck === "pending" || monitorCheck === "pending";
    return (
      <div className={`cex-wrap ${isLight ? "light" : ""}`}>
        <span className="cex-eyebrow">// CERTIFICACIÓN</span>
        <h2 className="cex-title">{title}</h2>
        <div className="cex-card">
          <h3 className="cex-card-title">Verificación de integridad</h3>
          {resuming && (
            <p style={{ fontSize: "0.8rem", opacity: 0.6, marginBottom: 16 }}>
              Estás retomando un examen que ya habías empezado. Tu tiempo restante sigue corriendo.
            </p>
          )}

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
                requiere una única pantalla visible en todo momento, incluso una vez empezado.
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

  if (phase === "ready") {
    return (
      <div className={`cex-wrap ${isLight ? "light" : ""}`}>
        <span className="cex-eyebrow">// CERTIFICACIÓN</span>
        <h2 className="cex-title">{title}</h2>
        <div className="cex-card">
          <h3 className="cex-card-title">{resuming ? "Retomar examen" : "Todo listo"}</h3>
          <p style={{ fontSize: "0.85rem", opacity: 0.75, lineHeight: 1.6, marginBottom: 24 }}>
            {resuming
              ? "Vas a volver a la pregunta donde te quedaste. La pantalla pasará a modo completo y el temporizador sigue corriendo."
              : "Al tocar \"Empezar examen\" se va a consumir tu voucher, la pantalla pasará a modo completo y el temporizador de 2 horas comenzará a correr. No vas a poder pausarlo."}
          </p>
          {errorMsg && (
            <div className="cex-alert">
              <span className="cex-alert-icon">⚠</span>
              <span className="cex-alert-text">{errorMsg}</span>
            </div>
          )}
          <div className="cex-btn-row">
            <button className="cex-btn cex-btn--accent" onClick={startExam}>
              {resuming ? "RETOMAR EXAMEN →" : "EMPEZAR EXAMEN →"}
            </button>
          </div>
        </div>
      </div>
    );
  }

  if ((phase === "exam" || phase === "review") && attempt && view) {
    const q = view.question;
    const totalMs   = attempt.timeLimitMinutes * 60 * 1000;
    const pctLeft   = totalMs > 0 ? remainingMs / totalMs : 0;
    const timerClass = pctLeft <= 0.05 ? "cex-timer--danger" : pctLeft <= attempt.timeWarningPercent / 100 ? "cex-timer--warning" : "";
    const inReview = view.phase === "review";
    const canAdvance = !!q && (q.selected.length > 0 || q.flagged);
    const reviewIdx = view.review?.index ?? 0;
    const reviewLen = view.review?.queue.length ?? 0;

    return (
      <div className={`cex-wrap ${isLight ? "light" : ""}`}>
        {violationCountdown !== null && (
          <div className="cex-violation-overlay">
            <p className="cex-violation-text">
              Detectamos un segundo monitor conectado. Desconectalo ahora — si no lo hacés a
              tiempo, la certificación se va a suspender automáticamente.
            </p>
            <span className="cex-violation-countdown">{violationCountdown}s</span>
            <span className="cex-violation-sub">Tiempo restante para desconectarlo</span>
          </div>
        )}

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

        {confirmSubmit && (
          <div className="cex-modal-backdrop">
            <div className="cex-modal">
              <h3 className="cex-card-title">Enviar examen</h3>
              <p className="cex-modal-text">
                {view.progress.unanswered > 0
                  ? `Tenés ${view.progress.unanswered} pregunta${view.progress.unanswered > 1 ? "s" : ""} sin responder. `
                  : ""}
                Una vez enviado no vas a poder modificar tus respuestas. ¿Confirmás la entrega?
              </p>
              <div className="cex-btn-row">
                <button className="cex-btn" onClick={() => setConfirmSubmit(false)}>CANCELAR</button>
                <button className="cex-btn cex-btn--accent" onClick={submitExam}>SÍ, ENVIAR EXAMEN</button>
              </div>
            </div>
          </div>
        )}

        {showTimeToast && (
          <div className="cex-time-toast">
            ⏱ Queda poco tiempo — {formatDuration(remainingMs)} restantes
          </div>
        )}

        <div className="cex-exam-header">
          <span className="cex-progress-label">
            {inReview
              ? `Revisión final · ${view.progress.answered} / ${view.total} respondidas`
              : `Pregunta ${view.currentIndex + 1} de ${view.total} · ${view.progress.answered} respondidas`}
          </span>
          <span className={`cex-phase-pill cex-phase-pill--${inReview ? "review" : q?.kind ?? "ind"}`}>
            {inReview ? "Revisión" : q?.kind === "sjt" ? "Caso SJT" : q?.kind === "exp" ? "Caso exploratorio" : "Individual"}
          </span>
          <span className={`cex-timer ${timerClass}`}>{formatDuration(remainingMs)}</span>
        </div>

        <div className="cex-exam-layout">
          {/* Mapa de progreso: solo estado, sin contenido; no permite saltar
              hacia atrás. En revisión, solo las marcadas son clickeables. */}
          <aside className="cex-sidebar">
            {streamRef.current && (needsCamera || needsMic) && (
              <MonitorPanel stream={streamRef.current} camera={needsCamera} mic={needsMic} />
            )}
            <p className="cex-sidebar-title">// PROGRESO</p>
            <div className="cex-qmap">
              {view.map.map(m => {
                const reviewPos = inReview ? (view.review?.queue.findIndex(r => r.number === m.number) ?? -1) : -1;
                const isActive = inReview ? q?.number === m.number : m.state === "current";
                const clickable = reviewPos >= 0;
                return (
                  <button
                    key={m.number}
                    type="button"
                    disabled={!clickable}
                    onClick={() => clickable && goReview(reviewPos)}
                    className={[
                      "cex-qmap-cell",
                      `cex-qmap-cell--${m.state}`,
                      m.answered ? "answered" : "",
                      m.flagged ? "flagged" : "",
                      isActive ? "active" : "",
                      clickable ? "clickable" : "",
                    ].join(" ")}
                    title={m.state === "locked" ? "Pregunta todavía no alcanzada" : `Pregunta ${m.number}`}
                  >
                    {m.number}
                  </button>
                );
              })}
            </div>
            <div className="cex-qmap-legend">
              <span><i className="cex-legend-dot cex-legend-dot--answered" />Respondida</span>
              <span><i className="cex-legend-dot cex-legend-dot--flagged" />Marcada</span>
              <span><i className="cex-legend-dot" />Sin responder</span>
            </div>
          </aside>

          <div className="cex-exam-main">
            {inReview && (
              <div className="cex-review-banner">
                {reviewLen > 0
                  ? <>⚑ REVISIÓN FINAL · {reviewIdx + 1} de {reviewLen} marcadas — podés cambiar tu respuesta antes de enviar</>
                  : <>✓ LLEGASTE AL FINAL — no marcaste preguntas para revisar</>}
              </div>
            )}

            {inReview && reviewLen > 0 && (
              <div className="cex-review-list cex-review-list--inline">
                {view.review!.queue.map((r, i) => (
                  <div
                    key={r.questionId}
                    className={`cex-review-item${i === reviewIdx ? " active" : ""}`}
                    onClick={() => goReview(i)}
                  >
                    <span>Pregunta {r.number}</span>
                    <div className="cex-review-tags">
                      {r.flagged && <span className="cex-review-tag cex-review-tag--flagged">MARCADA</span>}
                      {r.answered
                        ? <span className="cex-review-tag cex-review-tag--ok">RESPONDIDA</span>
                        : <span className="cex-review-tag cex-review-tag--unanswered">SIN RESPONDER</span>}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {q && q.case && (
              <>
                <CaseContextPanel info={q.case} defaultOpen={inReview || q.case.position === 1} />
                {q.case.transitions.map(t => (
                  <div
                    key={t.beforePosition}
                    className={`cex-transition-wrap${t.isNew && !inReview ? " is-new" : ""}`}
                    dangerouslySetInnerHTML={{ __html: t.html }}
                  />
                ))}
              </>
            )}

            {q && (
              <div className="cex-question-card">
                <div className="cex-question-head">
                  <div>
                    <span className="cex-question-module">
                      {inReview ? `Revisión · Pregunta ${q.number}` : `Pregunta ${q.number} de ${view.total}`}
                      {q.module ? ` · ${q.module}` : ""}
                    </span>
                    <div className="cex-question-meta">
                      <span className={`cex-badge cex-badge--${q.kind}`}>
                        {q.kind === "sjt" ? "SJT" : q.kind === "exp" ? "Exploratorio" : "Individual"}
                      </span>
                      {q.difficulty && <span className="cex-badge">{q.difficulty}</span>}
                      <span className="cex-badge">{responseTypeLabel(q.responseType)}</span>
                    </div>
                  </div>
                  <button
                    className={`cex-flag-btn${q.flagged ? " active" : ""}`}
                    onClick={() => toggleFlag(q)}
                  >
                    {q.flagged ? "★ MARCADA PARA REVISAR" : "☆ MARCAR PARA REVISAR"}
                  </button>
                </div>

                <QuestionText text={q.text} />

                {q.responseType === "multi" && (
                  <p className="cex-ms-hint">Seleccioná todas las opciones que correspondan</p>
                )}

                <div className="cex-options">
                  {q.options.map((opt, i) => (
                    <button
                      key={`${q.id}-${i}`}
                      className={`cex-option${q.responseType === "multi" ? " cex-option--multi" : ""}${q.selected.includes(i) ? " selected" : ""}`}
                      onClick={() => selectOption(q, i)}
                    >
                      <span className="cex-option-letter">
                        {q.responseType === "multi" ? (q.selected.includes(i) ? "✓" : "") : LETTERS[i]}
                      </span>
                      <span className="cex-option-text">{renderInline(opt)}</span>
                    </button>
                  ))}
                </div>

                <div className="cex-question-footer">
                  <div className="cex-btn-row" style={{ marginTop: 0 }}>
                    {!inReview && (
                      <button className="cex-btn cex-btn--accent" disabled={!canAdvance || navBusy} onClick={goNext}>
                        {view.isLast ? "IR A REVISIÓN FINAL →" : "SIGUIENTE →"}
                      </button>
                    )}
                    {inReview && reviewIdx < reviewLen - 1 && (
                      <button className="cex-btn" disabled={navBusy} onClick={() => goReview(reviewIdx + 1)}>
                        SIGUIENTE MARCADA →
                      </button>
                    )}
                    {inReview && (
                      <button className="cex-btn cex-btn--accent" onClick={() => setConfirmSubmit(true)}>
                        ENVIAR EXAMEN A VALIDACIÓN
                      </button>
                    )}
                  </div>
                  <span className="cex-nav-hint">
                    {inReview
                      ? "Podés modificar solo las preguntas marcadas."
                      : canAdvance
                        ? "No vas a poder volver a esta pregunta salvo que la marques."
                        : "Respondé o marcá la pregunta para poder avanzar."}
                  </span>
                </div>
              </div>
            )}

            {inReview && !q && (
              <div className="cex-card" style={{ margin: 0, maxWidth: "none" }}>
                <h3 className="cex-card-title">Revisión final</h3>
                <p style={{ fontSize: "0.82rem", opacity: 0.7, marginBottom: 20 }}>
                  Respondiste {view.progress.answered} de {view.total} preguntas. Una vez enviado, no
                  vas a poder modificar tus respuestas.
                </p>
                <div className="cex-btn-row">
                  <button className="cex-btn cex-btn--accent" onClick={() => setConfirmSubmit(true)}>
                    ENVIAR EXAMEN A VALIDACIÓN
                  </button>
                </div>
              </div>
            )}

            {errorMsg && (
              <div className="cex-alert" style={{ marginTop: 20 }}>
                <span className="cex-alert-icon">⚠</span>
                <span className="cex-alert-text">{errorMsg}</span>
              </div>
            )}
          </div>
        </div>

      </div>
    );
  }

  // ── Certificación suspendida por violación de integridad ────────────────
  if (phase === "result" && suspendedReason) {
    return (
      <div className={`cex-wrap ${isLight ? "light" : ""}`}>
        <div className="cex-suspended">
          <div className="cex-suspended-badge">🚫</div>
          <h2 className="cex-result-title">CERTIFICACIÓN SUSPENDIDA</h2>
          <p className="cex-result-score">{violationReasonLabel(suspendedReason)}</p>
          <p style={{ fontSize: "0.8rem", opacity: 0.6, marginBottom: 28 }}>
            Este intento quedó registrado. Vas a necesitar un nuevo voucher para volver a rendir.
          </p>
          <a href="/dashboard?tab=cursos" className="cex-btn cex-btn--accent">
            VOLVER AL DASHBOARD
          </a>
        </div>
      </div>
    );
  }

  // ── Resultado final (todo calculado por el servidor) ────────────────────
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
            {result.passed
              ? (result.wasCertified ? (result.isNewBest ? "¡MEJORASTE TU NOTA!" : "APROBADO") : "¡CERTIFICADO!")
              : result.expired ? "TIEMPO AGOTADO"
              : result.wasCertified ? "INTENTO REGISTRADO" : "NO APROBADO"}
          </h2>
          <p className="cex-result-score">
            Puntaje {Math.round(result.score * 100)}% (mínimo {Math.round(result.passingScore * 100)}%)
            <br />
            {result.correct} / {result.total} respuestas completamente correctas
          </p>

          {/* Primera aprobación: se otorga la skill */}
          {result.passed && result.certifiedSkill && !result.wasCertified && (
            <div className="cex-alert cex-alert--ok" style={{ textAlign: "left" }}>
              <span className="cex-alert-icon">★</span>
              <span className="cex-alert-text">
                La skill <strong>{result.certifiedSkill}</strong> quedó certificada por Hidden y ya
                se muestra en tu perfil y en tus postulaciones.
              </span>
            </div>
          )}

          {/* Reintento que superó el mejor resultado anterior */}
          {result.isNewBest && result.previousBest !== null && (
            <div className="cex-alert cex-alert--ok" style={{ textAlign: "left" }}>
              <span className="cex-alert-icon">↑</span>
              <span className="cex-alert-text">
                ¡Nuevo mejor resultado! Pasaste de {pct(result.previousBest)} a {pct(result.bestScore)} y
                ya quedó registrado como tu resultado oficial.
              </span>
            </div>
          )}

          {/* Reintento por debajo del mejor, ya estaba certificado: no pierde nada */}
          {result.wasCertified && !result.isNewBest && (
            <div className="cex-alert cex-alert--ok" style={{ textAlign: "left" }}>
              <span className="cex-alert-icon">✓</span>
              <span className="cex-alert-text">
                Tu certificación sigue vigente con tu mejor resultado de <strong>{pct(result.bestScore)}</strong>.
                {" "}Este intento quedó registrado pero no reemplaza tu nota.
              </span>
            </div>
          )}

          {/* No aprobado y nunca aprobó: muestra el mejor intento si es otro */}
          {!result.certified && result.attempts > 1 && result.bestScore > result.score && (
            <div className="cex-alert cex-alert--warning" style={{ textAlign: "left" }}>
              <span className="cex-alert-icon">↻</span>
              <span className="cex-alert-text">
                Tu mejor intento sigue siendo {pct(result.bestScore)}. Podés volver a rendir con un nuevo voucher.
              </span>
            </div>
          )}

          {result.byModule.length > 0 && (
            <div className="cex-breakdown">
              {result.byModule.map(m => (
                <div key={m.module} className="cex-breakdown-row">
                  <span className="cex-breakdown-label">{m.module}</span>
                  <span className="cex-breakdown-bar"><i style={{ width: `${Math.round(m.score * 100)}%` }} /></span>
                  <span className="cex-breakdown-pct">{Math.round(m.score * 100)}%</span>
                </div>
              ))}
            </div>
          )}

          <a href="/dashboard?tab=cursos" className="cex-btn cex-btn--accent">
            VOLVER AL DASHBOARD
          </a>
        </div>
      </div>
    );
  }

  return null;
}