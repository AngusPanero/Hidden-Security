import { useState, useEffect, useRef, useCallback } from "react";
import axios from "axios";
import { Document, Page, pdfjs } from "react-pdf";
import "react-pdf/dist/Page/AnnotationLayer.css";
import "react-pdf/dist/Page/TextLayer.css";
import "./soc1Course.css";
import { UseSession } from "../../../contexts/SessionContext";
import { UseTheme } from "../../../contexts/ThemeContext";
import socIntro from "../../../../public/pdf/modernSocCurso/pdf/Modulo1/socIntro.pdf"
import soc1 from "../../../../public/pdf/modernSocCurso/pdf/Modulo1/soc1.pdf"
import soc2 from "../../../../public/pdf/modernSocCurso/pdf/Modulo1/soc2.pdf"
import soc3 from "../../../../public/pdf/modernSocCurso/pdf/Modulo1/soc3.pdf"
import soc4 from "../../../../public/pdf/modernSocCurso/pdf/Modulo1/soc4.pdf"
import soc5 from "../../../../public/pdf/modernSocCurso/pdf/Modulo1/soc5.pdf"
import soc6 from "../../../../public/pdf/modernSocCurso/pdf/Modulo1/soc6.pdf"
/* import videoPrueba from "./video-curso.mp4";  */

// Worker de PDF.js — apunta al archivo en node_modules
pdfjs.GlobalWorkerOptions.workerSrc = new URL(
  "pdfjs-dist/build/pdf.worker.min.mjs",
  import.meta.url,
).toString();

// ══════════════════════════════════════════════════════════════════════════════
//  ESTRUCTURA DEL CURSO — editá aquí para organizar el contenido definitivo
//  Tipos de step: "intro" | "video" | "pdf" | "quiz"
// ══════════════════════════════════════════════════════════════════════════════
const COURSE_ID = "soc1";

interface QuizQuestion {
  question: string;
  options:  string[];
  answer:   number; // índice de la opción correcta (0-based)
}

interface CourseStep {
  type:        "intro" | "video" | "pdf" | "quiz";
  title:       string;
  description?: string;
  // video
  src?:        string;  // ruta relativa ej: "/videos/soc1/modulo1.mp4"
  // pdf
  pdfSrc?:     string;  // ruta relativa ej: "/pdfs/soc1/modulo1.pdf"
  pages?:      number;  // total de páginas del PDF
  // quiz
  questions?:  QuizQuestion[];
}

