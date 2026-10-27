import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { createPortal } from "react-dom";
import axios from "axios";
import { Document, Page, pdfjs } from "react-pdf";
import "react-pdf/dist/Page/AnnotationLayer.css";
import "react-pdf/dist/Page/TextLayer.css";
import "./soc1Course.css";
import { UseSession } from "../../../contexts/SessionContext";
import { UseTheme } from "../../../contexts/ThemeContext";

// Worker de PDF.js — apunta al archivo en node_modules
pdfjs.GlobalWorkerOptions.workerSrc = new URL(
  "pdfjs-dist/build/pdf.worker.min.mjs",
  import.meta.url,
).toString();

// ══════════════════════════════════════════════════════════════════════════════
//  ESTRUCTURA DEL CURSO
//  Los PDFs NO están en /public: los sirve el backend en
//  GET /api/course/soc1/content/:stepIndex (requiere sesión + membresía y que
//  el step esté desbloqueado). El front solo conoce el stepIndex.
//  Los videos con URL absoluta (Cloudinary) se usan tal cual.
//  Tipos de step: "intro" | "video" | "pdf" | "quiz"
// ══════════════════════════════════════════════════════════════════════════════
const COURSE_ID = "soc1";
const API_URL   = import.meta.env.VITE_API_URL;
// Solo para videos locales en /public (los PDFs ya no se sirven desde acá)
const PDF_BASE  = `${import.meta.env.BASE_URL}pdf/modernSocCurso/pdf`;

// contents   → cantidad de PDFs "socN" del módulo (sin socIntro ni socFinal)
// introVideo → (opcional) video que va ANTES de socIntro, en la misma carpeta
// ⚠️ Tiene que coincidir con SOC1_MODULE_SIZES del backend (config/courses.js):
//    steps del módulo = [video] + socIntro + contents + socFinal + quiz
const MODULES_CONFIG: { contents: number; introVideo?: string }[] = [
  { contents: 6, introVideo: "https://res.cloudinary.com/dfpomipab/video/upload/v1792174664/Video_Modern_Soc_Operations_Baja_Cali_lm9kwg.mp4" }, // Módulo 1 → 10 steps (video + 9)
  { contents: 8  }, // Módulo 2 → 11 steps
  { contents: 9  }, // Módulo 3 → 12 steps
  { contents: 11 }, // Módulo 4 → 14 steps
  { contents: 8  }, // Módulo 5 → 11 steps
  { contents: 7  }, // Módulo 6 → 10 steps
  { contents: 7  }, // Módulo 7 → 10 steps
  { contents: 7  }, // Módulo 8 → 10 steps
];

interface CourseStep {
  type:          "intro" | "video" | "pdf" | "quiz";
  title:         string;
  description?:  string;
  src?:          string; // video
  moduleNumber?: number; // quiz — las preguntas las sirve el backend
}

