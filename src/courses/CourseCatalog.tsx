import { useState, useEffect, type JSX } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import Soc1Course from "../courses/paidCourses/soc1/Soc1Course";
import { UseSession } from "../contexts/SessionContext"; // ajustá esta ruta si difiere
import "./courseCatalog.css";

// ══════════════════════════════════════════════════════════════════════════════
//  CATÁLOGO — agregá cursos acá cuando estén listos
//  status: "available" | "soon"
//  component: el componente React o null si es "soon"
// ══════════════════════════════════════════════════════════════════════════════
interface CourseMeta {
  id:          string;
  title:       string;
  subtitle:    string;
  description: string;
  tags:        string[];
  level:       string;
  duration:    string;
  status:      "available" | "soon";
  component:   (() => JSX.Element) | null;
  comingSoon?: string;
}

const CATALOG: CourseMeta[] = [
  {
    id:          "soc1",
    title:       "SOC Analyst",
    subtitle:    "Level 1",
    description: "Fundamentos de operaciones de seguridad, SIEM, análisis de amenazas y respuesta a incidentes.",
    tags:        ["SIEM", "Incident Response", "Threat Hunting", "Splunk"],
    level:       "Inicial",
    duration:    "8 módulos",
    status:      "available",
    component:   Soc1Course,
  },
  {
    id:          "pentesting1",
    title:       "Ethical Hacking",
    subtitle:    "Level 1",
    description: "Metodologías de pentesting, reconocimiento, explotación y reporte de vulnerabilidades.",
    tags:        ["Kali Linux", "Metasploit", "OWASP", "Burp Suite"],
    level:       "Intermedio",
    duration:    "6 módulos",
    status:      "soon",
    component:   null,
    comingSoon:  "Q3 2026",
  },
  {
    id:          "dfir1",
    title:       "Digital Forensics",
    subtitle:    "& Incident Response",
    description: "Análisis forense de sistemas, recolección de evidencia, análisis de malware y respuesta avanzada.",
    tags:        ["Forensics", "Malware Analysis", "Memory Dump", "Volatility"],
    level:       "Avanzado",
    duration:    "5 módulos",
    status:      "soon",
    component:   null,
    comingSoon:  "Q4 2026",
  },
  {
    id:          "cloud-security",
    title:       "Cloud Security",
    subtitle:    "AWS & Azure",
    description: "Seguridad en entornos cloud, gestión de identidades, configuraciones seguras y monitoreo.",
    tags:        ["AWS", "Azure", "IAM", "Zero Trust"],
    level:       "Intermedio",
    duration:    "5 módulos",
    status:      "soon",
    component:   null,
    comingSoon:  "Q1 2027",
  },
  {
    id:          "osint1",
    title:       "OSINT & Reconocimiento",
    subtitle:    "Inteligencia de Fuentes Abiertas",
    description: "Técnicas de investigación en fuentes abiertas, footprinting y threat intelligence operacional.",
    tags:        ["OSINT", "Maltego", "Shodan", "Dark Web"],
    level:       "Inicial",
    duration:    "3 módulos",
    status:      "soon",
    component:   null,
    comingSoon:  "Q2 2027",
  },
];

const LEVEL_COLORS: Record<string, string> = {
  Inicial:    "#22c55e",
  Intermedio: "#f97316",
  Avanzado:   "#f43f5e",
};

// ── Progreso por curso — viene del backend (GET /api/course/progress-summary) ──
// Solo trae cursos que el usuario ya tocó (find, no upsert) -- ver comentario
// en courseRouter.js. Cursos "soon" nunca van a tener entrada acá.
interface CourseProgressSummary {
  courseId:       string;
  currentStep:    number;
  completedCount: number;
  totalSteps:     number;
  percent:        number;
  isCompleted:    boolean;
  startedAt:      string;
  completedAt:    string | null;
  // Resultado (lo calcula el backend con la mejor nota de cada quiz)
  quizzesTotal?:  number;
  quizzesTaken?:  number;
  quizzesPassed?: number;
  score?:         number | null;
  passingScore?:  number;
}

// Certificado público del usuario (GET /api/certificates/mine)
interface MyCertificate {
  certId?:      string;
  credentialId: string;
  status:       "active" | "revoked";
  url:          string;
}