// ── Quiz final — mismas 8 preguntas para los 8 módulos, hasta tener los
// quizzes reales de cada uno (ver comentario sobre buildModuleSteps abajo) ──
const MODULO_1_QUIZ_QUESTIONS: QuizQuestion[] = [
  {
    question: "¿Qué describe mejor los tres objetivos operativos de un SOC y su relación?",
    options: [
      "Prevenir, auditar y reportar — el SOC actúa antes de que ocurra cualquier amenaza",
      "Monitorear, detectar y responder — se activan en secuencia: sin monitoreo no hay detección, y sin detección no hay respuesta",
      "Monitorear, bloquear y eliminar — el SOC toma acción directa sobre cada amenaza identificada",
      "Detectar, escalar y resolver — el equipo de L1 resuelve todos los incidentes internamente",
    ],
    answer: 1,
  },
  {
    question: "Un SOC interno se diferencia de un MSSP principalmente en que:",
    options: [
      "El SOC interno solo atiende horario laboral, mientras que el MSSP opera 24/7",
      "El MSSP es más seguro porque tiene más analistas y mejores herramientas siempre",
      "El SOC interno ofrece mayor control y alineación con las políticas de la organización, pero implica costos operativos más altos y necesidad de retención de talento",
      "El SOC interno no puede manejar incidentes críticos, por eso siempre se combina con un MSSP",
    ],
    answer: 2,
  },
  {
    question: "Un analista SOC recibe una alerta de múltiples intentos de login fallidos desde una IP extranjera. ¿Cuál es la secuencia correcta de primeros pasos ante esta alerta?",
    options: [
      "Bloquear la IP inmediatamente y notificar al usuario afectado",
      "Escalar a L2 directamente porque es una IP extranjera",
      "Revisar el contexto de la alerta: usuario afectado, cantidad de intentos, horario, si hubo login exitoso posterior y reputación de la IP antes de tomar cualquier acción",
      "Cerrar la alerta si no hubo login exitoso, ya que el bloqueo fue efectivo",
    ],
    answer: 2,
  },
  {
    question: "¿Qué afirmación describe correctamente la relación entre log, evento, alerta e incidente?",
    options: [
      "Son sinónimos con distintos niveles de urgencia",
      "Un log es el dato crudo, el evento le agrega contexto, la alerta se genera cuando coincide con una regla de detección, y el incidente es una alerta confirmada como real que requiere acción",
      "La alerta es lo que genera el analista, el incidente es lo que genera el SIEM",
      "El log y el evento son lo mismo; la diferencia real está entre alerta e incidente",
    ],
    answer: 1,
  },
  {
    question: "¿Por qué es importante documentar el análisis incluso cuando la alerta resulta ser un falso positivo?",
    options: [
      "Verdadero — no ocurrió ningún incidente real, por lo que documentarlo no tiene valor operativo",
      "Falso — documentar falsos positivos permite auditar el proceso de análisis, evitar trabajo repetido en turnos siguientes, identificar patrones de ruido para refinar las reglas del SIEM y demostrar que se actuó con criterio técnico",
    ],
    answer: 1,
  },
  {
    question: "¿Cuál de las siguientes opciones representa un escalamiento de calidad?",
    options: [
      "\"Hay actividad sospechosa en la red, revisar urgente.\"",
      "\"Se detectó una alerta de PowerShell. Severidad alta. Sin más datos por ahora.\"",
      "Activo afectado, usuario involucrado, evidencia observada con timestamps, actividad previa y posterior revisada, limitaciones de visibilidad y acción recomendada",
      "Una captura de pantalla del panel del SIEM con la alerta visible",
    ],
    answer: 2,
  },
  {
    question: "¿Por qué decimos que 'ver no significa tener permiso para divulgar'?",
    options: [
      "Verdadero — si el analista considera que la información puede ser útil para otro equipo, está habilitado a compartirla",
      "Falso — el acceso técnico no equivale a autorización para divulgar; la información de un caso solo debe circular entre quienes tienen un rol activo en ese caso, por canales corporativos aprobados. Compartir datos de un incidente fuera del canal correcto — aunque sea con buena intención — viola los protocolos de confidencialidad y puede comprometer la investigación o generar responsabilidad legal",
    ],
    answer: 1,
  },
  {
    question: "¿Cuál de las siguientes listas representa rutas de crecimiento reales desde el SOC?",
    options: [
      "Pentesting, soporte técnico de mesa de ayuda, administración de redes",
      "Incident Response / CSIRT, Threat Intelligence, Ingeniería de Seguridad (SIEM/SOAR), Forense Digital, Cloud Security, GRC",
      "Desarrollo de software seguro, marketing de ciberseguridad, gestión de proyectos de TI",
      "Solo se puede crecer dentro del SOC ascendiendo de L1 a L2 y luego a L3",
    ],
    answer: 1,
  },
];

// ── Contenido de un módulo — 7 PDFs + 1 quiz final ──────────────────────────
// Todavía solo existe contenido definitivo para el Módulo 1 (los 7 PDFs —
// socIntro, soc1..soc6 — y el quiz de arriba). Mientras no tengas los PDFs
// y preguntas reales de los módulos 2 a 8, esta misma función se llama 8
// veces para simular la estructura final de 8 módulos y poder probar bien
// la navegación step-by-step. buildModules() (más abajo) ya agrupa
// automáticamente cada tanda de steps que termina en un "quiz" como un
// módulo aparte, así que apenas reemplaces el contenido de cada llamada
// (PDFs y preguntas reales de cada módulo) no hace falta tocar nada más.
function buildModuleSteps(moduleNumber: number): CourseStep[] {
  return [
    { type: "pdf", title: `Módulo ${moduleNumber} — Introducción al SOC`,          pdfSrc: socIntro },
    { type: "pdf", title: `Módulo ${moduleNumber} — Contenido 1`,                  pdfSrc: soc1 },
    { type: "pdf", title: `Módulo ${moduleNumber} — Contenido 2`,                  pdfSrc: soc2 },
    { type: "pdf", title: `Módulo ${moduleNumber} — Contenido 3`,                  pdfSrc: soc3 },
    { type: "pdf", title: `Módulo ${moduleNumber} — Contenido 4`,                  pdfSrc: soc4 },
    { type: "pdf", title: `Módulo ${moduleNumber} — Contenido 5`,                  pdfSrc: soc5 },
    { type: "pdf", title: `Módulo ${moduleNumber} — Contenido 6`,                  pdfSrc: soc6 },
    { type: "quiz", title: `Módulo ${moduleNumber} — Quiz final`, questions: MODULO_1_QUIZ_QUESTIONS },
  ];
}

