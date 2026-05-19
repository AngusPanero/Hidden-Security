import { useEffect, useState, useRef, useCallback } from "react";
import axios from "axios";
import "./enterpriseDashboard.css";
import { UseSession } from "../contexts/SessionContext";
import { UseShopping } from "../contexts/ShoppingContext";
import { UseTheme } from "../contexts/ThemeContext";
import VacancyManager from "./VacancyManager";

// ─── Types ────────────────────────────────────────────────────────────────────
interface ApplicantEvent {
  vacancyId:     string;
  vacancyTitle:  string;
  userId:        string;
  applicantName: string;
  createdAt:     string;
}

interface Applicant {
  userId:    string;
  status:    string;
  appliedAt: string;
}

interface VacancySummary {
  _id:        string;
  title:      string;
  applicants: Applicant[];
  status:     string;
}

// ─── Constantes ───────────────────────────────────────────────────────────────
const NOTES = [
  { freq: 523.25, delay: 0    },
  { freq: 659.25, delay: 0.13 },
  { freq: 783.99, delay: 0.26 },
  { freq: 1046.5, delay: 0.39 },
];

const APPLICANT_STATUS_LABELS: Record<string, { label: string; color: string }> = {
  pending:    { label: "Pendiente",          color: "#94a3b8" },
  cv_read:    { label: "CV Leído",           color: "#38bdf8" },
  filter_1:   { label: "Filtro 1 ✓",        color: "#a78bfa" },
  filter_2:   { label: "Filtro 2 ✓",        color: "#818cf8" },
  filter_3:   { label: "Filtro 3 ✓",        color: "#6366f1" },
  contact:    { label: "Te contactaremos",   color: "#22c55e" },
  rejected:   { label: "No seleccionado",    color: "#f43f5e" },
};

// ─── Badge helper  
function ApplicantBadge({ count }: { count: number }) {
  if (count === 0) return null;
  return (
    <span className="hs-tab-badge">
      {count >= 100 ? "+99" : count}
    </span>
  );
}

