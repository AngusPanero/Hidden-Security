import { useState, useEffect } from "react";
import axios from "axios";
import { UseSession } from "../contexts/SessionContext";
import "./jobBoard.css";

// ─── Types ────────────────────────────────────────────────────────────────────
interface SalaryRange {
  min: number | null;
  max: number | null;
  currency: string;
  visible: boolean;
}

interface Vacancy {
  _id: string;
  title: string;
  description: string;
  requirements: string;
  skills: string[];
  experienceLevel: string;
  modality: string;
  contractType: string;
  location: string;
  salaryRange: SalaryRange;
  closesAt: string | null;
  createdAt: string;
  companyName?: string | null;
  companyLogo?: string | null;
  status: string;
}

interface Application {
  vacancyId: string;
  title:     string;
  status:    string;
  appliedAt: string | null;
}

// ─── Estado de postulación — labels y colores ─────────────────────────────────
const APP_STATUS: Record<string, { label: string; color: string; bg: string }> = {
  pending:  { label: "Postulación enviada",    color: "#94a3b8", bg: "rgba(148,163,184,0.1)"  },
  cv_read:  { label: "CV leído",               color: "#38bdf8", bg: "rgba(56,189,248,0.1)"   },
  filter_1: { label: "Pasaste el filtro 1 ✓",  color: "#a78bfa", bg: "rgba(167,139,250,0.1)"  },
  filter_2: { label: "Pasaste el filtro 2 ✓",  color: "#818cf8", bg: "rgba(129,140,248,0.1)"  },
  filter_3: { label: "Pasaste el filtro 3 ✓",  color: "#6366f1", bg: "rgba(99,102,241,0.1)"   },
  contact:  { label: "La empresa se contactará contigo", color: "#22c55e", bg: "rgba(34,197,94,0.1)" },
  rejected: { label: "No seleccionado",         color: "#f43f5e", bg: "rgba(244,63,94,0.1)"   },
};