function buildModuleSteps(moduleNumber: number, contents: number, introVideo?: string): CourseStep[] {
  const file = (name: string) => `${PDF_BASE}/Modulo${moduleNumber}/${name}`;
  // Si es una URL absoluta (Cloudinary, etc.) se usa tal cual; si no, se busca en /public
  const resolve = (name: string) => (/^https?:\/\//i.test(name) ? name : file(name));

  return [
    ...(introVideo
      ? [{ type: "video" as const, title: `Módulo ${moduleNumber} — Video introductorio`, src: resolve(introVideo) }]
      : []),
    // El archivo de cada PDF lo resuelve el backend a partir del stepIndex
    { type: "pdf", title: `Módulo ${moduleNumber} — Introducción` },
    ...Array.from({ length: contents }, (_, i): CourseStep => ({
      type:  "pdf",
      title: `Módulo ${moduleNumber} — Contenido ${i + 1}`,
    })),
    { type: "pdf",  title: `Módulo ${moduleNumber} — Cierre` },
    { type: "quiz", title: `Módulo ${moduleNumber} — Quiz final`, moduleNumber },
  ];
}

const COURSE_STEPS: CourseStep[] = MODULES_CONFIG.flatMap((m, i) => buildModuleSteps(i + 1, m.contents, m.introVideo));

const TOTAL_STEPS   = COURSE_STEPS.length; // 88
const PASSING_SCORE = 0.70;

// ══════════════════════════════════════════════════════════════════════════════
//  Agrupación visual de steps en módulos (solo presentación)
// ══════════════════════════════════════════════════════════════════════════════
interface CourseModule {
  key:         string;
  title:       string;
  icon:        string;
  stepIndices: number[];
}

function buildModules(steps: CourseStep[]): CourseModule[] {
  const modules: CourseModule[] = [];
  let moduleNum = 0;
  let i = 0;
  while (i < steps.length) {
    const step = steps[i];

    if (step.type === "intro") {
      modules.push({ key: "intro", title: step.title, icon: "◈", stepIndices: [i] });
      i++;
      continue;
    }

    moduleNum++;
    const stepIndices: number[] = [];
    while (i < steps.length && steps[i].type !== "intro") {
      stepIndices.push(i);
      const wasQuiz = steps[i].type === "quiz";
      i++;
      if (wasQuiz) break; // el quiz cierra el módulo
    }
    modules.push({ key: `modulo-${moduleNum}`, title: `Módulo ${moduleNum}`, icon: "▣", stepIndices });
  }
  return modules;
}

const COURSE_MODULES = buildModules(COURSE_STEPS);

const STEP_ICONS: Record<CourseStep["type"], string> = {
  intro: "◈", video: "▶", pdf: "📄", quiz: "✎",
};

// ══════════════════════════════════════════════════════════════════════════════
//  TIPOS
// ══════════════════════════════════════════════════════════════════════════════
interface QuizResult {
  score:         number;
  passed:        boolean;
  attempts:      number;
  lastAttemptAt: string;
}

interface Progress {
  _id:            string;
  currentStep:    number;
  completedSteps: number[];
  quizResults:    Record<string, QuizResult>;
  startedAt:      string;
  completedAt:    string | null;
  isCompleted:    boolean;
}

// Lo que manda el backend — sin respuesta correcta
interface QuizQuestion {
  id:         string;
  type:       "multiple" | "truefalse";
  question:   string;
  prompt?:    string;
  statement?: string;
  options:    string[];
}

interface QuizAnswer {
  questionId: string;
  answer:     string; // texto de la opción elegida
}

interface QuizSubmitResult {
  score:   number;
  passed:  boolean;
  correct: number;
  total:   number;
}

// ══════════════════════════════════════════════════════════════════════════════
//  HELPERS
// ══════════════════════════════════════════════════════════════════════════════

// Fisher–Yates — mezcla sin sesgo y sin mutar el original
function shuffle<T>(items: T[]): T[] {
  const arr = [...items];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

// Mezcla el orden de las preguntas y, dentro de cada una, el de sus opciones
function shuffleQuiz(questions: QuizQuestion[]): QuizQuestion[] {
  return shuffle(questions).map(q => ({ ...q, options: shuffle(q.options) }));
}

// ══════════════════════════════════════════════════════════════════════════════
//  SUB-COMPONENTES
// ══════════════════════════════════════════════════════════════════════════════

// ── Barra de progreso ─────────────────────────────────────────────────────────
function ProgressBar({ completed, total }: { completed: number; total: number }) {
  const pct = Math.round((completed / total) * 100);
  return (
    <div className="sc-progress-wrap">
      <div className="sc-progress-bar">
        <div className="sc-progress-fill" style={{ width: `${pct}%` }} />
      </div>
      <span className="sc-progress-label">{pct}% completado · {completed}/{total} etapas</span>
    </div>
  );
}

// ── Viewer de Video ───────────────────────────────────────────────────────────
function VideoViewer({ src }: { src: string }) {
  return (
    <div className="sc-video-wrap">
      <video
        className="sc-video"
        controls
        controlsList="nodownload"
        onContextMenu={(e) => e.preventDefault()}
        preload="metadata"
      >
        <source src={src} type="video/mp4" />
        Tu navegador no soporta reproducción de video.
      </video>
    </div>
  );
}

// ── Viewer de PDF ─────────────────────────────────────────────────────────────
// Un único <Document> (el PDF se descarga una sola vez). La <Page> se
// renderiza inline o dentro del overlay de pantalla completa vía portal — el
// contexto de react-pdf atraviesa portales, así que no hace falta un segundo
// Document.
//
// Protección de contenido:
//  - sin capa de texto ni de anotaciones → no hay texto en el DOM para copiar
//  - sin links al archivo, click derecho / arrastre / copiar bloqueados
//  - Ctrl/Cmd + S y Ctrl/Cmd + P bloqueados mientras el visor está montado
//  - @media print oculta el visor (ver CSS)
function PdfViewer({ src, title }: { src: string; title: string }) {
  const { theme } = UseTheme();

  const [numPages, setNumPages] = useState(0);
  const [page,     setPage]     = useState(1);
  const [loading,  setLoading]  = useState(true);
  const [error,    setError]    = useState(false);
  const [ratio,    setRatio]    = useState<number | null>(null); // ancho/alto de la página
  const [isFs,     setIsFs]     = useState(false);

  const wrapRef  = useRef<HTMLDivElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const touchX   = useRef<number | null>(null);

  const [width,     setWidth]     = useState(0);
  const [stageSize, setStageSize] = useState({ w: 0, h: 0 });

  const goPrev = useCallback(() => setPage(p => Math.max(1, p - 1)), []);
  const goNext = useCallback(() => setPage(p => Math.min(numPages || 1, p + 1)), [numPages]);

  // El PDF se pide al backend con la cookie de sesión (no está en /public)
  const file = useMemo(() => ({ url: src, withCredentials: true }), [src]);

  // ── Ancho del contenedor inline ────────────────────────────────────────
  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const obs = new ResizeObserver(([entry]) => setWidth(Math.floor(entry.contentRect.width)));
    obs.observe(el);
    setWidth(el.clientWidth);
    return () => obs.disconnect();
  }, []);

  // ── Tamaño del escenario en pantalla completa ──────────────────────────
  useEffect(() => {
    if (!isFs) return;
    const el = stageRef.current;
    if (!el) return;
    const obs = new ResizeObserver(([entry]) => {
      setStageSize({
        w: Math.floor(entry.contentRect.width),
        h: Math.floor(entry.contentRect.height),
      });
    });
    obs.observe(el);
    return () => obs.disconnect();
  }, [isFs]);

  // ── Pantalla completa ──────────────────────────────────────────────────
  // Se pide fullscreen nativo sobre <html> dentro del click (gesto del
  // usuario) y además se muestra el overlay fijo. En iPhone, donde Safari no
  // soporta fullscreen de elementos, el overlay solo ya ocupa toda la pantalla.
  const openFs = () => {
    setIsFs(true);
    const root = document.documentElement as HTMLElement & { webkitRequestFullscreen?: () => void };
    if (document.fullscreenElement) return;
    if (root.requestFullscreen) {
      root.requestFullscreen().catch(() => { /* overlay igual funciona */ });
    } else if (root.webkitRequestFullscreen) {
      root.webkitRequestFullscreen();
    }
  };

  const closeFs = useCallback(() => {
    setIsFs(false);
    if (document.fullscreenElement && document.exitFullscreen) {
      document.exitFullscreen().catch(() => {});
    }
  }, []);

  // Si el usuario sale del fullscreen nativo (Esc del navegador), cerramos el overlay
  useEffect(() => {
    const onChange = () => { if (!document.fullscreenElement) setIsFs(false); };
    document.addEventListener("fullscreenchange", onChange);
    return () => document.removeEventListener("fullscreenchange", onChange);
  }, []);

  // Bloquear el scroll del body con el overlay abierto
  useEffect(() => {
    if (!isFs) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = prev; };
  }, [isFs]);

  // Al desmontar (cambio de step) salir del fullscreen nativo si quedó activo
  useEffect(() => () => {
    if (document.fullscreenElement && document.exitFullscreen) {
      document.exitFullscreen().catch(() => {});
    }
  }, []);

  // ── Teclado: flechas para paginar + bloqueo de guardar/imprimir ───────
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable)) return;

      const mod = e.ctrlKey || e.metaKey;
      if (mod && ["s", "p"].includes(e.key.toLowerCase())) {
        e.preventDefault();
        return;
      }
      if (mod || e.altKey || !numPages) return;

      const nextKeys = isFs ? ["ArrowRight", "ArrowDown", "PageDown", " "] : ["ArrowRight", "PageDown"];
      const prevKeys = isFs ? ["ArrowLeft",  "ArrowUp",   "PageUp"]        : ["ArrowLeft",  "PageUp"];

      if (nextKeys.includes(e.key))      { e.preventDefault(); goNext(); }
      else if (prevKeys.includes(e.key)) { e.preventDefault(); goPrev(); }
      else if (isFs && e.key === "Home") { e.preventDefault(); setPage(1); }
      else if (isFs && e.key === "End")  { e.preventDefault(); setPage(numPages); }
      else if (isFs && e.key === "Escape") { e.preventDefault(); closeFs(); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [numPages, isFs, goNext, goPrev, closeFs]);

  // ── Swipe en mobile (pantalla completa) ───────────────────────────────
  const onTouchStart = (e: React.TouchEvent) => { touchX.current = e.touches[0].clientX; };
  const onTouchEnd   = (e: React.TouchEvent) => {
    if (touchX.current === null) return;
    const dx = e.changedTouches[0].clientX - touchX.current;
    touchX.current = null;
    if (Math.abs(dx) < 50) return;
    if (dx < 0) goNext(); else goPrev();
  };

  const blockEvent = (e: React.SyntheticEvent) => e.preventDefault();

  const onLoadSuccess = ({ numPages }: { numPages: number }) => {
    setNumPages(numPages);
    setLoading(false);
  };

  const onLoadError = () => {
    setLoading(false);
    setError(true);
  };

  // Guardamos la proporción de la página para encajarla en pantalla completa
  const onPageLoad = (p: { getViewport: (o: { scale: number }) => { width: number; height: number } }) => {
    const vp = p.getViewport({ scale: 1 });
    if (vp.height > 0) setRatio(vp.width / vp.height);
  };

  // En pantalla completa la página entra entera: limita ancho o alto, lo que llegue primero
  const fsWidth = (() => {
    if (!stageSize.w || !stageSize.h) return 0;
    if (!ratio) return stageSize.w;
    return Math.floor(Math.min(stageSize.w, stageSize.h * ratio));
  })();

  if (error) {
    return (
      <div className="sc-pdf-error">
        <span>No se pudo cargar el PDF.</span>
        <span style={{ fontSize: "0.72rem", opacity: 0.5 }}>
          Verificá tu conexión o tu membresía.
        </span>
      </div>
    );
  }

  const pagination = (variant: "inline" | "fs") => (
    <div className={`sc-pdf-pagination${variant === "fs" ? " sc-pdf-pagination--fs" : ""}`}>
      <button className="sc-pdf-page-btn" onClick={goPrev} disabled={page === 1} aria-label="Página anterior">
        ← ANTERIOR
      </button>
      <span className="sc-pdf-page-info">Página {page} / {numPages}</span>
      <button className="sc-pdf-page-btn" onClick={goNext} disabled={page === numPages} aria-label="Página siguiente">
        SIGUIENTE →
      </button>
    </div>
  );

  return (
    <div
      className="sc-pdf-wrap sc-protected"
      onContextMenu={blockEvent}
      onCopy={blockEvent}
      onCut={blockEvent}
      onDragStart={blockEvent}
    >
      <div
        className={`sc-pdf-canvas-container${loading ? " is-loading" : ""}${isFs ? " is-fs-open" : ""}`}
        ref={wrapRef}
      >
        {loading && (
          <div className="sc-pdf-loading">
            <span className="sc-loading-dot" />
            <span className="sc-loading-dot" />
            <span className="sc-loading-dot" />
          </div>
        )}

        <Document file={file} onLoadSuccess={onLoadSuccess} onLoadError={onLoadError} loading="">
          {!isFs && width > 0 && (
            <Page
              pageNumber={page}
              width={width}
              renderTextLayer={false}
              renderAnnotationLayer={false}
              onLoadSuccess={onPageLoad}
              loading=""
            />
          )}

          {isFs && createPortal(
            <div
              className={`sc-wrap ${theme} sc-pdf-fs sc-protected`}
              role="dialog"
              aria-modal="true"
              aria-label={`${title} — pantalla completa`}
              onContextMenu={blockEvent}
              onCopy={blockEvent}
              onCut={blockEvent}
              onDragStart={blockEvent}
            >
              <div className="sc-pdf-fs-top">
                <span className="sc-pdf-fs-title">{title}</span>
                <button className="sc-pdf-fs-close" onClick={closeFs} aria-label="Salir de pantalla completa">
                  ✕ <span className="sc-pdf-fs-close-label">SALIR</span>
                </button>
              </div>

              <div
                className="sc-pdf-fs-stage"
                ref={stageRef}
                onTouchStart={onTouchStart}
                onTouchEnd={onTouchEnd}
              >
                {fsWidth > 0 && (
                  <Page
                    pageNumber={page}
                    width={fsWidth}
                    renderTextLayer={false}
                    renderAnnotationLayer={false}
                    onLoadSuccess={onPageLoad}
                    loading=""
                  />
                )}
              </div>

              {numPages > 0 && pagination("fs")}
              <p className="sc-pdf-fs-hint">Usá ← → del teclado para pasar de página · Esc para salir</p>
            </div>,
            document.body,
          )}
        </Document>

        {isFs && (
          <div className="sc-pdf-fs-placeholder">Leyendo en pantalla completa…</div>
        )}
      </div>

      {numPages > 0 && (
        <div className="sc-pdf-toolbar">
          {pagination("inline")}
          <button className="sc-pdf-fs-btn" onClick={openFs} aria-label="Ver en pantalla completa">
            ⛶ PANTALLA COMPLETA
          </button>
        </div>
      )}
    </div>
  );
}

