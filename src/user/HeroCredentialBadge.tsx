import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import axios from "axios";
import "./heroCredentialBadge.css";

export interface CompletedCourse {
  id:           string;
  title:        string;
  completedAt?: string | null;
}


const COURSE_TITLES: Record<string, string> = {
  "soc1": "Modern SOC Operations",
};

const prettifyId = (id: string) =>
  id.replace(/[-_]+/g, " ").replace(/\b\w/g, c => c.toUpperCase());

// Usa el endpoint que ya existe: GET /api/course/progress-summary
// → { data: [{ courseId, isCompleted, completedAt, ... }] }
async function fetchCompletedCourses(): Promise<CompletedCourse[]> {
  const { data } = await axios.get(`${import.meta.env.VITE_API_URL}/api/course/progress-summary`, { withCredentials: true });
  const list: any[] = Array.isArray(data?.data) ? data.data : [];
  return list
    .filter(p => p.isCompleted === true)
    .map(p => ({
      id:          String(p.courseId),
      title:       p.title ?? COURSE_TITLES[p.courseId] ?? prettifyId(String(p.courseId)),
      completedAt: p.completedAt ?? null,
    }));
}

export interface Certification {
  key:       string;
  name:      string;         // skill otorgada (ej. "SOC Analyst")
  title?:    string | null;  // nombre de la certificación (ej. "Modern SOC Operations")
  score?:    number | null;  // mejor resultado 0..1
  passedAt?: string | null;
}

// Skills certificadas: el array `skillsCertifiedByHidden` leído DIRECTO de
// Firebase (no de la cookie, que puede estar vieja). → { data: ["SOC Analyst"] }
async function fetchCertifiedSkills(): Promise<string[]> {
  const { data } = await axios.get(`${import.meta.env.VITE_API_URL}/api/certification/my-skills`, { withCredentials: true });
  return Array.isArray(data?.data) ? data.data : [];
}

// Detalle opcional (porcentaje y fecha) de las aprobadas por examen.
// GET /api/certification/summary → { data: { [certId]: { passed, bestScore, passedAt, title, certifiedSkill } | null } }
async function fetchPassedCertifications(): Promise<Certification[]> {
  const { data } = await axios.get(`${import.meta.env.VITE_API_URL}/api/certification/summary`, { withCredentials: true });
  const map = data?.data && typeof data.data === "object" ? data.data : {};
  return Object.entries(map)
    .filter(([, s]: [string, any]) => s?.passed === true)
    .map(([certId, s]: [string, any]) => ({
      key:      certId,
      name:     s.certifiedSkill ?? s.title ?? prettifyId(certId),
      title:    s.title ?? null,
      score:    typeof s.bestScore === "number" ? s.bestScore : null,
      passedAt: s.passedAt ?? null,
    }));
}

// Fechas "YYYY-MM-DD" se toman como mediodía local para que no corran un día por la zona horaria
const fmtDate = (d?: string | null) =>
  d ? new Date(/^\d{4}-\d{2}-\d{2}$/.test(d) ? `${d}T12:00:00` : d)
        .toLocaleDateString("es-AR", { day: "2-digit", month: "long", year: "numeric" }) : null;

interface Props {
  user:  any;                   // user de la sesión (UseSession)
  theme: string;                // "dark" | "light" — el modal va por portal y necesita el tema
}

type ModalKind = "cert" | "course" | null;