type Filter = "all" | "progress" | "completed";
const FILTERS: { id: Filter; label: string }[] = [
  { id: "all",       label: "TODOS" },
  { id: "progress",  label: "EN PROCESO" },
  { id: "completed", label: "COMPLETADOS" },
];

const pct = (n: number) => `${Math.round(n * 100)}%`;

// El link del certificado es absoluto (dominio público): adentro del sitio se navega por su ruta
function certPath(url: string): string | null {
  try { return new URL(url, window.location.origin).pathname; } catch { return null; }
}

export default function CourseCatalog() {
  const { user } = UseSession();
  const navigate = useNavigate();
  const [activeCourse, setActiveCourse] = useState<string | null>(null);
  const [filter, setFilter] = useState<Filter>("all");

  // Certificado: qué card lo está buscando y error por card
  const [certLoading, setCertLoading] = useState<string | null>(null);
  const [certError,   setCertError]   = useState<Record<string, string>>({});

  // ── Progreso del usuario para todos los cursos que ya empezó ──────────────
  const [progressMap, setProgressMap] = useState<Record<string, CourseProgressSummary>>({});
  const [progressLoaded, setProgressLoaded] = useState(false);

  useEffect(() => {
    if (!user) { setProgressLoaded(true); return; }

    axios
      .get(`${import.meta.env.VITE_API_URL}/api/course/progress-summary`, { withCredentials: true })
      .then(({ data }) => {
        const map: Record<string, CourseProgressSummary> = {};
        (data.data as CourseProgressSummary[]).forEach((p) => { map[p.courseId] = p; });
        setProgressMap(map);
      })
      .catch(() => {
        // Sin progreso disponible (por ejemplo, sin membresía todavía) -- el
        // catálogo simplemente se muestra sin secciones de progreso.
      })
      .finally(() => setProgressLoaded(true));
  }, [user]);

  // Busca el certificado de finalización del alumno y abre su página pública.
  // 1) /api/certificates/mine (no necesita plan activo)
  // 2) si todavía no existe, GET /progress del curso lo emite (alumnos que
  //    terminaron antes de que hubiera certificados)
  // Si al CV le falta el nombre, se abre el curso: la pantalla final lo pide.
  const openCertificate = async (course: CourseMeta, e: React.MouseEvent) => {
    e.stopPropagation(); // no abrir el curso
    if (certLoading) return;
    setCertLoading(course.id);
    setCertError(prev => ({ ...prev, [course.id]: "" }));
    try {
      const { data } = await axios.get(`${import.meta.env.VITE_API_URL}/api/certificates/mine`, { withCredentials: true });
      const list: MyCertificate[] = Array.isArray(data?.certificates) ? data.certificates : [];
      let found = list.find(c => c.certId === `course:${course.id}`);

      if (!found) {
        const { data: prog } = await axios.get(
          `${import.meta.env.VITE_API_URL}/api/course/${course.id}/progress`,
          { withCredentials: true },
        );
        if (prog?.certificate && !prog.certificate.hasHolderName) {
          setActiveCourse(course.id); // la pantalla final pide nombre y apellido
          return;
        }
        if (prog?.certificate) found = { ...prog.certificate, status: "active" };
      }

      if (!found) {
        setCertError(prev => ({ ...prev, [course.id]: "Todavía no encontramos tu certificado. Probá de nuevo en unos minutos." }));
        return;
      }
      if (found.status === "revoked") {
        setCertError(prev => ({ ...prev, [course.id]: "Este certificado fue revocado. Contactanos si creés que es un error." }));
        return;
      }
      const path = certPath(found.url);
      if (!path) throw new Error("url inválida");
      navigate(path);
    } catch {
      setCertError(prev => ({ ...prev, [course.id]: "No pudimos obtener tu certificado. Probá de nuevo." }));
    } finally {
      setCertLoading(null);
    }
  };

  const selected = activeCourse ? CATALOG.find(c => c.id === activeCourse) : null;

  // Si hay un curso seleccionado y disponible, renderizarlo
  if (selected && selected.status === "available" && selected.component) {
    const CourseComponent = selected.component;
    return (
      <div className="cc-wrap">
        {/* Breadcrumb para volver */}
        <div className="cc-breadcrumb">
          <button className="cc-back-btn" onClick={() => setActiveCourse(null)}>
            ← CATÁLOGO
          </button>
          <span className="cc-breadcrumb-sep">/</span>
          <span className="cc-breadcrumb-current">{selected.title} {selected.subtitle}</span>
        </div>
        <CourseComponent />
      </div>
    );
  }

  // ── Split entre "en progreso" y "el resto" ─────────────────────────────────
  // Un curso cuenta como "en progreso" si está disponible, tiene al menos un
  // step completado y todavía no está terminado. Mientras no haya ninguno
  // (incluye: todavía no cargó el progreso, usuario sin sesión, o ningún
  // curso empezado), se renderiza EXACTAMENTE como antes -- una sola grilla.
  const inProgressCourses = CATALOG.filter((c) => {
    const p = progressMap[c.id];
    return c.status === "available" && !!p && p.completedCount > 0 && !p.isCompleted;
  });

  const completedCourses = CATALOG.filter((c) => c.status === "available" && !!progressMap[c.id]?.isCompleted);

  const counts: Record<Filter, number> = {
    all:       CATALOG.length,
    progress:  inProgressCourses.length,
    completed: completedCourses.length,
  };

  const hasInProgress = filter === "all" && progressLoaded && inProgressCourses.length > 0;

  const remainingCourses =
    filter === "progress"  ? inProgressCourses
    : filter === "completed" ? completedCourses
    : hasInProgress
      ? CATALOG.filter((c) => !inProgressCourses.some((ip) => ip.id === c.id))
      : CATALOG;

  // ── Card de curso -- reutilizada tanto en "continuar" como en el resto ────
  // Si hay progreso para ese curso, muestra la barra + badge de porcentaje
  // (o "COMPLETADO") en vez del badge "DISPONIBLE" de siempre.
  const renderCourseCard = (course: CourseMeta) => {
    const isSoon     = course.status === "soon";
    const levelColor = LEVEL_COLORS[course.level] ?? "#ccff00";
    const progress   = progressMap[course.id];
    const hasProgress = !isSoon && !!progress;

    let ctaLabel = "INICIAR →";
    if (hasProgress) {
      ctaLabel = progress.isCompleted ? "REPASAR CURSO →" : "CONTINUAR →";
    }

    const score   = hasProgress ? progress.score ?? null : null;
    const minimum = progress?.passingScore ?? 0.7;
    const quizzes = progress?.quizzesTotal ?? 0;

    return (
      <div
        key={course.id}
        className={`cc-card${isSoon ? " cc-card--soon" : ""}${hasProgress && progress.isCompleted ? " cc-card--completed" : ""}`}
        onClick={() => !isSoon && setActiveCourse(course.id)}
      >
        {/* Badge de estado */}
        <div className="cc-card-badges">
          <span
            className="cc-badge cc-badge--level"
            style={{ borderColor: `${levelColor}40`, color: levelColor }}
          >
            {course.level}
          </span>
          {isSoon && (
            <span className="cc-badge cc-badge--soon">
              PRÓXIMAMENTE {course.comingSoon}
            </span>
          )}
          {!isSoon && !hasProgress && (
            <span className="cc-badge cc-badge--available">
              DISPONIBLE
            </span>
          )}
          {hasProgress && progress!.isCompleted && (
            <span className="cc-badge cc-badge--completed">
              ✓ APROBADO
            </span>
          )}
          {hasProgress && !progress!.isCompleted && (
            <span className="cc-badge cc-badge--progress">
              {progress!.percent}% COMPLETADO
            </span>
          )}
        </div>

        {/* Título */}
        <div className="cc-card-title-wrap">
          <h3 className="cc-card-title">{course.title}</h3>
          <p className="cc-card-subtitle">{course.subtitle}</p>
        </div>

        {/* Descripción */}
        <p className="cc-card-description">{course.description}</p>

        {/* En proceso: avance de etapas y quizzes */}
        {hasProgress && !progress.isCompleted && (
          <div className="cc-status">
            <div className="cc-status-head">
              <span className="cc-status-label">// TU AVANCE</span>
              <span className="cc-status-pct">{progress.percent}%</span>
            </div>
            <div className="cc-progress-bar">
              <div className="cc-progress-fill" style={{ width: `${progress.percent}%` }} />
            </div>
            <span className="cc-status-meta">
              {progress.completedCount} de {progress.totalSteps} etapas
              {quizzes > 0 && ` · ${progress.quizzesPassed ?? 0}/${quizzes} quizzes aprobados`}
              {score !== null && ` · promedio ${pct(score)}`}
            </span>
          </div>
        )}

        {/* Completado: nota final + certificado */}
        {hasProgress && progress.isCompleted && (
          <div className="cc-result">
            <div className="cc-status-head">
              <span className="cc-status-label">// TU RESULTADO</span>
              <span className="cc-result-pct">{score !== null ? pct(score) : "✓"}</span>
            </div>
            <div className="cc-result-bar">
              <i style={{ width: score !== null ? pct(score) : "100%" }} />
              <b style={{ left: pct(minimum) }} />
            </div>
            <span className="cc-status-meta">
              {quizzes > 0 && `${progress.quizzesPassed ?? quizzes}/${quizzes} quizzes aprobados · `}mínimo {pct(minimum)}
              {progress.completedAt && ` · ${new Date(progress.completedAt).toLocaleDateString("es-AR")}`}
            </span>

            <button
              type="button"
              className="cc-cert-btn"
              onClick={(e) => openCertificate(course, e)}
              disabled={certLoading === course.id}
              aria-busy={certLoading === course.id}
            >
              <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <circle cx="10" cy="8" r="5" />
                <path d="M7 12l-1.5 6L10 16l4.5 2L13 12" />
              </svg>
              {certLoading === course.id ? "BUSCANDO CERTIFICADO…" : "VER MI CERTIFICADO →"}
            </button>
            {certError[course.id] && (
              <span className="cc-cert-error" role="alert">{certError[course.id]}</span>
            )}
          </div>
        )}

        {/* Tags */}
        <div className="cc-card-tags">
          {course.tags.map(t => (
            <span key={t} className="cc-tag">{t}</span>
          ))}
        </div>

        {/* Footer */}
        <div className="cc-card-footer">
          <span className="cc-card-meta">{course.duration}</span>
          {!isSoon ? (
            <span className="cc-card-cta">{ctaLabel}</span>
          ) : (
            <span className="cc-card-cta cc-card-cta--soon">EN DESARROLLO</span>
          )}
        </div>

        {/* Overlay de próximamente */}
        {isSoon && (
          <div className="cc-soon-overlay">
            <span className="cc-soon-text">PRÓXIMAMENTE</span>
            {course.comingSoon && (
              <span className="cc-soon-date">{course.comingSoon}</span>
            )}
          </div>
        )}
      </div>
    );
  };

  // Grid del catálogo
  return (
    <div className="cc-wrap">
      <div className="cc-header">
        <span className="cc-eyebrow">// CURSOS_DISPONIBLES</span>
        <h2 className="cc-title">Plataforma de <span>Formación</span></h2>
        <p className="cc-subtitle">
          Todos los cursos incluidos en tu membresía. Avanzá a tu ritmo, tu progreso se guarda automáticamente.
        </p>
      </div>

      {/* Filtros: solo si el alumno ya empezó algún curso */}
      {progressLoaded && (counts.progress > 0 || counts.completed > 0) && (
        <div className="cc-filters" role="tablist" aria-label="Filtrar cursos">
          {FILTERS.map(f => (
            <button
              key={f.id}
              role="tab"
              aria-selected={filter === f.id}
              className={`cc-filter${filter === f.id ? " active" : ""} cc-filter--${f.id}`}
              onClick={() => setFilter(f.id)}
            >
              {f.label}
              <span className="cc-filter-count">{counts[f.id]}</span>
            </button>
          ))}
        </div>
      )}

      {remainingCourses.length === 0 && (
        <div className="cc-empty">
          <span className="cc-eyebrow">// SIN_RESULTADOS</span>
          <p>{filter === "completed" ? "Todavía no completaste ningún curso." : "No tenés cursos en proceso."}</p>
        </div>
      )}

      {/* ── Sección "continuá donde lo dejaste" -- solo si hay algo en progreso ── */}
      {hasInProgress && (
        <div className="cc-continue-section">
          <span className="cc-eyebrow cc-eyebrow--sub">CURSOS EN PROCESO</span>
          <div className="cc-grid">
            {inProgressCourses.map(renderCourseCard)}
          </div>
        </div>
      )}

      {/* ── Resto de los cursos (o todos, si nadie está en progreso) ── */}
      {hasInProgress && (
        <span className="cc-eyebrow cc-eyebrow--sub">CURSOS DISPONIBLES</span>
      )}
      <div className="cc-grid">
        {remainingCourses.map(renderCourseCard)}
      </div>
    </div>
  );
}