// ── Quiz ──────────────────────────────────────────────────────────────────────
// Las preguntas se piden al backend (sin respuestas) y se mezclan en cada
// intento: orden de preguntas y orden de opciones. Se envía el TEXTO de la
// opción elegida junto al id de la pregunta; el backend corrige.
function QuizViewer({ stepIndex, existingResult, onSubmit }: {
  stepIndex:      number;
  existingResult: QuizResult | null;
  onSubmit:       (answers: QuizAnswer[]) => Promise<QuizSubmitResult | null>;
}) {
  const rawQuestions = useRef<QuizQuestion[]>([]);

  const [questions,  setQuestions]  = useState<QuizQuestion[]>([]);
  const [loadingQz,  setLoadingQz]  = useState(true);
  const [loadError,  setLoadError]  = useState("");
  const [answers,    setAnswers]    = useState<Record<string, string>>({});
  const [submitted,  setSubmitted]  = useState(false);
  const [score,      setScore]      = useState<number | null>(null);
  const [passed,     setPassed]     = useState(false);
  const [attempts,   setAttempts]   = useState(existingResult?.attempts ?? 0);
  const [saving,     setSaving]     = useState(false);
  const [submitErr,  setSubmitErr]  = useState("");
  const [showPrior,  setShowPrior]  = useState(!!existingResult?.passed);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoadingQz(true);
      setLoadError("");
      try {
        const { data } = await axios.get(
          `${API_URL}/api/course/${COURSE_ID}/quiz/${stepIndex}`,
          { withCredentials: true },
        );
        if (cancelled) return;
        rawQuestions.current = data.data.questions as QuizQuestion[];
        setQuestions(shuffleQuiz(rawQuestions.current));
      } catch (err: any) {
        if (cancelled) return;
        setLoadError(err.response?.data?.message ?? "No se pudo cargar el quiz.");
      } finally {
        if (!cancelled) setLoadingQz(false);
      }
    })();
    return () => { cancelled = true; };
  }, [stepIndex]);

  const answeredCount = questions.filter(q => answers[q.id] !== undefined).length;
  const allAnswered   = questions.length > 0 && answeredCount === questions.length;

  const handleSelect = (questionId: string, option: string) => {
    if (submitted) return;
    setAnswers(prev => ({ ...prev, [questionId]: option }));
  };

  const handleSubmit = async () => {
    if (!allAnswered || saving) return;
    setSaving(true);
    setSubmitErr("");

    const payload: QuizAnswer[] = questions.map(q => ({ questionId: q.id, answer: answers[q.id] }));
    const result = await onSubmit(payload);

    setSaving(false);
    if (!result) {
      setSubmitErr("No se pudo enviar el quiz. Revisá tu conexión e intentá de nuevo.");
      return;
    }

    setScore(result.score);
    setPassed(result.passed);
    setSubmitted(true);
    setAttempts(prev => prev + 1);
  };

  // Cada reintento vuelve a mezclar preguntas y opciones
  const handleRetry = () => {
    setQuestions(shuffleQuiz(rawQuestions.current));
    setAnswers({});
    setSubmitted(false);
    setScore(null);
    setPassed(false);
    setShowPrior(false);
    setSubmitErr("");
  };

  if (showPrior && existingResult) {
    return (
      <div className="sc-quiz-result sc-quiz-result--passed">
        <span className="sc-quiz-result-icon">✓</span>
        <p className="sc-quiz-result-score">
          Aprobado con {Math.round(existingResult.score * 100)}%
        </p>
        <p className="sc-quiz-result-sub">
          Intentos: {existingResult.attempts} · Podés continuar al siguiente módulo.
        </p>
        <button className="sc-btn sc-btn--ghost" onClick={handleRetry}>
          Reintentar de todas formas
        </button>
      </div>
    );
  }

  if (loadingQz) {
    return (
      <div className="sc-loading">
        <span className="sc-loading-dot" />
        <span className="sc-loading-dot" />
        <span className="sc-loading-dot" />
      </div>
    );
  }

  if (loadError) {
    return <div className="sc-pdf-error"><span>{loadError}</span></div>;
  }

  if (submitted && score !== null) {
    return (
      <div className={`sc-quiz-result${passed ? " sc-quiz-result--passed" : " sc-quiz-result--failed"}`}>
        <span className="sc-quiz-result-icon">{passed ? "✓" : "✗"}</span>
        <p className="sc-quiz-result-score">
          {Math.round(score * 100)}% — {passed ? "APROBADO" : "NO APROBADO"}
        </p>
        <p className="sc-quiz-result-sub">
          {passed
            ? "¡Excelente! Podés continuar al siguiente módulo."
            : `Necesitás al menos ${Math.round(PASSING_SCORE * 100)}% para aprobar. Intentá de nuevo.`
          }
        </p>
        <p className="sc-quiz-attempts">Intento #{attempts}</p>
        {/* Revisión — muestra lo elegido, nunca la correcta (vive en el backend) */}
        <div className="sc-quiz-review">
          {questions.map((q, i) => (
            <div key={q.id} className="sc-quiz-review-item">
              <p className="sc-quiz-review-q">{i + 1}. {q.question}</p>
              <p className="sc-quiz-review-a">
                Tu respuesta: <strong>{answers[q.id] ?? "—"}</strong>
              </p>
            </div>
          ))}
        </div>
        {!passed && (
          <button className="sc-btn sc-btn--accent" onClick={handleRetry}>
            REINTENTAR
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="sc-quiz-wrap sc-protected" onCopy={(e) => e.preventDefault()}>
      <p className="sc-quiz-subtitle">
        Respondé todas las preguntas para aprobar. Mínimo {Math.round(PASSING_SCORE * 100)}%.
        {attempts > 0 && <span className="sc-quiz-attempts"> · Intentos anteriores: {attempts}</span>}
      </p>

      {questions.map((q, qIdx) => (
        <div key={q.id} className="sc-quiz-question">
          <p className="sc-quiz-q-text">{qIdx + 1}. {q.question}</p>
          {q.statement && <blockquote className="sc-quiz-statement">“{q.statement}”</blockquote>}
          {q.prompt && <p className="sc-quiz-q-prompt">{q.prompt}</p>}

          <div className="sc-quiz-options">
            {q.options.map((opt, aIdx) => (
              <button
                key={opt}
                className={`sc-quiz-option${answers[q.id] === opt ? " selected" : ""}`}
                onClick={() => handleSelect(q.id, opt)}
              >
                <span className="sc-quiz-option-letter">{String.fromCharCode(65 + aIdx)}</span>
                {opt}
              </button>
            ))}
          </div>
        </div>
      ))}

      {submitErr && <p className="sc-quiz-error">{submitErr}</p>}

      <button
        className="sc-btn sc-btn--accent"
        onClick={handleSubmit}
        disabled={!allAnswered || saving}
      >
        {saving ? "ENVIANDO..." : `ENVIAR RESPUESTAS (${answeredCount}/${questions.length})`}
      </button>
    </div>
  );
}

// ── Pantalla de finalización ──────────────────────────────────────────────────
function CompletionScreen({ startedAt, completedAt }: { startedAt: string; completedAt: string }) {
  const start   = new Date(startedAt);
  const end     = new Date(completedAt);
  const msTotal = end.getTime() - start.getTime();
  const days    = Math.floor(msTotal / (1000 * 60 * 60 * 24));
  const hours   = Math.floor((msTotal % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));

  const fmt = (d: Date) => d.toLocaleDateString("es-AR", { day: "2-digit", month: "long", year: "numeric" });

  return (
    <div className="sc-completion">
      <div className="sc-completion-badge">✓</div>
      <h2 className="sc-completion-title">¡CURSADA COMPLETADA!</h2>
      <p className="sc-completion-sub">
        Completaste el programa <strong>SOC Analyst Level 1</strong> de Hidden Security.
      </p>
      <div className="sc-completion-dates">
        <div className="sc-completion-date-item">
          <span className="sc-completion-date-label">// INICIO</span>
          <span className="sc-completion-date-value">{fmt(start)}</span>
        </div>
        <div className="sc-completion-date-sep">→</div>
        <div className="sc-completion-date-item">
          <span className="sc-completion-date-label">// FINALIZACIÓN</span>
          <span className="sc-completion-date-value">{fmt(end)}</span>
        </div>
      </div>
      <p className="sc-completion-duration">
        Duración total: <strong>{days > 0 ? `${days} días` : ""}{days > 0 && hours > 0 ? " y " : ""}{hours > 0 ? `${hours} horas` : days === 0 ? "menos de 1 hora" : ""}</strong>
      </p>
      <div className="sc-completion-msg">
        <p>
          Ya estás apto/a para rendir la <strong>Certificación Hidden Security SOC Analyst</strong>.
          Este es el primer paso de tu carrera profesional como analista de seguridad.
        </p>
        <p>
          Accedé a la bolsa de trabajo y empezá a construir tu camino en ciberseguridad.
        </p>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
//  COMPONENTE PRINCIPAL
// ══════════════════════════════════════════════════════════════════════════════
export default function Soc1Course() {
  const { user }  = UseSession();
  const { theme } = UseTheme();

  const [progress,   setProgress]   = useState<Progress | null>(null);
  const [loading,    setLoading]    = useState(true);
  const [blocked,    setBlocked]    = useState(false);
  const [blockMsg,   setBlockMsg]   = useState("");
  const [saving,     setSaving]     = useState(false);
  const [activeStep, setActiveStep] = useState(0);
  const [showIntro,  setShowIntro]  = useState(true);

  // Módulos desplegados (pueden ser varios a la vez; solo UI, no toca progreso)
  const [expandedModules, setExpandedModules] = useState<Set<string>>(new Set());

  const toggleModule = (key: string) => {
    setExpandedModules(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const contentRef = useRef<HTMLDivElement>(null);

  // ── Cargar progreso desde backend (también valida membresía) ─────────────
  const fetchProgress = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const { data } = await axios.get(
        `${API_URL}/api/course/${COURSE_ID}/progress`,
        { withCredentials: true }
      );
      setProgress(data.data);
      setActiveStep(Math.min(data.data.currentStep ?? 0, TOTAL_STEPS - 1));
      setBlocked(false);
    } catch (err: any) {
      if (err.response?.status === 403) {
        setBlocked(true);
        setBlockMsg(err.response.data?.detail ?? "Necesitás una membresía activa.");
      }
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => { fetchProgress(); }, [fetchProgress]);

  // ── Asegurar que el módulo del step activo esté desplegado ───────────────
  useEffect(() => {
    const mod = COURSE_MODULES.find(m => m.stepIndices.includes(activeStep));
    if (!mod) return;
    setExpandedModules(prev => (prev.has(mod.key) ? prev : new Set(prev).add(mod.key)));
  }, [activeStep]);

  // ── Scroll al top del contenido al cambiar step ──────────────────────────
  useEffect(() => {
    contentRef.current?.scrollTo({ top: 0, behavior: "smooth" });
  }, [activeStep]);

  // ── Avanzar step (video / pdf / intro) ───────────────────────────────────
  // ⚠️ /progress/step RECHAZA con 400 los steps de quiz. Los quizzes avanzan
  // solo por /progress/quiz (handleQuizSubmit). handleNext nunca se llama
  // con activeStep apuntando a un quiz.
  const handleNext = async () => {
    if (!progress || saving) return;
    setSaving(true);
    try {
      const { data } = await axios.patch(
        `${API_URL}/api/course/${COURSE_ID}/progress/step`,
        { stepIndex: activeStep },
        { withCredentials: true }
      );
      setProgress(data.data);
      setActiveStep(Math.min(activeStep + 1, TOTAL_STEPS - 1));
    } catch (err) {
      console.error("Error guardando step:", err);
    } finally {
      setSaving(false);
    }
  };

  // ── Enviar quiz — el backend corrige comparando el texto de cada respuesta
  const handleQuizSubmit = async (answers: QuizAnswer[]): Promise<QuizSubmitResult | null> => {
    if (!progress) return null;
    try {
      const { data } = await axios.patch(
        `${API_URL}/api/course/${COURSE_ID}/progress/quiz`,
        { stepIndex: activeStep, answers },
        { withCredentials: true }
      );
      setProgress(data.data);
      return { score: data.score, passed: data.passed, correct: data.correct, total: data.total };
    } catch (err) {
      console.error("Error guardando quiz:", err);
      return null;
    }
  };

  // ── ¿El botón "Siguiente" está disponible? ────────────────────────────────
  const canAdvance = useCallback(() => {
    if (!progress) return false;
    const step = COURSE_STEPS[activeStep];
    if (!step) return false;

    if (step.type === "quiz") {
      const result = progress.quizResults?.[String(activeStep)];
      return !!result?.passed;
    }

    return true;
  }, [progress, activeStep]);

  const isLastStep = activeStep === TOTAL_STEPS - 1;
  const step       = COURSE_STEPS[activeStep];

  // ─────────────────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className={`sc-wrap ${theme}`}>
        <div className="sc-loading">
          <span className="sc-loading-dot" />
          <span className="sc-loading-dot" />
          <span className="sc-loading-dot" />
        </div>
      </div>
    );
  }

  // ── Sin membresía ─────────────────────────────────────────────────────────
  if (blocked) {
    return (
      <div className={`sc-wrap ${theme}`}>
        <div className="sc-blocked">
          <span className="sc-blocked-icon">🔒</span>
          <span className="sc-blocked-eyebrow">// ACCESO_RESTRINGIDO</span>
          <h2 className="sc-blocked-title">Membresía requerida</h2>
          <p className="sc-blocked-msg">{blockMsg}</p>
          <a href="/pricing" className="sc-btn sc-btn--accent sc-btn--lg">
            COMPRAR MEMBRESÍA
          </a>
        </div>
      </div>
    );
  }

  // ── Curso completado ──────────────────────────────────────────────────────
  if (progress?.isCompleted) {
    return (
      <div className={`sc-wrap ${theme}`}>
        <CompletionScreen
          startedAt={progress.startedAt}
          completedAt={progress.completedAt!}
        />
      </div>
    );
  }

  // ── Pantalla introductoria (antes de empezar) ─────────────────────────────
  if (showIntro && progress && progress.currentStep === 0 && progress.completedSteps.length === 0) {
    return (
      <div className={`sc-wrap ${theme}`}>
        <div className="sc-intro-page">
          <span className="sc-eyebrow">// SOC_ANALYST_LEVEL_1</span>
          <h1 className="sc-intro-title">
            Convertite en<br /><span>SOC Analyst</span>
          </h1>

          <div className="sc-intro-grid">
            <div className="sc-intro-card">
              <h3>¿Qué es un SOC Analyst?</h3>
              <p>Un analista de Centros de Operaciones de Seguridad (SOC) es el profesional encargado de monitorear, detectar y responder a incidentes de ciberseguridad en tiempo real. Es la primera línea de defensa de una organización contra amenazas digitales.</p>
            </div>
            <div className="sc-intro-card">
              <h3>¿A qué se dedica?</h3>
              <p>Analiza alertas de seguridad, investiga anomalías en sistemas y redes, correlaciona eventos en plataformas SIEM, ejecuta playbooks de respuesta a incidentes y documenta hallazgos para mejorar la postura de seguridad.</p>
            </div>
            <div className="sc-intro-card">
              <h3>¿Por qué cursarlo?</h3>
              <p>La demanda de analistas SOC creció más del 300% en los últimos 5 años. Es una de las posiciones más buscadas en ciberseguridad, con salarios competitivos y posibilidades reales de crecimiento hacia roles de pentesting, threat hunting e IR.</p>
            </div>
            <div className="sc-intro-card">
              <h3>Salidas laborales</h3>
              <p>SOC Analyst Tier 1/2/3, Incident Responder, Threat Hunter, Security Engineer, CISO. Empleadores: bancos, telecomunicaciones, empresas tecnológicas, gobierno, consultoras de ciberseguridad y proveedores MSSPs.</p>
            </div>
          </div>

          <div className="sc-intro-details">
            <div className="sc-intro-detail-item">
              <span className="sc-intro-detail-label">// MÓDULOS</span>
              <span className="sc-intro-detail-value">{COURSE_MODULES.length}</span>
            </div>
            <div className="sc-intro-detail-item">
              <span className="sc-intro-detail-label">// VIDEOS</span>
              <span className="sc-intro-detail-value">{COURSE_STEPS.filter(s => s.type === "video").length}</span>
            </div>
            <div className="sc-intro-detail-item">
              <span className="sc-intro-detail-label">// PDFs</span>
              <span className="sc-intro-detail-value">{COURSE_STEPS.filter(s => s.type === "pdf").length}</span>
            </div>
            <div className="sc-intro-detail-item">
              <span className="sc-intro-detail-label">// QUIZZES</span>
              <span className="sc-intro-detail-value">{COURSE_STEPS.filter(s => s.type === "quiz").length}</span>
            </div>
            <div className="sc-intro-detail-item">
              <span className="sc-intro-detail-label">// APROBACIÓN</span>
              <span className="sc-intro-detail-value">70%</span>
            </div>
          </div>

          <button
            className="sc-btn sc-btn--accent sc-btn--lg"
            onClick={() => setShowIntro(false)}
          >
            COMENZAR CURSO →
          </button>
        </div>
      </div>
    );
  }

  // ── Vista principal del curso ─────────────────────────────────────────────
  return (
    <div className={`sc-wrap ${theme}`}>

      {/* Header global */}
      <div className="sc-header">
        <div>
          <span className="sc-eyebrow">// SOC_ANALYST_LEVEL_1</span>
          <h2 className="sc-header-title">{step?.title}</h2>
        </div>
        <ProgressBar
          completed={progress?.completedSteps.length ?? 0}
          total={TOTAL_STEPS}
        />
        <p>Curso desarrolado y creado por Hidden Security. <br /><br />Desarrollá las habilidades técnicas, operativas y analíticas que hoy demandan los Centros de Operaciones de Seguridad. Aprendé a investigar alertas, correlacionar eventos, responder incidentes y trabajar junto a herramientas de automatización e inteligencia artificial en escenarios inspirados en situaciones reales.</p>
      </div>

      <div className="sc-modules" ref={contentRef}>
        {COURSE_MODULES.map((mod) => {
          const isExpanded     = expandedModules.has(mod.key);
          const completedInMod = mod.stepIndices.filter(i => progress?.completedSteps.includes(i)).length;
          const totalInMod     = mod.stepIndices.length;
          const moduleDone     = completedInMod === totalInMod;
          const hasActiveStep  = mod.stepIndices.includes(activeStep);

          return (
            <div
              key={mod.key}
              className={`sc-module${isExpanded ? " expanded" : ""}${moduleDone ? " done" : ""}`}
            >
              <button
                className="sc-module-header"
                onClick={() => toggleModule(mod.key)}
              >
                <span className="sc-module-icon">{moduleDone ? "✓" : mod.icon}</span>
                <span className="sc-module-title">{mod.title}</span>
                <span className="sc-module-meta">{completedInMod}/{totalInMod}</span>
                <span className="sc-module-chevron">{isExpanded ? "▲" : "▼"}</span>
              </button>

              {isExpanded && (
                <div className="sc-module-body">
                  <aside className="sc-module-aside">
                    <p className="sc-module-aside-title">// CONTENIDO</p>
                    <ul className="sc-module-aside-list">
                      {mod.stepIndices.map((i) => {
                        const s      = COURSE_STEPS[i];
                        const done   = progress?.completedSteps.includes(i) ?? false;
                        const active = i === activeStep;
                        const locked = i > activeStep && !done;
                        return (
                          <li
                            key={i}
                            className={`sc-module-aside-item${active ? " active" : ""}${done ? " done" : ""}${locked ? " locked" : ""}`}
                            onClick={() => !locked && setActiveStep(i)}
                            title={locked ? "Completá la etapa anterior para desbloquear" : s.title}
                          >
                            <span className="sc-module-aside-icon">{done ? "✓" : STEP_ICONS[s.type]}</span>
                            <span className="sc-module-aside-label">{s.title}</span>
                          </li>
                        );
                      })}
                    </ul>
                  </aside>

                  <div className="sc-module-stage">
                    {hasActiveStep ? (
                      <>
                        {step?.description && step.type !== "quiz" && (
                          <p className="sc-step-description">{step.description}</p>
                        )}

                        {step?.type === "intro" && (
                          <div className="sc-step-intro">
                            <p>Bienvenido/a al curso SOC Analyst Level 1. Avanzá por cada módulo a tu ritmo — tu progreso se guarda automáticamente.</p>
                          </div>
                        )}

                        {step?.type === "video" && step.src && (
                          <VideoViewer key={activeStep} src={step.src} />
                        )}

                        {step?.type === "pdf" && (
                          <PdfViewer
                            key={activeStep}
                            src={`${API_URL}/api/course/${COURSE_ID}/content/${activeStep}`}
                            title={step.title}
                          />
                        )}

                        {step?.type === "quiz" && (
                          <QuizViewer
                            key={activeStep}
                            stepIndex={activeStep}
                            existingResult={progress?.quizResults?.[String(activeStep)] ?? null}
                            onSubmit={handleQuizSubmit}
                          />
                        )}

                        <div className="sc-nav">
                          {activeStep > 0 && (
                            <button
                              className="sc-btn sc-btn--ghost"
                              onClick={() => setActiveStep(prev => Math.max(0, prev - 1))}
                            >
                              ← ANTERIOR
                            </button>
                          )}

                          {step?.type !== "quiz" && !isLastStep && (
                            <button
                              className="sc-btn sc-btn--accent"
                              onClick={handleNext}
                              disabled={!canAdvance() || saving}
                            >
                              {saving ? "GUARDANDO..." : "SIGUIENTE →"}
                            </button>
                          )}

                          {step?.type !== "quiz" && isLastStep && canAdvance() && (
                            <button
                              className="sc-btn sc-btn--accent sc-btn--lg"
                              onClick={handleNext}
                              disabled={saving}
                            >
                              {saving ? "GUARDANDO..." : "FINALIZAR CURSO ✓"}
                            </button>
                          )}

                          {step?.type === "quiz" && canAdvance() && !isLastStep && (
                            <button
                              className="sc-btn sc-btn--accent"
                              onClick={() => setActiveStep(prev => Math.min(prev + 1, TOTAL_STEPS - 1))}
                            >
                              SIGUIENTE →
                            </button>
                          )}
                        </div>
                      </>
                    ) : (
                      <div className="sc-module-placeholder">
                        <p>Seleccioná un contenido del módulo para visualizarlo.</p>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}