// 8 módulos — de momento los 8 repiten el contenido del Módulo 1 (simulación
// de la estructura final). Reemplazá esto por 8 llamadas explícitas con el
// contenido real de cada módulo a medida que lo tengas, ej:
//   const COURSE_STEPS: CourseStep[] = [
//     ...buildModuleSteps(1), // ← ya con el contenido real de moduleNumber:1
//     ...modulo2Steps,        // ← array armado a mano con el contenido real
//     ...
//   ];
const COURSE_STEPS: CourseStep[] = Array.from({ length: 8 }, (_, i) => buildModuleSteps(i + 1)).flat();

const TOTAL_STEPS = COURSE_STEPS.length;
const PASSING_SCORE = 0.70;

// ══════════════════════════════════════════════════════════════════════════════
//  Agrupación visual de steps en módulos
//  Solo se usa para presentación (acordeón horizontal); COURSE_STEPS y toda la
//  lógica de progreso siguen indexando por el step "plano" de siempre.
// ══════════════════════════════════════════════════════════════════════════════
interface CourseModule {
  key:          string;
  title:        string;
  icon:         string;
  stepIndices:  number[];
}

// Agrupa de forma secuencial: "intro" es su propio módulo, y luego cada
// tanda de steps no-intro se cierra apenas se procesa un "quiz" (el patrón
// real de COURSE_STEPS es video → pdf → quiz, repetido). No se usa el texto
// del título porque los PDFs no incluyen "Módulo N" en su título.
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
function VideoViewer({ src }: { src: string; }) {
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

// ── Viewer de PDF (react-pdf — canvas nativo, sin iframe, sin bloqueos) ───────
function PdfViewer({ src }: { src: string }) {
  const [numPages,  setNumPages]  = useState<number>(0);
  const [page,      setPage]      = useState(1);
  const [loading,   setLoading]   = useState(true);
  const [error,     setError]     = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(700);

  // Ancho responsivo: mide el contenedor y ajusta el canvas
  useEffect(() => {
    if (!wrapRef.current) return;
    const obs = new ResizeObserver(([entry]) => {
      setWidth(Math.floor(entry.contentRect.width));
    });
    obs.observe(wrapRef.current);
    setWidth(wrapRef.current.offsetWidth || 700);
    return () => obs.disconnect();
  }, []);

  const onLoadSuccess = ({ numPages }: { numPages: number }) => {
    setNumPages(numPages);
    setLoading(false);
  };

  const onLoadError = () => {
    setLoading(false);
    setError(true);
  };

  if (error) {
    return (
      <div className="sc-pdf-error">
        <span>No se pudo cargar el PDF.</span>
        <span style={{ fontSize: "0.72rem", opacity: 0.5 }}>
          Verificá que el archivo esté en <code>public/</code>.
        </span>
      </div>
    );
  }

  return (
    <div className="sc-pdf-wrap">
      <div className="sc-pdf-canvas-container" ref={wrapRef}>
        {loading && (
          <div className="sc-pdf-loading">
            <span className="sc-loading-dot" />
            <span className="sc-loading-dot" />
            <span className="sc-loading-dot" />
          </div>
        )}
        <Document
          file={src}
          onLoadSuccess={onLoadSuccess}
          onLoadError={onLoadError}
          loading=""
          // Deshabilitar descarga — react-pdf no expone botón de descarga por defecto
        >
          <Page
            pageNumber={page}
            width={width > 0 ? width : 700}
            renderTextLayer={false}     // sin capa de texto seleccionable
            renderAnnotationLayer={false} // sin links clicables del PDF
          />
        </Document>
      </div>

      {numPages > 0 && (
        <div className="sc-pdf-pagination">
          <button
            className="sc-pdf-page-btn"
            onClick={() => setPage(p => Math.max(1, p - 1))}
            disabled={page === 1}
          >
            ← ANTERIOR
          </button>
          <span className="sc-pdf-page-info">Página {page} / {numPages}</span>
          <button
            className="sc-pdf-page-btn"
            onClick={() => setPage(p => Math.min(numPages, p + 1))}
            disabled={page === numPages}
          >
            SIGUIENTE →
          </button>
        </div>
      )}
    </div>
  );
}

// ── Quiz ──────────────────────────────────────────────────────────────────────
function QuizViewer({ questions, existingResult, onSubmit }: {
  questions:      QuizQuestion[];
  stepIndex:      number;
  existingResult: QuizResult | null;
  onSubmit:       (answers: number[]) => Promise<{ score: number; passed: boolean; correct: number }>;
}) {
  const [answers,    setAnswers]    = useState<Record<number, number>>({});
  const [submitted,  setSubmitted]  = useState(false);
  const [score,      setScore]      = useState<number | null>(null);
  const [passed,     setPassed]     = useState(false);
  const [attempts,   setAttempts]   = useState(existingResult?.attempts ?? 0);
  const [saving,     setSaving]     = useState(false);

  const [showPrior,  setShowPrior]  = useState(!!existingResult?.passed);

  const handleSelect = (qIdx: number, aIdx: number) => {
    if (submitted) return;
    setAnswers(prev => ({ ...prev, [qIdx]: aIdx }));
  };

  const handleSubmit = async () => {
    if (Object.keys(answers).length < questions.length) return;
    setSaving(true);

    // Construir array de respuestas — el backend calcula el score
    const answersArray = questions.map((_, i) => answers[i] ?? -1);
    const result = await onSubmit(answersArray);

    setScore(result.score);
    setPassed(result.passed);
    setSubmitted(true);
    setAttempts(prev => prev + 1);
    setSaving(false);
  };

  const handleRetry = () => {
    setAnswers({});
    setSubmitted(false);
    setScore(null);
    setPassed(false);
    setShowPrior(false);
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
        {/* Revisión de respuestas — muestra opciones pero no la correcta (está en el backend) */}
        <div className="sc-quiz-review">
          {questions.map((q, i) => {
            const userAns = answers[i];
            return (
              <div key={i} className="sc-quiz-review-item">
                <p className="sc-quiz-review-q">{i + 1}. {q.question}</p>
                <p className="sc-quiz-review-a">
                  Tu respuesta: <strong>{q.options[userAns] ?? "—"}</strong>
                </p>
              </div>
            );
          })}
        </div>
        {!passed && (
          <button className="sc-btn sc-btn--accent" onClick={handleRetry}>
            REINTENTAR
          </button>
        )}
        {saving && <p className="sc-quiz-saving">Guardando resultado...</p>}
      </div>
    );
  }

  return (
    <div className="sc-quiz-wrap">
      <p className="sc-quiz-subtitle">
        Respondé todas las preguntas para aprobar. Mínimo {Math.round(PASSING_SCORE * 100)}%.
        {attempts > 0 && <span className="sc-quiz-attempts"> · Intentos anteriores: {attempts}</span>}
      </p>
      {questions.map((q, qIdx) => (
        <div key={qIdx} className="sc-quiz-question">
          <p className="sc-quiz-q-text">{qIdx + 1}. {q.question}</p>
          <div className="sc-quiz-options">
            {q.options.map((opt, aIdx) => (
              <button
                key={aIdx}
                className={`sc-quiz-option${answers[qIdx] === aIdx ? " selected" : ""}`}
                onClick={() => handleSelect(qIdx, aIdx)}
              >
                <span className="sc-quiz-option-letter">
                  {String.fromCharCode(65 + aIdx)}
                </span>
                {opt}
              </button>
            ))}
          </div>
        </div>
      ))}
      <button
        className="sc-btn sc-btn--accent"
        onClick={handleSubmit}
        disabled={Object.keys(answers).length < questions.length}
      >
        ENVIAR RESPUESTAS
      </button>
    </div>
  );
}