// ─── Tab: Postulados  
function PostuladosTab() {
  const [vacancies,       setVacancies]       = useState<VacancySummary[]>([]);
  const [loading,         setLoading]         = useState(true);
  const [expanded,        setExpanded]        = useState<string | null>(null);
  const [updatingStatus,  setUpdatingStatus]  = useState<string | null>(null);
  const [cvModal,         setCvModal]         = useState<{ userId: string; name: string } | null>(null);
  const [cvData,          setCvData]          = useState<any | null>(null);
  const [loadingCv,       setLoadingCv]       = useState(false);

  const fetchVacancies = () => {
    axios
      .get(`${import.meta.env.VITE_API_URL}/api/vacancies`, { withCredentials: true })
      .then(({ data }) => setVacancies(Array.isArray(data.data) ? data.data : []))
      .catch(console.error)
      .finally(() => setLoading(false));
  };

  useEffect(() => { fetchVacancies(); }, []);

  const openCV = async (userId: string, name: string) => {
    setCvModal({ userId, name });
    setCvData(null);
    setLoadingCv(true);
    try {
      const { data } = await axios.get(`${import.meta.env.VITE_API_URL}/api/cv/user/${userId}`,{ withCredentials: true });
      setCvData(data.data);
      console.log("CV", data.data);
      
    } catch {
      setCvData(null);
    } finally {
      setLoadingCv(false);
    }
  };

  const downloadCV = (_userId: string, name: string) => {
    if (!cvData) return;
    const p        = cvData.personalInfo ?? {};
    const filename = `CV_${name.replace(/\s+/g, "_")}`;

    const section = (title: string, content: string) => !content.trim() ? "" : `
      <div style="page-break-inside:avoid;margin-bottom:28px;">
        <div style="display:flex;align-items:center;gap:14px;margin-bottom:14px;page-break-after:avoid;">
          <span style="font-family:'Montserrat',sans-serif;font-size:8px;font-weight:900;letter-spacing:5px;text-transform:uppercase;color:#111;white-space:nowrap;">${title}</span>
          <div style="flex:1;height:2px;background:#000;"></div>
        </div>
        ${content}
      </div>`;

    const entry = (inner: string) => `<div style="page-break-inside:avoid;margin-bottom:18px;">${inner}</div>`;

    const skillTags = (cvData.skills ?? []).map((s: string) =>
      `<span style="display:inline-block;border:1.5px solid #111;color:#111;font-family:'Montserrat',sans-serif;font-size:8.5px;font-weight:800;letter-spacing:2px;text-transform:uppercase;padding:4px 11px;margin:3px;">${s}</span>`
    ).join("");

    const experienceHTML = (cvData.experience ?? []).map((e: any) => entry(`
      <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:12px;flex-wrap:wrap;margin-bottom:5px;">
        <div>
          <div style="font-family:'Montserrat',sans-serif;font-size:15px;font-weight:900;text-transform:uppercase;letter-spacing:-0.3px;color:#000;">${e.position}</div>
          <div style="font-family:'Montserrat',sans-serif;font-size:12px;font-weight:700;color:#555;margin-top:2px;">${e.company}${e.location ? ` · ${e.location}` : ""}</div>
        </div>
        <div style="font-family:'Montserrat',sans-serif;font-size:10px;font-weight:700;color:#888;letter-spacing:1px;white-space:nowrap;padding-top:3px;">
          ${e.startDate}${e.startDate ? " — " : ""}${e.current ? "Actualidad" : e.endDate}
        </div>
      </div>
      ${e.description ? `<p style="font-family:'Montserrat',sans-serif;font-size:12px;font-weight:500;color:#333;line-height:1.8;margin:6px 0 0;">${e.description}</p>` : ""}
    `)).join("");

    const educationHTML = (cvData.education ?? []).map((e: any) => entry(`
      <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:12px;flex-wrap:wrap;margin-bottom:5px;">
        <div>
          <div style="font-family:'Montserrat',sans-serif;font-size:15px;font-weight:900;text-transform:uppercase;color:#000;">${e.degree}${e.field ? ` — ${e.field}` : ""}</div>
          <div style="font-family:'Montserrat',sans-serif;font-size:12px;font-weight:700;color:#555;margin-top:2px;">${e.institution}</div>
        </div>
        <div style="font-family:'Montserrat',sans-serif;font-size:10px;font-weight:700;color:#888;letter-spacing:1px;white-space:nowrap;padding-top:3px;">
          ${e.startDate}${e.startDate ? " — " : ""}${e.current ? "Actualidad" : e.endDate}
        </div>
      </div>
      ${e.description ? `<p style="font-family:'Montserrat',sans-serif;font-size:12px;font-weight:500;color:#333;line-height:1.8;margin:6px 0 0;">${e.description}</p>` : ""}
    `)).join("");

    const certsHTML = (cvData.certifications ?? []).map((c: any) => entry(`
      <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:12px;flex-wrap:wrap;">
        <div>
          <span style="font-family:'Montserrat',sans-serif;font-size:13px;font-weight:900;color:#000;">${c.name}</span>
          <span style="font-family:'Montserrat',sans-serif;font-size:11px;font-weight:600;color:#666;margin-left:8px;">· ${c.issuer}</span>
          ${c.credentialId ? `<div style="font-family:'Montserrat',sans-serif;font-size:10px;font-weight:600;color:#999;margin-top:3px;">ID: ${c.credentialId}</div>` : ""}
        </div>
        <span style="font-family:'Montserrat',sans-serif;font-size:10px;font-weight:700;color:#999;letter-spacing:1px;white-space:nowrap;">${c.date}</span>
      </div>
    `)).join("");

    const langsHTML = `<div style="display:flex;flex-wrap:wrap;gap:28px;">${(cvData.languages ?? []).map((l: any) => `
      <div style="page-break-inside:avoid;">
        <div style="font-family:'Montserrat',sans-serif;font-size:14px;font-weight:900;text-transform:uppercase;color:#000;">${l.language}</div>
        <div style="font-family:'Montserrat',sans-serif;font-size:10px;font-weight:800;letter-spacing:2px;color:#777;text-transform:uppercase;margin-top:2px;">${l.level}</div>
      </div>`).join("")}</div>`;

    const projectsHTML = (cvData.projects ?? []).map((proj: any) => entry(`
      <div style="border-left:3px solid #000;padding-left:14px;">
        <div style="display:flex;justify-content:space-between;align-items:center;gap:12px;flex-wrap:wrap;margin-bottom:5px;">
          <span style="font-family:'Montserrat',sans-serif;font-size:15px;font-weight:900;text-transform:uppercase;color:#000;">${proj.name}</span>
          <div style="display:flex;gap:10px;">
            ${proj.url     ? `<span style="font-family:'Montserrat',sans-serif;font-size:9px;font-weight:800;letter-spacing:2px;color:#555;text-transform:uppercase;">↗ DEMO</span>` : ""}
            ${proj.repoUrl ? `<span style="font-family:'Montserrat',sans-serif;font-size:9px;font-weight:800;letter-spacing:2px;color:#888;text-transform:uppercase;">↗ REPO</span>` : ""}
          </div>
        </div>
        ${proj.description ? `<p style="font-family:'Montserrat',sans-serif;font-size:12px;font-weight:500;color:#333;line-height:1.8;margin:0 0 8px;">${proj.description}</p>` : ""}
        ${(proj.technologies ?? []).length > 0 ? `<div style="display:flex;flex-wrap:wrap;gap:4px;">${proj.technologies.map((t: string) => `<span style="font-family:'Montserrat',sans-serif;font-size:8px;font-weight:800;letter-spacing:2px;text-transform:uppercase;border:1px solid #bbb;color:#444;padding:3px 8px;">${t}</span>`).join("")}</div>` : ""}
      </div>
    `)).join("");

    const wp = cvData.workPreferences ?? {};
    const dispHTML = `
      <div style="page-break-inside:avoid;display:flex;align-items:center;gap:20px;flex-wrap:wrap;">
        <span style="font-family:'Montserrat',sans-serif;font-size:16px;font-weight:900;text-transform:uppercase;color:#000;">${cvData.availability ?? ""}</span>
        ${wp.modality?.length > 0 ? `<span style="font-family:'Montserrat',sans-serif;font-size:11px;font-weight:600;color:#666;">${wp.modality.join(" · ")}</span>` : ""}
        ${wp.salaryMin || wp.salaryMax ? `<span style="font-family:'Montserrat',sans-serif;font-size:11px;font-weight:700;color:#555;">${wp.currency ?? "USD"} ${wp.salaryMin?.toLocaleString("es-AR") ?? ""}${wp.salaryMin && wp.salaryMax ? " — " : ""}${wp.salaryMax?.toLocaleString("es-AR") ?? ""}</span>` : ""}
      </div>`;

    const html = `<!DOCTYPE html>
      <html lang="es">
      <head>
        <meta charset="UTF-8"/>
        <title>${filename}</title>
        <link href="https://fonts.googleapis.com/css2?family=Montserrat:wght@400;500;600;700;800;900&display=swap" rel="stylesheet"/>
        <style>
          * { margin:0; padding:0; box-sizing:border-box; }
          body { background:#fff; color:#000; font-family:'Montserrat',sans-serif; }
          @page { size:A4; margin:18mm 16mm; }
          @media print { body { -webkit-print-color-adjust:exact; print-color-adjust:exact; } .no-print { display:none !important; } }
        </style>
      </head>
      <body>
      <div style="max-width:794px;margin:0 auto;padding:0 0 48px;">

        <div style="page-break-inside:avoid;display:flex;justify-content:space-between;align-items:flex-start;gap:24px;padding-bottom:20px;border-bottom:3px solid #000;margin-bottom:28px;flex-wrap:wrap;">
          <div style="flex:1;min-width:200px;padding:30px;">
            <div style="font-family:'Montserrat',sans-serif;font-size:8px;font-weight:800;letter-spacing:6px;text-transform:uppercase;color:#888;margin-bottom:8px;">CURRICULUM VITAE</div>
            <h1 style="font-family:'Montserrat',sans-serif;font-size:42px;font-weight:900;letter-spacing:-2.5px;text-transform:uppercase;line-height:0.92;color:#000;margin-bottom:10px;">
              ${p.firstName ?? ""}<br/>${p.lastName ?? ""}
            </h1>
            ${p.headline ? `<p style="font-family:'Montserrat',sans-serif;font-size:12px;font-weight:600;color:#555;line-height:1.5;margin-top:8px;max-width:380px;">${p.headline}</p>` : ""}
          </div>
          <div style="display:flex;flex-direction:column;align-items:flex-end;gap:10px;margin-top:30px;">
            ${p.photo ? `<img src="${p.photo}" alt="Foto" style="width:90px;height:90px;object-fit:cover;border:2px solid #000;border-radius:2px;display:block;" />` : ""}
            <div style="display:flex;flex-direction:column;align-items:flex-end;gap:4px;">
              ${p.email    ? `<span style="font-family:'Montserrat',sans-serif;font-size:11px;font-weight:600;color:#333;">${p.email}</span>` : ""}
              ${p.phone    ? `<span style="font-family:'Montserrat',sans-serif;font-size:11px;font-weight:600;color:#333;">${p.phone}</span>` : ""}
              ${p.location ? `<span style="font-family:'Montserrat',sans-serif;font-size:11px;font-weight:600;color:#333;">${p.location}</span>` : ""}
              ${p.linkedin ? `<span style="font-family:'Montserrat',sans-serif;font-size:10px;font-weight:800;letter-spacing:0.5px;color:#000;text-transform:uppercase;">${p.linkedin}</span>` : ""}
              ${p.github   ? `<span style="font-family:'Montserrat',sans-serif;font-size:10px;font-weight:800;letter-spacing:0.5px;color:#555;text-transform:uppercase;">${p.github}</span>` : ""}
              ${p.portfolio? `<span style="font-family:'Montserrat',sans-serif;font-size:10px;font-weight:800;letter-spacing:0.5px;color:#555;text-transform:uppercase;">${p.portfolio}</span>` : ""}
            </div>
          </div>
        </div>

        ${p.summary ? section("PERFIL PROFESIONAL", `<p style="font-family:'Montserrat',sans-serif;font-size:13px;font-weight:500;color:#222;line-height:1.85;border-left:3px solid #000;padding-left:16px;">${p.summary}</p>`) : ""}
        ${experienceHTML ? section("EXPERIENCIA LABORAL", experienceHTML) : ""}
        ${educationHTML  ? section("EDUCACIÓN",           educationHTML)  : ""}
        ${skillTags      ? section("SKILLS TÉCNICAS",     `<div style="display:flex;flex-wrap:wrap;gap:4px;">${skillTags}</div>`) : ""}
        ${projectsHTML   ? section("PROYECTOS",           projectsHTML)   : ""}
        ${certsHTML      ? section("CERTIFICACIONES",     certsHTML)      : ""}
        ${(cvData.languages ?? []).length > 0 ? section("IDIOMAS", langsHTML) : ""}
        ${cvData.availability ? section("DISPONIBILIDAD", dispHTML) : ""}

      </div>
      <div class="no-print" style="position:fixed;bottom:24px;right:24px;">
        <button onclick="window.print()" style="background:#000;border:none;color:#fff;font-family:'Montserrat',sans-serif;font-size:11px;font-weight:900;letter-spacing:2px;text-transform:uppercase;padding:14px 28px;cursor:pointer;">↓ GUARDAR PDF</button>
      </div>
      </body></html>`;

    const win = window.open("", "_blank");
    if (!win) return;
    win.document.write(html);
    win.document.close();
  };

  const handleStatusChange = async (vacancyId: string, userId: string, newStatus: string) => {
    const key = `${vacancyId}-${userId}`;
    setUpdatingStatus(key);
    try {
      await axios.patch(
        `${import.meta.env.VITE_API_URL}/api/vacancy/${vacancyId}/applicants/${userId}/status`,
        { status: newStatus },
        { withCredentials: true }
      );
      // Actualizar estado local sin refetch
      setVacancies((prev) =>
        prev.map((v) =>
          v._id !== vacancyId ? v : {
            ...v,
            applicants: v.applicants.map((a) =>
              a.userId === userId ? { ...a, status: newStatus } : a
            ),
          }
        )
      );
    } catch (err) {
      console.error("Error actualizando estado:", err);
    } finally {
      setUpdatingStatus(null);
    }
  };

  const totalApplicants = vacancies.reduce((acc, v) => acc + (v.applicants?.length ?? 0), 0);
  const withApplicants  = vacancies.filter((v) => (v.applicants?.length ?? 0) > 0);

  if (loading) return (
    <div className="hs-postulados-loading">
      <span className="hs-live-dot" /> Cargando postulaciones...
    </div>
  );

  return (
    <div className="hs-postulados">

      {/* Resumen */}
      <div className="hs-postulados-summary">
        <div className="hs-postulados-stat">
          <span className="hs-mono hs-eyebrow" style={{ marginBottom: 4 }}>// TOTAL</span>
          <span className="hs-postulados-stat-value">{totalApplicants >= 100 ? "+99" : totalApplicants}</span>
          <span className="hs-postulados-stat-label">postulaciones</span>
        </div>
        <div className="hs-postulados-stat">
          <span className="hs-mono hs-eyebrow" style={{ marginBottom: 4 }}>// VACANTES</span>
          <span className="hs-postulados-stat-value">{withApplicants.length}</span>
          <span className="hs-postulados-stat-label">con postulados</span>
        </div>
      </div>

      {withApplicants.length === 0 ? (
        <div className="hs-postulados-empty">
          <span className="hs-mono">// SIN_POSTULACIONES_AÚN</span>
          <p>Cuando alguien se postule a una de tus vacantes, aparecerá acá.</p>
        </div>
      ) : (
        <div className="hs-postulados-list">
          {withApplicants.map((v) => {
            const isOpen = expanded === v._id;
            const count  = v.applicants?.length ?? 0;
            return (
              <div key={v._id} className="hs-postulados-card">
                <div
                  className="hs-postulados-card-header"
                  onClick={() => setExpanded(isOpen ? null : v._id)}
                >
                  <div className="hs-postulados-card-left">
                    <span className="hs-mono" style={{ fontSize: "0.6rem", letterSpacing: 2 }}>// POSICIÓN</span>
                    <h3 className="hs-postulados-card-title">{v.title}</h3>
                  </div>
                  <div className="hs-postulados-card-right">
                    <span className="hs-postulados-count">
                      {count >= 100 ? "+99" : count} postulado{count !== 1 ? "s" : ""}
                    </span>
                    <span className="hs-postulados-chevron">{isOpen ? "▲" : "▼"}</span>
                  </div>
                </div>

                {isOpen && (
                  <div className="hs-postulados-applicants">
                    {v.applicants.map((applicant, i) => {
                      const statusInfo  = APPLICANT_STATUS_LABELS[applicant.status] ?? APPLICANT_STATUS_LABELS.pending;
                      const isUpdating  = updatingStatus === `${v._id}-${applicant.userId}`;
                      const displayName = (applicant as any).applicantName || applicant.userId;
                      return (
                        <div key={applicant.userId} className="hs-postulados-applicant-row">
                          <span className="hs-postulados-applicant-num">#{i + 1}</span>
                          <div className="hs-postulados-applicant-info">
                            <span className="hs-postulados-applicant-uid">{displayName}</span>
                            {applicant.appliedAt && (
                              <span className="hs-postulados-applicant-date">
                                {new Date(applicant.appliedAt).toLocaleDateString("es-AR", { day: "2-digit", month: "short", year: "numeric" })}
                              </span>
                            )}
                          </div>
                          <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
                            <button
                              className="hs-action-btn hs-action-btn--accent"
                              style={{ fontSize: "0.6rem", padding: "4px 10px" }}
                              onClick={() => openCV(applicant.userId, displayName)}
                            >
                              VER CV
                            </button>
                            <button
                              className="hs-action-btn"
                              style={{ fontSize: "0.6rem", padding: "4px 10px" }}
                              onClick={() => downloadCV(applicant.userId, displayName)}
                            >
                              ↓ PDF
                            </button>
                          </div>
                          <div className="hs-postulados-applicant-status">
                            <span className="hs-postulados-status-dot" style={{ background: statusInfo.color }} />
                            <select
                              className="hs-postulados-status-select"
                              value={applicant.status}
                              disabled={isUpdating}
                              onChange={(e) => handleStatusChange(v._id, applicant.userId, e.target.value)}
                              style={{ borderColor: statusInfo.color, color: statusInfo.color, opacity: isUpdating ? 0.5 : 1 }}
                            >
                              {Object.entries(APPLICANT_STATUS_LABELS).map(([val, { label }]) => (
                                <option key={val} value={val}>{label}</option>
                              ))}
                            </select>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Modal ver CV */}
      {cvModal && (
        <div className="hs-postulados-cv-overlay" onClick={() => setCvModal(null)}>
          <div className="hs-postulados-cv-modal" onClick={(e) => e.stopPropagation()}>
            <div className="hs-postulados-cv-modal-header">
              <div>
                <span className="hs-mono" style={{ fontSize: "0.6rem", letterSpacing: 2 }}>// CV_POSTULANTE</span>
                <h3 className="hs-postulados-card-title" style={{ marginTop: 4 }}>{cvModal.name}</h3>
              </div>
              <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                <button
                  className="hs-action-btn"
                  style={{ fontSize: "0.65rem" }}
                  onClick={() => downloadCV(cvModal.userId, cvModal.name)}
                  disabled={!cvData}
                >
                  ↓ DESCARGAR PDF
                </button>
                <button className="hs-postulados-cv-close" onClick={() => setCvModal(null)}>×</button>
              </div>
            </div>
            <div className="hs-postulados-cv-body">
              {loadingCv ? (
                <div className="hs-postulados-loading"><span className="hs-live-dot" /> Cargando CV...</div>
              ) : !cvData ? (
                <p style={{ opacity: 0.4, fontSize: "0.8rem" }}>Este postulante no tiene CV completo.</p>
              ) : (() => {
                const p = cvData.personalInfo ?? {};
                return (
                  <div className="hs-cv-view">
                    {/* Header */}
                    <div className="hs-cv-header">
                      {p.photo && <img src={p.photo} alt={p.firstName} className="hs-cv-photo" />}
                      <div className="hs-cv-header-info">
                        <h2 className="hs-cv-name">{p.firstName} {p.lastName}</h2>
                        {p.headline && <p className="hs-cv-headline">{p.headline}</p>}
                        <div className="hs-cv-contacts">
                          {p.email    && <span>{p.email}</span>}
                          {p.phone    && <span>{p.phone}</span>}
                          {p.location && <span>{p.location}</span>}
                          {p.linkedin && <span>{p.linkedin}</span>}
                          {p.github   && <span>{p.github}</span>}
                        </div>
                      </div>
                    </div>
                    {/* Resumen */}
                    {p.summary && <div className="hs-cv-section"><span className="hs-cv-section-title">// RESUMEN</span><p className="hs-cv-text">{p.summary}</p></div>}
                    {/* Experiencia */}
                    {(cvData.experience ?? []).length > 0 && (
                      <div className="hs-cv-section">
                        <span className="hs-cv-section-title">// EXPERIENCIA</span>
                        {cvData.experience.map((e: any, i: number) => (
                          <div key={i} className="hs-cv-entry">
                            <div className="hs-cv-entry-header">
                              <div><strong>{e.position}</strong> <span style={{ opacity: 0.6 }}>· {e.company}</span></div>
                              <span style={{ fontSize: "0.72rem", opacity: 0.4 }}>{e.startDate}{e.startDate && " — "}{e.current ? "Actualidad" : e.endDate}</span>
                            </div>
                            {e.description && <p className="hs-cv-text">{e.description}</p>}
                          </div>
                        ))}
                      </div>
                    )}
                    {/* Skills */}
                    {(cvData.skills ?? []).length > 0 && (
                      <div className="hs-cv-section">
                        <span className="hs-cv-section-title">// SKILLS</span>
                        <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 8 }}>
                          {cvData.skills.map((s: string) => (
                            <span key={s} style={{ border: "1px solid rgba(204,255,0,0.3)", color: "rgba(204,255,0,0.8)", fontFamily: "'JetBrains Mono',monospace", fontSize: "0.62rem", fontWeight: 800, letterSpacing: "1px", padding: "3px 10px", textTransform: "uppercase" }}>{s}</span>
                          ))}
                        </div>
                      </div>
                    )}
                    {/* Certificaciones */}
                    {(cvData.certifications ?? []).length > 0 && (
                      <div className="hs-cv-section">
                        <span className="hs-cv-section-title">// CERTIFICACIONES</span>
                        {cvData.certifications.map((c: any, i: number) => (
                          <div key={i} className="hs-cv-entry">
                            <div className="hs-cv-entry-header">
                              <strong>{c.name}</strong>
                              <span style={{ fontSize: "0.72rem", opacity: 0.4 }}>{c.issuer} · {c.date}</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                    {/* Disponibilidad */}
                    {cvData.availability && (
                      <div className="hs-cv-section">
                        <span className="hs-cv-section-title">// DISPONIBILIDAD</span>
                        <p className="hs-cv-text" style={{ color: "var(--h-accent)" }}>{cvData.availability}
                          {cvData.workPreferences?.modality?.length > 0 && ` · ${cvData.workPreferences.modality.join(", ")}`}
                          {(cvData.workPreferences?.salaryMin || cvData.workPreferences?.salaryMax) &&
                            ` · ${cvData.workPreferences.currency} ${cvData.workPreferences.salaryMin?.toLocaleString("es-AR") ?? ""}${cvData.workPreferences.salaryMin && cvData.workPreferences.salaryMax ? " — " : ""}${cvData.workPreferences.salaryMax?.toLocaleString("es-AR") ?? ""}`}
                        </p>
                      </div>
                    )}
                  </div>
                );
              })()}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── EnterpriseDashboard ──────────────────────────────────────────────────────
const EnterpriseDashboard = () => {
  const { user }                         = UseSession();
  const { /* allTickets, */ getAllTickets }     = UseShopping();
  const { theme }                        = UseTheme();

  const [activeTab,       setActiveTab]       = useState("vacancy");
  const [toast,           setToast]           = useState<{ msg: string; color: string; bg: string } | null>(null);
  const [applicantCount,  setApplicantCount]  = useState(0);
  const [/* newApplicants, */,   setNewApplicants]   = useState<ApplicantEvent[]>([]);

  const audioCtxRef        = useRef<AudioContext | null>(null);
  const toastTimerRef      = useRef<ReturnType<typeof setTimeout> | null>(null);
  const sseSalesRef        = useRef<EventSource | null>(null);
  const sseApplicantsRef   = useRef<EventSource | null>(null);
  const getAllTicketsRef    = useRef(getAllTickets);
  const showToastRef       = useRef<(msg: string, color?: string, bg?: string) => void>(() => {});
  const activeTabRef       = useRef(activeTab);

  useEffect(() => { getAllTicketsRef.current = getAllTickets; });
  useEffect(() => { activeTabRef.current = activeTab; }, [activeTab]);

  /* const uncheckedCount = allTickets.filter((t) => !t.checked).length; */

  // Inicializar AudioContext en el primer click — requerido por los browsers
  useEffect(() => {
    const init = () => {
      if (!audioCtxRef.current) {
        audioCtxRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
      }
      if (audioCtxRef.current.state === "suspended") {
        audioCtxRef.current.resume();
      }
      document.removeEventListener("click", init);
    };
    document.addEventListener("click", init);
    return () => document.removeEventListener("click", init);
  }, []);

  // ── Sonido ────────────────────────────────────────────────────
  const playSound = useCallback((notes = NOTES) => {
    try {
      if (!audioCtxRef.current)
        audioCtxRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
      const ctx = audioCtxRef.current;
      notes.forEach(({ freq, delay }) => {
        const osc  = ctx.createOscillator();
        const gain = ctx.createGain();
        const t    = ctx.currentTime + delay;
        const dur  = 0.45;
        osc.connect(gain); gain.connect(ctx.destination);
        osc.type = "sine"; osc.frequency.value = freq;
        gain.gain.setValueAtTime(0, t);
        gain.gain.linearRampToValueAtTime(0.22, t + 0.02);
        gain.gain.linearRampToValueAtTime(0.18, t + 0.1);
        gain.gain.exponentialRampToValueAtTime(0.001, t + dur);
        osc.start(t); osc.stop(t + dur);
      });
    } catch (e) { console.error("Audio error:", e); }
  }, []);

  // ── Toast ─────────────────────────────────────────────────────
  const showToast = useCallback((msg: string, color = "#ccff00", bg = "rgba(204,255,0,0.06)") => {
    setToast({ msg, color, bg });
    playSound();
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    toastTimerRef.current = setTimeout(() => setToast(null), 15000);
  }, [playSound]);

  useEffect(() => { showToastRef.current = showToast; }, [showToast]);

  // ── SSE ventas ────────────────────────────────────────────────
  useEffect(() => {
    if (!user?.admin) return;
    const connect = () => {
      if (sseSalesRef.current) sseSalesRef.current.close();
      const es = new EventSource(
        `${import.meta.env.VITE_API_URL}/api/payments/stream`,
        { withCredentials: true }
      );
      es.onmessage = (event) => {
        try {
          const sale = JSON.parse(event.data);
          getAllTicketsRef.current();
          if (!sale.checked)
            showToastRef.current(
              `🔔 NUEVA_VENTA — ${sale.email} · $${Number(sale.amount).toLocaleString()}`,
              "#ccff00",
              "rgba(204,255,0,0.06)"
            );
        } catch (e) { console.error("SSE sales parse error:", e); }
      };
      es.onerror = () => { es.close(); setTimeout(connect, 5000); };
      sseSalesRef.current = es;
    };
    connect();
    return () => { sseSalesRef.current?.close(); sseSalesRef.current = null; };
  }, [user]); // eslint-disable-line

  // ── SSE postulaciones ─────────────────────────────────────────
  useEffect(() => {
    if (!user?.isEnterprise) return;
    const connect = () => {
      if (sseApplicantsRef.current) sseApplicantsRef.current.close();
      const es = new EventSource(
        `${import.meta.env.VITE_API_URL}/api/vacancy/applicants/stream`,
        { withCredentials: true }
      );
      es.onmessage = (event) => {
        try {
          const applicant: ApplicantEvent = JSON.parse(event.data);

          // Incrementar badge solo si no estamos viendo el tab de postulados
          if (activeTabRef.current !== "postulados") {
            setApplicantCount((prev) => prev + 1);
          }

          setNewApplicants((prev) => [applicant, ...prev].slice(0, 50));

          // Sonido diferente al de ventas — tono más agudo
          playSound([
            { freq: 880,  delay: 0    },
            { freq: 1108, delay: 0.12 },
            { freq: 1318, delay: 0.24 },
          ]);

          showToastRef.current(
            `👤 NUEVA_POSTULACIÓN — ${applicant.vacancyTitle}`,
            "#f97316",
            "rgba(249,115,22,0.07)"
          );
        } catch (e) { console.error("SSE applicants parse error:", e); }
      };
      es.onerror = () => { es.close(); setTimeout(connect, 5000); };
      sseApplicantsRef.current = es;
    };
    connect();
    return () => { sseApplicantsRef.current?.close(); sseApplicantsRef.current = null; };
  }, [user, playSound]); // eslint-disable-line

  // Limpiar badge al entrar al tab de postulados
  const handleTabChange = (id: string) => {
    setActiveTab(id);
    if (id === "postulados") setApplicantCount(0);
  };

  if (!user?.isEnterprise) return (
    <div className={`hs-admin ${theme}`}>
      <div className="hs-unauthorized">
        <span className="hs-mono">// ACCESO_DENEGADO</span>
        <h1 className="hs-401">401</h1>
        <p>No autorizado</p>
      </div>
    </div>
  );

  const TABS = [
    {
      id: "vacancy", label: "VACANTES",
      icon: (<svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="3" width="16" height="13" rx="2"/><path d="M6 8h8M6 11h5"/><path d="M13 14l2 2 3-3"/></svg>)
    },
    {
      id: "postulados", label: "POSTULADOS",
      icon: (<svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><circle cx="8" cy="6" r="3"/><path d="M2 17c0-3.3 2.7-6 6-6s6 2.7 6 6"/><path d="M14 9l1.5 1.5L18 8"/></svg>),
      badge: applicantCount,
    },
  ];

  return (
    <div className={`hs-admin ${theme}`}>

      {/* ── TOAST ── */}
      {toast && (
        <div
          className="hs-toast"
          style={{ borderColor: toast.color, background: toast.bg }}
          onClick={() => setToast(null)}
        >
          <span className="hs-toast-dot" style={{ background: toast.color }} />
          <span className="hs-toast-msg">{toast.msg}</span>
          <button className="hs-toast-close" onClick={() => setToast(null)}>×</button>
        </div>
      )}

      {/* ── HEADER ── */}
      <header className="hs-header">
        <div className="hs-header-inner">
          <div className="hs-header-left">
            <span className="hs-mono hs-eyebrow">// HIDDEN_SECURITY</span>
            <h1 className="hs-header-title">ENTERPRISE_<span>DASHBOARD</span></h1>
          </div>
          <div className="hs-header-meta">
            <span className="hs-header-user">
              <span className="hs-live-dot" />
              {user?.email}
            </span>
            <span className="hs-sse-badge">
              <span className="hs-live-dot" />
              EN_VIVO
            </span>
          </div>
        </div>
      </header>

      {/* ── TABS ── */}
      <nav className="hs-tabs-nav">
        <div className="hs-tabs-inner">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              className={`hs-tab-btn ${activeTab === tab.id ? "active" : ""}`}
              onClick={() => handleTabChange(tab.id)}
            >
              <span className="hs-tab-icon">{tab.icon}</span>
              <span className="hs-tab-label">{tab.label}</span>
              <ApplicantBadge count={tab.badge ?? 0} />
            </button>
          ))}
        </div>
      </nav>

      {/* ── CONTENIDO ── */}
      <main className="hs-content">
        {activeTab === "vacancy"    && <VacancyManager />}
        {activeTab === "postulados" && <PostuladosTab />}
      </main>

    </div>
  );
};

export default EnterpriseDashboard;