export default function HeroCredentialBadge({ user, theme }: Props) {
  const [courses, setCourses] = useState<CompletedCourse[]>([]);
  const [examCerts, setExamCerts] = useState<Certification[]>([]);
  const [freshSkills, setFreshSkills] = useState<string[] | null>(null); // null = todavía no llegó
  const [modal, setModal] = useState<ModalKind>(null);

  useEffect(() => {
    if (!user?.uid) return;
    fetchCompletedCourses().then(setCourses).catch(() => setCourses([]));
    fetchCertifiedSkills().then(setFreshSkills).catch(() => setFreshSkills(null));
    fetchPassedCertifications().then(setExamCerts).catch(() => setExamCerts([]));
  }, [user?.uid]);

  // Cerrar con Escape
  useEffect(() => {
    if (!modal) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setModal(null); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [modal]);

  // Certificaciones = cada skill del array `skillsCertifiedByHidden`.
  // Fuente: Firebase (fresco); si no llegó, la copia de la sesión.
  // Si esa skill además tiene un examen aprobado, se le suma % y fecha.
  const sessionSkills: string[] = Array.isArray(user?.skillsCertifiedByHidden) ? user.skillsCertifiedByHidden : [];
  const skills = [...new Set((freshSkills ?? sessionSkills).filter(Boolean).map(String))];

  const certifications: Certification[] = skills.map(skill => {
    const exam = examCerts.find(c => c.name.toLowerCase() === skill.toLowerCase());
    return {
      key:      skill,
      name:     skill,
      title:    exam?.title ?? null,
      score:    exam?.score ?? null,
      passedAt: exam?.passedAt ?? null,
    };
  });

  const isCertified = certifications.length > 0;
  const hasCourses  = courses.length > 0;

  if (!isCertified && !hasCourses) {
    return <div className="dm-hero-badge">ESTUDIANTE</div>;
  }

  const courseLabel = courses.length === 1 ? "CURSO COMPLETADO" : `${courses.length} CURSOS COMPLETADOS`;
  const certLabel   = certifications.length === 1 ? "CERTIFICADO" : `${certifications.length} CERTIFICACIONES`;

  return (
    <>
      <div className="hcb-group">
        {isCertified && (
          <button
            type="button"
            className="dm-hero-badge hcb-btn hcb-btn--cert"
            onClick={() => setModal("cert")}
            aria-haspopup="dialog"
            title="Ver certificaciones"
          >
            {certLabel}<span className="hcb-btn-arrow"></span>
          </button>
        )}
        {hasCourses && (
          <button
            type="button"
            className="dm-hero-badge hcb-btn hcb-btn--course"
            onClick={() => setModal("course")}
            aria-haspopup="dialog"
            title="Ver cursos completados"
          >
            {courseLabel}<span className="hcb-btn-arrow"></span>
          </button>
        )}
      </div>

      {modal && createPortal(
        <div className={`hcb-overlay hcb-${theme}`} onClick={() => setModal(null)}>
          <div
            className="hcb-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="hcb-title"
            onClick={(e) => e.stopPropagation()}
          >
            <button className="hcb-close" onClick={() => setModal(null)} aria-label="Cerrar">×</button>

            {modal === "cert" ? (
              <>
                <span className="hcb-eyebrow">// CERTIFICACIONES</span>
                <h3 id="hcb-title" className="hcb-title">
                  {certifications.length === 1 ? "Estás certificado/a" : "Tus certificaciones"}
                </h3>
                <section className="hcb-section">
                  <span className="hcb-section-label">CERTIFICADO POR HIDDEN SECURITY</span>
                  <ul className="hcb-list">
                    {certifications.map(c => (
                      <li key={c.key} className="hcb-item hcb-item--cert">
                        <span className="hcb-item-icon">★</span>
                        <div className="hcb-item-body">
                          <strong>{c.name}</strong>
                          {c.title && c.title !== c.name && <span>{c.title}</span>}
                          <span>
                            {[
                              typeof c.score === "number" ? `Resultado ${Math.round(c.score * 100)}%` : null,
                              fmtDate(c.passedAt) ? `Aprobada el ${fmtDate(c.passedAt)}` : "Certificación aprobada",
                            ].filter(Boolean).join(" · ")}
                          </span>
                          <span className="hcb-item-note">Visible para las empresas en tu perfil y tus postulaciones</span>
                        </div>
                      </li>
                    ))}
                  </ul>
                </section>
              </>
            ) : (
              <>
                <span className="hcb-eyebrow">// CURSOS</span>
                <h3 id="hcb-title" className="hcb-title">
                  {courses.length === 1 ? "Curso completado" : "Cursos completados"}
                </h3>
                <section className="hcb-section">
                  <span className="hcb-section-label">CURSOS REALIZADOS</span>
                  <ul className="hcb-list">
                    {courses.map(c => (
                      <li key={c.id} className="hcb-item hcb-item--course">
                        <span className="hcb-item-icon">✓</span>
                        <div className="hcb-item-body">
                          <strong>{c.title}</strong>
                          <span>{fmtDate(c.completedAt) ? `Completado el ${fmtDate(c.completedAt)}` : "Completado"}</span>
                        </div>
                      </li>
                    ))}
                  </ul>
                </section>
              </>
            )}

            <button className="hcb-ok" onClick={() => setModal(null)}>CERRAR</button>
          </div>
        </div>,
        document.body
      )}
    </>
  );
}