// ── Pantalla de finalización ──────────────────────────────────────────────────
function CompletionScreen({ startedAt, completedAt }: { startedAt: string; completedAt: string }) {
  const start    = new Date(startedAt);
  const end      = new Date(completedAt);
  const msTotal  = end.getTime() - start.getTime();
  const days     = Math.floor(msTotal / (1000 * 60 * 60 * 24));
  const hours    = Math.floor((msTotal % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));

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
{/*       <a href="/dashboard?tab=bolsa" className="sc-btn sc-btn--accent sc-btn--lg">
        VER BOLSA DE TRABAJO →
      </a> */}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
//  COMPONENTE PRINCIPAL
// ══════════════════════════════════════════════════════════════════════════════
export default function Soc1Course() {
  const { user }  = UseSession();
  const { theme } = UseTheme();

  const [progress,    setProgress]    = useState<Progress | null>(null);
  const [loading,     setLoading]     = useState(true);
  const [blocked,     setBlocked]     = useState(false);
  const [blockMsg,    setBlockMsg]    = useState("");
  const [saving,      setSaving]      = useState(false);
  const [activeStep,  setActiveStep]  = useState(0);
  const [showIntro,   setShowIntro]   = useState(true);

  // Módulos actualmente desplegados (pueden ser varios a la vez; solo UI, no toca progreso)
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
        `${import.meta.env.VITE_API_URL}/api/course/${COURSE_ID}/progress`,
        { withCredentials: true }
      );
      setProgress(data.data);
      setActiveStep(data.data.currentStep ?? 0);
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

  // ── Asegurar que el módulo que contiene el step activo esté desplegado ───
  // No cierra los demás: el alumno puede tener varios módulos abiertos para
  // ir y volver entre un paso anterior y uno posterior.
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
  // ⚠️ Esta ruta pega a /progress/step, que el backend RECHAZA con 400 si el
  // stepIndex enviado corresponde a un quiz (course.quizSteps.includes(...)).
  // Los quizzes avanzan exclusivamente por /progress/quiz (ver handleQuizSubmit),
  // que ya deja guardado el avance de progreso en esa misma request. Por eso
  // handleNext NUNCA debe llamarse con activeStep apuntando a un step de quiz.
  const handleNext = async () => {
    if (!progress || saving) return;
    setSaving(true);
    try {
      const { data } = await axios.patch(
        `${import.meta.env.VITE_API_URL}/api/course/${COURSE_ID}/progress/step`,
        { stepIndex: activeStep },
        { withCredentials: true }
      );
      setProgress(data.data);
      const nextStep = Math.min(activeStep + 1, TOTAL_STEPS - 1);
      setActiveStep(nextStep);
    } catch (err) {
      console.error("Error guardando step:", err);
    } finally {
      setSaving(false);
    }
  };

  // ── Guardar resultado del quiz ────────────────────────────────────────────
  const handleQuizSubmit = async (answers: number[]): Promise<{ score: number; passed: boolean; correct: number }> => {
    if (!progress) return { score: 0, passed: false, correct: 0 };
    try {
      const { data } = await axios.patch(
        `${import.meta.env.VITE_API_URL}/api/course/${COURSE_ID}/progress/quiz`,
        { stepIndex: activeStep, answers },
        { withCredentials: true }
      );
      setProgress(data.data);
      return { score: data.score, passed: data.passed, correct: data.correct };
    } catch (err) {
      console.error("Error guardando quiz:", err);
      return { score: 0, passed: false, correct: 0 };
    }
  };

  // ── ¿El botón "Siguiente" está disponible? ────────────────────────────────
  const canAdvance = useCallback(() => {
    if (!progress) return false;
    const step = COURSE_STEPS[activeStep];
    if (!step) return false;

    // Si es quiz, solo puede avanzar si está aprobado
    if (step.type === "quiz") {
      const result = progress.quizResults?.[String(activeStep)];
      return !!result?.passed;
    }

    // Para video / pdf / intro siempre puede avanzar (el usuario controla)
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
  // Bloques horizontales centrados, uno por módulo. Al tocar el header de un
  // módulo, se despliega en el flujo normal y empuja hacia abajo a los
  // módulos siguientes (sin superponerse). Se pueden tener varios módulos
  // abiertos a la vez para ir y volver entre pasos. Adentro, cada módulo
  // tiene su propio aside con los steps (video / pdf / quiz) que contiene.
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
                  {/* Aside propio del módulo */}
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

                  {/* Contenido del step activo dentro de este módulo */}
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
                          <VideoViewer src={step.src} />
                        )}

                        {step?.type === "pdf" && step.pdfSrc && (
                          <PdfViewer key={activeStep} src={step.pdfSrc} />
                        )}

                        {step?.type === "quiz" && step.questions && (
                          <QuizViewer
                            questions={step.questions}
                            stepIndex={activeStep}
                            existingResult={progress?.quizResults?.[String(activeStep)] ?? null}
                            onSubmit={handleQuizSubmit}
                          />
                        )}

                        {/* ── Navegación unificada (idéntica a la original) ── */}
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