// ─── JobBoard ─────────────────────────────────────────────────────────────────
export default function JobBoard() {
  const { user } = UseSession();
  const isCertified = user?.userCertificated === true;

  const [vacancies,    setVacancies]    = useState<Vacancy[]>([]);
  const [applications, setApplications] = useState<Application[]>([]);
  const [loading,      setLoading]      = useState(true);
  const [selected,     setSelected]     = useState<Vacancy | null>(null);
  const [applying,     setApplying]     = useState(false);
  const [toast,        setToast]        = useState<{ msg: string; type: "success" | "error" } | null>(null);
  const [hasCV,        setHasCV]        = useState<boolean | null>(null); // null = cargando
  const [showConsent,  setShowConsent]  = useState(false);
  const [consentVacancy, setConsentVacancy] = useState<Vacancy | null>(null);

  // Filtros
  const [filterExp,          setFilterExp]          = useState("");
  const [filterModality,     setFilterModality]     = useState("");
  const [filterContractType, setFilterContractType] = useState("");
  const [filterSkill,        setFilterSkill]        = useState("");
  const [filterCurrency,     setFilterCurrency]     = useState("");
  const [filterSalaryMin,    setFilterSalaryMin]    = useState("");
  const [filterSalaryMax,    setFilterSalaryMax]    = useState("");
  const [filterDateFrom,     setFilterDateFrom]     = useState("");
  const [sortOrder,          setSortOrder]          = useState<"desc" | "asc">("desc");

  const notify = (msg: string, type: "success" | "error" = "success") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3500);
  };

  // Helper — devuelve la Application del usuario para una vacante, o undefined
  const getApplication = (vacancyId: string) =>
    applications.find((a) => a.vacancyId.toString() === vacancyId.toString());

  const fetchVacancies = () => {
    setLoading(true);
    const params = new URLSearchParams({ limit: "100", page: "1" });
    if (filterExp)          params.set("experienceLevel", filterExp);
    if (filterModality)     params.set("modality", filterModality);
    if (filterSkill.trim()) params.set("skill", filterSkill.trim());

    axios
      .get(`${import.meta.env.VITE_API_URL}/api/public/vacancies?${params}`)
      .then(({ data }) => setVacancies(Array.isArray(data.data) ? data.data : []))
      .catch(() => notify("Error al cargar vacantes", "error"))
      .finally(() => setLoading(false));
  };

  // Cargar postulaciones existentes del usuario — solo si está certificado
  const fetchApplications = () => {
    if (!isCertified) return;
    axios
      .get(`${import.meta.env.VITE_API_URL}/api/user/applications`, { withCredentials: true })
      .then(({ data }) => setApplications(Array.isArray(data.data) ? data.data : []))
      .catch(() => {});
  };

  useEffect(() => {
    fetchVacancies();
    fetchApplications();
  }, [filterExp, filterModality, filterSkill, isCertified]);

  // Verificar si el usuario certificado tiene CV creado
  useEffect(() => {
    if (!isCertified) return;
    axios.get(`${import.meta.env.VITE_API_URL}/api/cv/me`, { withCredentials: true })
      .then(({ data }) => setHasCV(!!data.data))
      .catch(() => setHasCV(false));
  }, [isCertified]);

  const clearFilters = () => {
    setFilterExp(""); setFilterModality(""); setFilterContractType("");
    setFilterSkill(""); setFilterCurrency(""); setFilterSalaryMin("");
    setFilterSalaryMax(""); setFilterDateFrom(""); setSortOrder("desc");
  };

  const hasActiveFilters =
    filterExp || filterModality || filterContractType || filterSkill ||
    filterCurrency || filterSalaryMin || filterSalaryMax ||
    filterDateFrom || sortOrder !== "desc";

  const filtered = vacancies
    .filter((v) => {
      if (filterContractType && v.contractType !== filterContractType) return false;
      if (filterCurrency && v.salaryRange?.currency !== filterCurrency) return false;
      if (filterSalaryMin !== "" && (v.salaryRange?.min == null || Number(v.salaryRange.min) < Number(filterSalaryMin))) return false;
      if (filterSalaryMax !== "" && (v.salaryRange?.max == null || Number(v.salaryRange.max) > Number(filterSalaryMax))) return false;
      if (filterDateFrom) {
        const from    = new Date(filterDateFrom);
        const created = new Date(v.createdAt ?? "");
        if (created < from) return false;
      }
      return true;
    })
    .sort((a, b) => {
      const da = new Date(a.createdAt ?? "").getTime();
      const db = new Date(b.createdAt ?? "").getTime();
      return sortOrder === "desc" ? db - da : da - db;
    });

  // Abre el modal de consentimiento o bloquea si no tiene CV
  const requestApply = (vacancy: Vacancy) => {
    if (!isCertified) return;
    if (!hasCV) {
      notify("Debés crear tu CV antes de postularte. Andá al tab MI CV.", "error");
      return;
    }
    setConsentVacancy(vacancy);
    setShowConsent(true);
    setSelected(null);
  };

  const handleApply = async () => {
    if (!consentVacancy || !isCertified) return;
    setApplying(true);
    setShowConsent(false);
    try {
      await axios.patch(
        `${import.meta.env.VITE_API_URL}/api/vacancy/${consentVacancy._id}/applicants`,
        { consent: true },
        { withCredentials: true }
      );
      setApplications((prev) => [
        ...prev,
        { vacancyId: consentVacancy._id, title: consentVacancy.title, status: "pending", appliedAt: new Date().toISOString() },
      ]);
      notify("¡Postulación enviada!");
      setConsentVacancy(null);
    } catch (err: any) {
      const msg = err.response?.data?.message;
      if (msg === "CV_REQUIRED") {
        notify("Debés crear tu CV antes de postularte. Andá al tab MI CV.", "error");
        setHasCV(false);
      } else {
        notify(msg || "Error al postularse", "error");
      }
    } finally {
      setApplying(false);
    }
  };

  return (
    <div className="jb-wrap">

      {/* Banner certificación */}
      {!isCertified && (
        <div className="jb-cert-banner">
          <span className="jb-cert-icon">🔒</span>
          <div>
            <p className="jb-cert-title">Completá tu certificación para postularte</p>
            <p className="jb-cert-sub">Podés ver todas las ofertas, pero necesitás el certificado Hidden Security para aplicar y ver los datos de contacto y salarios.</p>
          </div>
        </div>
      )}

      {/* Filtros */}
      <div className="jb-filters-wrap">
        <div className="jb-filters-row">
          <select className="jb-filter-select" value={filterExp} onChange={(e) => setFilterExp(e.target.value)}>
            <option value="">Todos los niveles</option>
            {["Junior","Semi-Senior","Senior","Lead","Manager"].map((v) => <option key={v}>{v}</option>)}
          </select>
          <select className="jb-filter-select" value={filterModality} onChange={(e) => setFilterModality(e.target.value)}>
            <option value="">Todas las modalidades</option>
            {["Remoto","Presencial","Híbrido"].map((v) => <option key={v}>{v}</option>)}
          </select>
          <select className="jb-filter-select" value={filterContractType} onChange={(e) => setFilterContractType(e.target.value)}>
            <option value="">Tipo de contrato</option>
            {["Full-time","Part-time","Freelance","Pasantía"].map((v) => <option key={v}>{v}</option>)}
          </select>
          <input
            className="jb-filter-input"
            placeholder="Filtrar por skill..."
            value={filterSkill}
            onChange={(e) => setFilterSkill(e.target.value)}
          />
        </div>

        <div className="jb-filters-row">
          <select className="jb-filter-select jb-filter-select--sm" value={filterCurrency} onChange={(e) => setFilterCurrency(e.target.value)}>
            <option value="">Moneda</option>
            {["USD","ARS","EUR","BRL"].map((c) => <option key={c}>{c}</option>)}
          </select>
          <div className="jb-filter-salary-range">
            <input className="jb-filter-input jb-filter-input--sm" type="number" placeholder="Salario mín." value={filterSalaryMin} onChange={(e) => setFilterSalaryMin(e.target.value)} />
            <span className="jb-filter-salary-sep">—</span>
            <input className="jb-filter-input jb-filter-input--sm" type="number" placeholder="Salario máx." value={filterSalaryMax} onChange={(e) => setFilterSalaryMax(e.target.value)} />
          </div>
          <div className="jb-filter-date-wrap">
            <label className="jb-filter-date-label">Desde</label>
            <input className="jb-filter-input jb-filter-input--date" type="date" value={filterDateFrom} onChange={(e) => setFilterDateFrom(e.target.value)} />
          </div>
          <select className="jb-filter-select jb-filter-select--sm" value={sortOrder} onChange={(e) => setSortOrder(e.target.value as "desc" | "asc")}>
            <option value="desc">Más recientes primero</option>
            <option value="asc">Más antiguas primero</option>
          </select>
          {hasActiveFilters && (
            <button className="jb-filter-clear" onClick={clearFilters}>LIMPIAR</button>
          )}
        </div>

        <p className="jb-results-count">
          {filtered.length} {filtered.length === 1 ? "vacante" : "vacantes"}
          {hasActiveFilters ? " encontradas" : " activas"}
        </p>
      </div>

      {/* Grid */}
      {loading ? (
        <div className="jb-loading">
          <span className="dm-loading-dot" /><span className="dm-loading-dot" /><span className="dm-loading-dot" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="jb-empty">
          <span className="jb-empty-icon">◫</span>
          <p>SIN_VACANTES_DISPONIBLES</p>
        </div>
      ) : (
        <div className="jb-grid">
          {filtered.map((v) => {
            const application = getApplication(v._id);
            const applied     = !!application;
            const appStatus   = application ? APP_STATUS[application.status] ?? APP_STATUS.pending : null;

            return (
              <div
                key={v._id}
                className={`jb-card${applied ? " jb-card--applied" : ""}`}
                onClick={() => setSelected(v)}
              >
                {/* Empresa — solo certificado */}
                {isCertified && (v.companyName || v.companyLogo) && (
                  <div className="jb-card-company">
                    {v.companyLogo
                      ? <img src={v.companyLogo} alt={v.companyName ?? "empresa"} className="jb-card-logo" />
                      : <div className="jb-card-logo-placeholder">{(v.companyName ?? "?")[0].toUpperCase()}</div>
                    }
                    <span className="jb-card-company-name">{v.companyName}</span>
                  </div>
                )}

                <h3 className="jb-card-title">{v.title}</h3>
                <p className="jb-card-sub">
                  {v.modality} · {v.contractType} · {v.experienceLevel}
                  {v.location ? ` · ${v.location}` : ""}
                </p>

                {v.skills.length > 0 && (
                  <div className="jb-card-skills">
                    {v.skills.slice(0, 5).map((s) => <span key={s} className="jb-skill">{s}</span>)}
                    {v.skills.length > 5 && <span className="jb-skill-more">+{v.skills.length - 5}</span>}
                  </div>
                )}

                {isCertified && v.salaryRange?.visible && (v.salaryRange.min || v.salaryRange.max) && (
                  <p className="jb-card-salary">
                    <span className="jb-salary-currency">{v.salaryRange.currency}</span>{" "}
                    {v.salaryRange.min ? Number(v.salaryRange.min).toLocaleString("es-AR") : ""}
                    {v.salaryRange.min && v.salaryRange.max ? " — " : ""}
                    {v.salaryRange.max ? Number(v.salaryRange.max).toLocaleString("es-AR") : ""}
                  </p>
                )}

                <div className="jb-card-meta-row">
                  {v.closesAt && (
                    <p className="jb-card-closes">
                      Cierra: {new Date(v.closesAt).toLocaleDateString("es-AR", { day: "2-digit", month: "short", year: "numeric" })}
                    </p>
                  )}
                  {v.createdAt && (
                    <p className="jb-card-published">
                      Publicada: {new Date(v.createdAt).toLocaleDateString("es-AR", { day: "2-digit", month: "short", year: "numeric" })}
                    </p>
                  )}
                </div>

                {/* Footer — diferente si ya aplicó */}
                <div className="jb-card-footer">
                  {applied && appStatus ? (
                    <div className="jb-card-status" style={{ borderColor: appStatus.color, background: appStatus.bg }}>
                      <span className="jb-card-status-dot" style={{ background: appStatus.color }} />
                      <span className="jb-card-status-label" style={{ color: appStatus.color }}>
                        {appStatus.label}
                      </span>
                    </div>
                  ) : isCertified ? (
                    <span className="jb-cta">VER Y POSTULARSE →</span>
                  ) : (
                    <span className="jb-cta jb-cta--locked">🔒 CERTIFICACIÓN REQUERIDA</span>
                  )}
                </div>

              </div>
            );
          })}
        </div>
      )}

      {/* Modal detalle */}
      {selected && (() => {
        const application = getApplication(selected._id);
        const applied     = !!application;
        const appStatus   = application ? APP_STATUS[application.status] ?? APP_STATUS.pending : null;

        return (
          <div className="jb-modal-overlay" onClick={() => setSelected(null)}>
            <div className="jb-modal" onClick={(e) => e.stopPropagation()}>

              <button className="jb-modal-close" onClick={() => setSelected(null)}>×</button>

              {isCertified && (selected.companyName || selected.companyLogo) && (
                <div className="jb-modal-company">
                  {selected.companyLogo
                    ? <img src={selected.companyLogo} alt={selected.companyName ?? ""} className="jb-modal-logo" />
                    : <div className="jb-modal-logo-placeholder">{(selected.companyName ?? "?")[0].toUpperCase()}</div>
                  }
                  <span className="jb-modal-company-name">{selected.companyName}</span>
                </div>
              )}

              <span className="jb-modal-eyebrow">// POSICIÓN</span>
              <h2 className="jb-modal-title">{selected.title}</h2>
              <p className="jb-modal-meta">
                {selected.modality} · {selected.contractType} · {selected.experienceLevel}
                {selected.location ? ` · ${selected.location}` : ""}
              </p>

              {isCertified && selected.salaryRange?.visible && (selected.salaryRange.min || selected.salaryRange.max) && (
                <p className="jb-modal-salary">
                  <span className="jb-modal-salary-label">{selected.salaryRange.currency}</span>{" "}
                  {selected.salaryRange.min ? Number(selected.salaryRange.min).toLocaleString("es-AR") : ""}
                  {selected.salaryRange.min && selected.salaryRange.max ? " — " : ""}
                  {selected.salaryRange.max ? Number(selected.salaryRange.max).toLocaleString("es-AR") : ""}
                </p>
              )}

              {selected.skills.length > 0 && (
                <div className="jb-modal-skills">
                  {selected.skills.map((s) => <span key={s} className="jb-skill">{s}</span>)}
                </div>
              )}

              <div className="jb-modal-dates">
                {selected.createdAt && (
                  <span className="jb-modal-date">
                    Publicada: {new Date(selected.createdAt).toLocaleDateString("es-AR", { day: "2-digit", month: "short", year: "numeric" })}
                  </span>
                )}
                {selected.closesAt && (
                  <span className="jb-modal-date">
                    Cierra: {new Date(selected.closesAt).toLocaleDateString("es-AR", { day: "2-digit", month: "short", year: "numeric" })}
                  </span>
                )}
              </div>

              <div className="jb-modal-section">
                <span className="jb-modal-section-title">// DESCRIPCIÓN</span>
                <p className="jb-modal-text">{selected.description}</p>
              </div>

              <div className="jb-modal-section">
                <span className="jb-modal-section-title">// REQUISITOS</span>
                <p className="jb-modal-text">{selected.requirements}</p>
              </div>

              {/* Footer del modal */}
              <div className="jb-modal-footer">
                {applied && appStatus ? (
                  <div className="jb-modal-status-block" style={{ borderColor: appStatus.color, background: appStatus.bg }}>
                    <span className="jb-modal-status-dot" style={{ background: appStatus.color }} />
                    <div>
                      <p className="jb-modal-status-label" style={{ color: appStatus.color }}>{appStatus.label}</p>
                      {application?.appliedAt && (
                        <p className="jb-modal-status-date">
                          Aplicaste el {new Date(application.appliedAt).toLocaleDateString("es-AR", { day: "2-digit", month: "long", year: "numeric" })}
                        </p>
                      )}
                    </div>
                  </div>
                ) : isCertified ? (
                  <button
                    className="jb-apply-btn"
                    disabled={applying}
                    onClick={() => requestApply(selected)}
                  >
                    {applying ? "ENVIANDO..." : "POSTULARME"}
                  </button>
                ) : (
                  <div className="jb-locked-msg">
                    <span className="jb-locked-icon">🔒</span>
                    <p>Necesitás completar tu certificación Hidden Security para postularte a esta posición.</p>
                  </div>
                )}
              </div>

            </div>
          </div>
        );
      })()}

      {/* Banner CV requerido */}
      {isCertified && hasCV === false && (
        <div className="jb-cert-banner" style={{ borderColor: "rgba(249,115,22,0.35)", background: "rgba(249,115,22,0.05)" }}>
          <span className="jb-cert-icon">📄</span>
          <div>
            <p className="jb-cert-title" style={{ color: "#f97316" }}>CV requerido para postularse</p>
            <p className="jb-cert-sub">Tenés la certificación pero aún no creaste tu CV. Andá al tab <strong>MI CV</strong> para completarlo.</p>
          </div>
        </div>
      )}

      {/* Modal de consentimiento */}
      {showConsent && consentVacancy && (
        <div className="jb-modal-overlay" onClick={() => setShowConsent(false)}>
          <div className="jb-modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 520 }}>
            <button className="jb-modal-close" onClick={() => setShowConsent(false)}>×</button>
            <span className="jb-modal-eyebrow">// CONSENTIMIENTO_DE_DATOS</span>
            <h2 className="jb-modal-title" style={{ fontSize: "1.1rem" }}>Confirmar postulación</h2>
            <p className="jb-modal-meta" style={{ marginTop: 4 }}>{consentVacancy.title}</p>

            <div style={{ margin: "20px 0", padding: "16px", border: "1px solid rgba(255,255,255,0.1)", background: "rgba(255,255,255,0.02)", lineHeight: 1.7 }}>
              <p style={{ fontSize: "0.82rem", fontWeight: 600, marginBottom: 10 }}>
                Al confirmar, autorizás a Hidden Security a compartir los siguientes datos personales y laborales con la empresa publicante, de forma confidencial y con el único fin de evaluar tu postulación:
              </p>
              <ul style={{ paddingLeft: 16, fontSize: "0.78rem", opacity: 0.75, display: "flex", flexDirection: "column", gap: 4 }}>
                <li>Nombre completo, datos de contacto y foto de perfil</li>
                <li>Experiencia laboral, educación y certificaciones</li>
                <li>Skills técnicas, proyectos y preferencias laborales</li>
              </ul>
              <p style={{ fontSize: "0.75rem", opacity: 0.5, marginTop: 12 }}>
                Esta información solo podrá ser utilizada en el contexto del proceso de selección para esta posición.
              </p>
            </div>

            <div className="jb-modal-footer" style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
              <button
                className="jb-apply-btn"
                disabled={applying}
                onClick={handleApply}
                style={{ flex: 1 }}
              >
                {applying ? "ENVIANDO..." : "ACEPTO Y ME POSTULO"}
              </button>
              <button
                onClick={() => setShowConsent(false)}
                style={{ background: "transparent", border: "1px solid rgba(255,255,255,0.15)", color: "rgba(255,255,255,0.5)", fontFamily: "'Montserrat',sans-serif", fontSize: "0.72rem", fontWeight: 800, letterSpacing: "1.5px", textTransform: "uppercase", padding: "14px 20px", cursor: "pointer" }}
              >
                CANCELAR
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Toast */}
      {toast && (
        <div className={`jb-toast jb-toast--${toast.type}`}>
          <span className="jb-toast-label">{toast.type === "success" ? "// OK" : "// ERROR"}</span>
          {toast.msg}
        </div>
      )}

    </div>
  );
}