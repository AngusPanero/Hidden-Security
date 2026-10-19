import { useState, useEffect, useRef, useCallback, type ReactNode } from "react";
import axios from "axios";
import { UseSession } from "../contexts/SessionContext";
import "./jobBoard.css";

const REQUIRE_COURSE = false; // Cambiar a true si se requiere curso para postularse

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

// Vista de la lista: todas, solo a las que me postulé, o solo a las que no
type ViewFilter = "all" | "applied" | "not_applied";

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

const LEVELS     = ["Junior", "Semi-Senior", "Senior", "Lead", "Manager"];
const MODALITIES = ["Remoto", "Presencial", "Híbrido"];
const CONTRACTS  = ["Full-time", "Part-time", "Freelance", "Pasantía"];
const CURRENCIES = ["USD", "ARS", "EUR", "BRL"];

// Debajo de este ancho los filtros y los detalles se abren como bottom sheet
const MOBILE_MQ = "(max-width: 768px)";
// Distancia (px) que hay que arrastrar hacia abajo para cerrar un sheet
const DISMISS_DISTANCE = 110;

// ─── Helpers de formato ───────────────────────────────────────────────────────
const fmtDate = (iso: string, month: "short" | "long" = "short") =>
  new Date(iso).toLocaleDateString("es-AR", { day: "2-digit", month, year: "numeric" });

const daysFromNow = (iso: string) => {
  const ms = new Date(iso).getTime() - Date.now();
  return Math.ceil(ms / 86_400_000);
};

// "Hoy", "Ayer", "Hace 5 días" o la fecha si pasó más de un mes.
// Se cuenta por día calendario, no por horas.
const publishedLabel = (iso: string) => {
  const start = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const days  = Math.round((start(new Date()) - start(new Date(iso))) / 86_400_000);
  if (days <= 0) return "Hoy";
  if (days === 1) return "Ayer";
  if (days < 30) return `Hace ${days} días`;
  return fmtDate(iso);
};

// Texto + tono para la fecha de cierre
const closingInfo = (iso: string | null): { text: string; soon: boolean } | null => {
  if (!iso) return null;
  const d = daysFromNow(iso);
  if (d < 0)  return { text: "Cerrada", soon: true };
  if (d === 0) return { text: "Cierra hoy", soon: true };
  if (d <= 7) return { text: `Cierra en ${d} ${d === 1 ? "día" : "días"}`, soon: true };
  return { text: `Cierra ${fmtDate(iso)}`, soon: false };
};

const salaryText = (s?: SalaryRange) => {
  if (!s?.visible || (!s.min && !s.max)) return null;
  const min = s.min ? Number(s.min).toLocaleString("es-AR") : "";
  const max = s.max ? Number(s.max).toLocaleString("es-AR") : "";
  return { currency: s.currency, amount: min && max ? `${min} – ${max}` : min || max };
};

// ─── Hook: ¿estamos en mobile? ────────────────────────────────────────────────
function useIsMobile() {
  const [isMobile, setIsMobile] = useState(
    () => typeof window !== "undefined" && window.matchMedia(MOBILE_MQ).matches
  );
  useEffect(() => {
    const mq = window.matchMedia(MOBILE_MQ);
    const onChange = () => setIsMobile(mq.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);
  return isMobile;
}

// ─── Logo de empresa (imagen o inicial) ───────────────────────────────────────
function CompanyLogo({ name, logo, size }: { name?: string | null; logo?: string | null; size: "sm" | "lg" }) {
  return logo
    ? <img src={logo} alt={name ?? "Empresa"} className={`jb-logo jb-logo--${size}`} />
    : <span className={`jb-logo jb-logo--${size} jb-logo--placeholder`}>{(name || "?").charAt(0).toUpperCase()}</span>;
}

// ─── Sheet: bottom sheet en mobile, modal centrado en desktop ─────────────────
// Se cierra deslizando la cabecera hacia abajo, tocando el fondo, con la ✕ o
// con Escape. El arrastre solo funciona desde la cabecera, así el scroll del
// contenido nunca lo cierra sin querer.
interface SheetProps {
  onClose:   () => void;
  labelId:   string;
  header:    ReactNode;
  footer?:   ReactNode;
  children:  ReactNode;
  size?:     "md" | "lg";
  locked?:   boolean; // no se puede cerrar (ej. mientras se envía)
}

function Sheet({ onClose, labelId, header, footer, children, size = "lg", locked = false }: SheetProps) {
  const startY = useRef<number | null>(null);
  const [dragY, setDragY] = useState(0);
  const closeRef = useRef<HTMLButtonElement>(null);

  const tryClose = useCallback(() => { if (!locked) onClose(); }, [locked, onClose]);

  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") tryClose(); };
    window.addEventListener("keydown", onKey);
    closeRef.current?.focus({ preventScroll: true });
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
    };
  }, [tryClose]);

  const onTouchStart = (e: React.TouchEvent) => { if (!locked) startY.current = e.touches[0].clientY; };
  const onTouchMove  = (e: React.TouchEvent) => {
    if (startY.current === null) return;
    setDragY(Math.max(0, e.touches[0].clientY - startY.current));
  };
  const onTouchEnd   = () => {
    if (startY.current === null) return;
    if (dragY > DISMISS_DISTANCE) tryClose();
    else setDragY(0);
    startY.current = null;
  };

  return (
    <div className="jb-sheet-root" onClick={tryClose}>
      <div
        className={`jb-sheet jb-sheet--${size}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby={labelId}
        onClick={(e) => e.stopPropagation()}
        style={dragY ? { transform: `translateY(${dragY}px)`, transition: "none" } : undefined}
      >
        <div className="jb-sheet-drag" onTouchStart={onTouchStart} onTouchMove={onTouchMove} onTouchEnd={onTouchEnd}>
          <span className="jb-sheet-handle" aria-hidden="true" />
          <div className="jb-sheet-header">
            <div className="jb-sheet-heading">{header}</div>
            <button ref={closeRef} type="button" className="jb-sheet-close" onClick={tryClose} disabled={locked} aria-label="Cerrar">
              ✕
            </button>
          </div>
        </div>

        <div className="jb-sheet-body">{children}</div>

        {footer && <div className="jb-sheet-footer">{footer}</div>}
      </div>
    </div>
  );
}

// ─── JobBoard ─────────────────────────────────────────────────────────────────
export default function JobBoard() {
  const { user } = UseSession();
  // Cursos completados — viene de la claim completedCourses (ej. ["modernSoc", ...])
  // Alcanza con haber completado CUALQUIER curso, no uno en particular.
  const completedCourses: string[] = Array.isArray(user?.completedCourses) ? user.completedCourses : [];
  const hasCompletedCourse = completedCourses.length > 0;
  // Puede usar el flujo de postulación (el CV se valida aparte)
  const canApply = !REQUIRE_COURSE || hasCompletedCourse;

  const isMobile = useIsMobile();

  const [vacancies,    setVacancies]    = useState<Vacancy[]>([]);
  const [applications, setApplications] = useState<Application[]>([]);
  const [loading,      setLoading]      = useState(true);
  const [selected,     setSelected]     = useState<Vacancy | null>(null);
  const [applying,     setApplying]     = useState(false);
  const [toast,        setToast]        = useState<{ msg: string; type: "success" | "error" } | null>(null);
  const [hasCV,        setHasCV]        = useState<boolean | null>(null); // null = cargando
  const [showConsent,  setShowConsent]  = useState(false);
  const [consentVacancy, setConsentVacancy] = useState<Vacancy | null>(null);
  const [viewFilter,   setViewFilter]   = useState<ViewFilter>("all");
  const [showFilters,  setShowFilters]  = useState(false); // panel (desktop) o sheet (mobile)

  // Filtros
  const [filterExp,          setFilterExp]          = useState("");
  const [filterModality,     setFilterModality]     = useState("");
  const [filterContractType, setFilterContractType] = useState("");
  const [filterSkill,        setFilterSkill]        = useState("");
  const [filterCompany,      setFilterCompany]      = useState("");
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

  // Cargar postulaciones existentes del usuario — solo si puede postularse
  const fetchApplications = () => {
    if (!canApply) return;
    axios
      .get(`${import.meta.env.VITE_API_URL}/api/user/applications`, { withCredentials: true })
      .then(({ data }) => setApplications(Array.isArray(data.data) ? data.data : []))
      .catch(() => {});
  };

  useEffect(() => {
    fetchVacancies();
    fetchApplications();
  }, [filterExp, filterModality, filterSkill, canApply]);

  // Verificar si el usuario tiene CV creado
  useEffect(() => {
    if (!canApply) return;
    axios.get(`${import.meta.env.VITE_API_URL}/api/cv/me`, { withCredentials: true })
      .then(({ data }) => setHasCV(!!data.data))
      .catch(() => setHasCV(false));
  }, [canApply]);

  const clearFilters = () => {
    setFilterExp(""); setFilterModality(""); setFilterContractType("");
    setFilterSkill(""); setFilterCurrency(""); setFilterSalaryMin("");
    setFilterSalaryMax(""); setFilterDateFrom(""); setSortOrder("desc");
    setFilterCompany("");
  };

  const hasActiveFilters =
    filterExp || filterModality || filterContractType || filterSkill ||
    filterCurrency || filterSalaryMin || filterSalaryMax ||
    filterDateFrom || sortOrder !== "desc" ||
    filterCompany.trim();

  // Cuántos filtros hay activos dentro del panel "Filtros" (para el contador del botón).
  // En desktop nivel, modalidad y empresa están a la vista, así que no se cuentan.
  const panelFilterCount = [
    isMobile && filterExp,
    isMobile && filterModality,
    isMobile && filterCompany.trim(),
    filterContractType,
    filterCurrency,
    filterSalaryMin || filterSalaryMax,
    filterDateFrom,
  ].filter(Boolean).length;

  // Primero los filtros de búsqueda (nivel, modalidad, salario, fecha...)
  const byFilters = vacancies
    .filter((v) => {
      // Empresa — sin distinguir mayúsculas/minúsculas
      if (filterCompany.trim()) {
        const company = (v.companyName ?? "").toLowerCase();
        if (!company.includes(filterCompany.trim().toLowerCase())) return false;
      }
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

  // Conteos por pestaña — sobre lo que ya pasó los filtros de búsqueda
  const appliedCount    = byFilters.filter((v) => !!getApplication(v._id)).length;
  const notAppliedCount = byFilters.length - appliedCount;

  // Después la pestaña (todas / postuladas / no postuladas)
  const filtered = byFilters.filter((v) => {
    if (viewFilter === "all") return true;
    const applied = !!getApplication(v._id);
    return viewFilter === "applied" ? applied : !applied;
  });

  const VIEW_TABS: { id: ViewFilter; label: string; count: number }[] = [
    { id: "all",         label: "Todas",             count: byFilters.length },
    { id: "applied",     label: "Mis postulaciones", count: appliedCount     },
    { id: "not_applied", label: "No postuladas",     count: notAppliedCount  },
  ];

  const emptyMessage =
    viewFilter === "applied"       ? "Todavía no te postulaste a ninguna vacante."
    : viewFilter === "not_applied" ? "Ya te postulaste a todas las vacantes disponibles."
    : hasActiveFilters             ? "Ninguna vacante coincide con los filtros."
    : "Por ahora no hay vacantes publicadas.";

  // Abre el modal de consentimiento o bloquea si no tiene CV
  const requestApply = (vacancy: Vacancy) => {
    if (!canApply) return;
    if (!hasCV) {
      notify("Debés crear tu CV antes de postularte. Andá al tab MI CV.", "error");
      return;
    }
    setConsentVacancy(vacancy);
    setShowConsent(true);
    setSelected(null);
  };

  const handleApply = async () => {
    if (!consentVacancy || !canApply) return;
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

  const closeDetail  = useCallback(() => setSelected(null), []);
  const closeConsent = useCallback(() => setShowConsent(false), []);
  const closeFilters = useCallback(() => setShowFilters(false), []);

  // ─── Campos de filtro (se reutilizan en el panel de desktop y en el sheet) ──
  const levelSelect = (
    <label className="jb-field">
      <span className="jb-field-label">Nivel</span>
      <select className="jb-control" value={filterExp} onChange={(e) => setFilterExp(e.target.value)}>
        <option value="">Todos los niveles</option>
        {LEVELS.map((v) => <option key={v}>{v}</option>)}
      </select>
    </label>
  );
  const modalitySelect = (
    <label className="jb-field">
      <span className="jb-field-label">Modalidad</span>
      <select className="jb-control" value={filterModality} onChange={(e) => setFilterModality(e.target.value)}>
        <option value="">Todas las modalidades</option>
        {MODALITIES.map((v) => <option key={v}>{v}</option>)}
      </select>
    </label>
  );
  const companyInput = (
    <label className="jb-field">
      <span className="jb-field-label">Empresa</span>
      <input className="jb-control" placeholder="Nombre de la empresa" value={filterCompany} onChange={(e) => setFilterCompany(e.target.value)} />
    </label>
  );
  const panelFields = (
    <>
      <label className="jb-field">
        <span className="jb-field-label">Tipo de contrato</span>
        <select className="jb-control" value={filterContractType} onChange={(e) => setFilterContractType(e.target.value)}>
          <option value="">Todos</option>
          {CONTRACTS.map((v) => <option key={v}>{v}</option>)}
        </select>
      </label>
      <label className="jb-field">
        <span className="jb-field-label">Moneda</span>
        <select className="jb-control" value={filterCurrency} onChange={(e) => setFilterCurrency(e.target.value)}>
          <option value="">Todas</option>
          {CURRENCIES.map((c) => <option key={c}>{c}</option>)}
        </select>
      </label>
      <div className="jb-field jb-field--wide">
        <span className="jb-field-label">Rango salarial</span>
        <div className="jb-range">
          <input className="jb-control" type="number" inputMode="numeric" placeholder="Mínimo" value={filterSalaryMin} onChange={(e) => setFilterSalaryMin(e.target.value)} />
          <span className="jb-range-sep">–</span>
          <input className="jb-control" type="number" inputMode="numeric" placeholder="Máximo" value={filterSalaryMax} onChange={(e) => setFilterSalaryMax(e.target.value)} />
        </div>
      </div>
      <label className="jb-field">
        <span className="jb-field-label">Publicadas desde</span>
        <input className="jb-control" type="date" value={filterDateFrom} onChange={(e) => setFilterDateFrom(e.target.value)} />
      </label>
    </>
  );

  const sortSelect = (
    <select
      className="jb-control jb-control--sort"
      value={sortOrder}
      onChange={(e) => setSortOrder(e.target.value as "desc" | "asc")}
      aria-label="Ordenar vacantes"
    >
      <option value="desc">Más recientes</option>
      <option value="asc">Más antiguas</option>
    </select>
  );

  // ─── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="jb-wrap">

      {/* Banner curso — solo si el curso es requisito para postularse */}
      {REQUIRE_COURSE && !hasCompletedCourse && (
        <div className="jb-banner jb-banner--error">
          <strong>Completá tu curso para postularte</strong>
          <span>Podés ver todas las ofertas, pero necesitás haber completado un curso en Hidden Security para aplicar.</span>
        </div>
      )}

      {/* Banner CV requerido */}
      {canApply && hasCV === false && (
        <div className="jb-banner jb-banner--warn">
          <strong>CV requerido para postularse</strong>
          <span>
            {REQUIRE_COURSE
              ? <>Tenés el curso completado, pero aún no creaste tu CV. Andá al tab <b>MI CV</b> para completarlo.</>
              : <>Aún no creaste tu CV. Andá al tab <b>MI CV</b> para completarlo.</>}
          </span>
        </div>
      )}

      {/* Pestañas: todas / mis postulaciones / no postuladas — solo si puede postularse */}
      {canApply && (
        <div className="jb-tabs" role="tablist" aria-label="Filtrar vacantes por postulación">
          {VIEW_TABS.map((tab) => (
            <button
              key={tab.id}
              type="button"
              role="tab"
              aria-selected={viewFilter === tab.id}
              className={`jb-tab${viewFilter === tab.id ? " jb-tab--active" : ""}`}
              onClick={() => setViewFilter(tab.id)}
            >
              {tab.label}
              <span className="jb-tab-count">{tab.count}</span>
            </button>
          ))}
        </div>
      )}

      {/* ── Toolbar de búsqueda ── */}
      <div className="jb-toolbar">
        <div className="jb-search">
          <span className="jb-search-icon" aria-hidden="true">⌕</span>
          <input
            className="jb-search-input"
            type="search"
            placeholder="Buscar por skill (ej: SIEM, Python, Splunk)"
            value={filterSkill}
            onChange={(e) => setFilterSkill(e.target.value)}
            aria-label="Buscar por skill"
          />
        </div>

        {!isMobile && (
          <div className="jb-toolbar-inline">
            {companyInput}
            {levelSelect}
            {modalitySelect}
          </div>
        )}

        <div className="jb-toolbar-actions">
          <button
            type="button"
            className={`jb-filters-btn${showFilters && !isMobile ? " jb-filters-btn--open" : ""}${panelFilterCount ? " jb-filters-btn--active" : ""}`}
            onClick={() => setShowFilters((v) => !v)}
            aria-expanded={showFilters}
          >
            Filtros
            {panelFilterCount > 0 && <span className="jb-filters-btn-count">{panelFilterCount}</span>}
          </button>
          {sortSelect}
        </div>
      </div>

      {/* Desktop: filtros avanzados desplegables */}
      {!isMobile && showFilters && (
        <div className="jb-panel">
          <div className="jb-panel-grid">{panelFields}</div>
          {hasActiveFilters && (
            <button type="button" className="jb-link" onClick={clearFilters}>Limpiar todos los filtros</button>
          )}
        </div>
      )}

      <div className="jb-results">
        <span>
          <b>{filtered.length}</b> {filtered.length === 1 ? "vacante" : "vacantes"}
          {hasActiveFilters ? " encontradas" : " activas"}
        </span>
        {hasActiveFilters && (
          <button type="button" className="jb-link" onClick={clearFilters}>Limpiar filtros</button>
        )}
      </div>

      {/* ── Lista ── */}
      {loading ? (
        <div className="jb-loading">
          <span className="dm-loading-dot" /><span className="dm-loading-dot" /><span className="dm-loading-dot" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="jb-empty">
          <span className="jb-empty-icon">◫</span>
          <p>{emptyMessage}</p>
          {hasActiveFilters && <button type="button" className="jb-link" onClick={clearFilters}>Limpiar filtros</button>}
        </div>
      ) : (
        <div className="jb-grid">
          {filtered.map((v) => {
            const application = getApplication(v._id);
            const applied     = !!application;
            const appStatus   = application ? APP_STATUS[application.status] ?? APP_STATUS.pending : null;
            const salary      = salaryText(v.salaryRange);
            const closing     = closingInfo(v.closesAt);

            return (
              <div
                key={v._id}
                role="button"
                tabIndex={0}
                className={`jb-card${applied ? " jb-card--applied" : ""}`}
                style={appStatus ? ({ "--jb-status": appStatus.color } as React.CSSProperties) : undefined}
                onClick={() => setSelected(v)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setSelected(v); }
                }}
                aria-label={`Ver vacante ${v.title}${v.companyName ? ` en ${v.companyName}` : ""}`}
              >
                <div className="jb-card-head">
                  <CompanyLogo name={v.companyName} logo={v.companyLogo} size="sm" />
                  <div className="jb-card-company">
                    <span className="jb-card-company-name">{v.companyName || "Empresa confidencial"}</span>
                    {v.createdAt && <span className="jb-card-date">{publishedLabel(v.createdAt)}</span>}
                  </div>
                </div>

                <h3 className="jb-card-title">{v.title}</h3>

                <div className="jb-tags">
                  {[v.modality, v.contractType, v.experienceLevel, v.location].filter(Boolean).map((t) => (
                    <span key={t} className="jb-tag">{t}</span>
                  ))}
                </div>

                {salary && (
                  <p className="jb-card-salary">
                    <span className="jb-currency">{salary.currency}</span> {salary.amount}
                  </p>
                )}

                {v.skills.length > 0 && (
                  <div className="jb-skills">
                    {v.skills.slice(0, 4).map((s) => <span key={s} className="jb-skill">{s}</span>)}
                    {v.skills.length > 4 && <span className="jb-skill-more">+{v.skills.length - 4}</span>}
                  </div>
                )}

                <div className="jb-card-footer">
                  {applied && appStatus ? (
                    <span className="jb-status" style={{ color: appStatus.color, background: appStatus.bg, borderColor: appStatus.color }}>
                      <span className="jb-status-dot" style={{ background: appStatus.color }} />
                      {appStatus.label}
                    </span>
                  ) : closing ? (
                    <span className={`jb-card-closes${closing.soon ? " jb-card-closes--soon" : ""}`}>{closing.text}</span>
                  ) : (
                    <span className="jb-card-closes">Sin fecha de cierre</span>
                  )}

                  {!applied && (
                    canApply
                      ? <span className="jb-cta">Ver detalle <span aria-hidden="true">→</span></span>
                      : <span className="jb-cta jb-cta--locked">Requiere curso</span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ── Mobile: filtros en bottom sheet ── */}
      {isMobile && showFilters && (
        <Sheet
          onClose={closeFilters}
          labelId="jb-filters-title"
          size="md"
          header={<h2 id="jb-filters-title" className="jb-sheet-title">Filtros</h2>}
          footer={
            <div className="jb-footer-row">
              <button type="button" className="jb-btn jb-btn--ghost" onClick={clearFilters} disabled={!hasActiveFilters}>
                Limpiar
              </button>
              <button type="button" className="jb-btn jb-btn--primary" onClick={closeFilters}>
                Ver {filtered.length} {filtered.length === 1 ? "vacante" : "vacantes"}
              </button>
            </div>
          }
        >
          <div className="jb-filter-stack">
            {levelSelect}
            {modalitySelect}
            {companyInput}
            {panelFields}
          </div>
        </Sheet>
      )}

      {/* ── Detalle de la vacante ── */}
      {selected && (() => {
        const application = getApplication(selected._id);
        const applied     = !!application;
        const appStatus   = application ? APP_STATUS[application.status] ?? APP_STATUS.pending : null;
        const salary      = salaryText(selected.salaryRange);
        const closing     = closingInfo(selected.closesAt);

        const facts = [
          { label: "Modalidad", value: selected.modality },
          { label: "Contrato",  value: selected.contractType },
          { label: "Nivel",     value: selected.experienceLevel },
          { label: "Ubicación", value: selected.location },
          { label: "Publicada", value: selected.createdAt ? fmtDate(selected.createdAt) : "" },
          { label: "Cierre",    value: selected.closesAt ? fmtDate(selected.closesAt) : "Sin fecha" },
        ].filter((f) => f.value);

        return (
          <Sheet
            onClose={closeDetail}
            labelId="jb-detail-title"
            header={
              <>
                <div className="jb-detail-company">
                  <CompanyLogo name={selected.companyName} logo={selected.companyLogo} size="lg" />
                  <div className="jb-detail-company-text">
                    <span className="jb-detail-company-name">{selected.companyName || "Empresa confidencial"}</span>
                    {closing && (
                      <span className={`jb-card-closes${closing.soon ? " jb-card-closes--soon" : ""}`}>{closing.text}</span>
                    )}
                  </div>
                </div>
                <h2 id="jb-detail-title" className="jb-detail-title">{selected.title}</h2>
              </>
            }
            footer={
              applied && appStatus ? (
                <div className="jb-status-block" style={{ borderColor: appStatus.color, background: appStatus.bg }}>
                  <span className="jb-status-dot jb-status-dot--lg" style={{ background: appStatus.color }} />
                  <div>
                    <p className="jb-status-block-label" style={{ color: appStatus.color }}>{appStatus.label}</p>
                    {application?.appliedAt && (
                      <p className="jb-status-block-date">Te postulaste el {fmtDate(application.appliedAt, "long")}</p>
                    )}
                  </div>
                </div>
              ) : canApply ? (
                <button className="jb-btn jb-btn--primary jb-btn--block" disabled={applying} onClick={() => requestApply(selected)}>
                  {applying ? "Enviando…" : "Postularme"}
                </button>
              ) : (
                <div className="jb-banner jb-banner--error jb-banner--flat">
                  <span>Necesitás completar un curso en Hidden Security para postularte a esta posición.</span>
                </div>
              )
            }
          >
            {salary && (
              <div className="jb-detail-salary">
                <span className="jb-field-label">Salario</span>
                <p><span className="jb-currency">{salary.currency}</span> {salary.amount}</p>
              </div>
            )}

            <dl className="jb-facts">
              {facts.map((f) => (
                <div key={f.label} className="jb-fact">
                  <dt>{f.label}</dt>
                  <dd>{f.value}</dd>
                </div>
              ))}
            </dl>

            {selected.skills.length > 0 && (
              <section className="jb-detail-section">
                <h3 className="jb-section-title">Skills</h3>
                <div className="jb-skills">
                  {selected.skills.map((s) => <span key={s} className="jb-skill">{s}</span>)}
                </div>
              </section>
            )}

            <section className="jb-detail-section">
              <h3 className="jb-section-title">Descripción</h3>
              <p className="jb-detail-text">{selected.description}</p>
            </section>

            <section className="jb-detail-section">
              <h3 className="jb-section-title">Requisitos</h3>
              <p className="jb-detail-text">{selected.requirements}</p>
            </section>
          </Sheet>
        );
      })()}

      {/* ── Consentimiento ── */}
      {showConsent && consentVacancy && (
        <Sheet
          onClose={closeConsent}
          labelId="jb-consent-title"
          size="md"
          locked={applying}
          header={
            <>
              <span className="jb-eyebrow">Consentimiento de datos</span>
              <h2 id="jb-consent-title" className="jb-sheet-title">Confirmar postulación</h2>
              <span className="jb-sheet-sub">{consentVacancy.title}{consentVacancy.companyName ? ` · ${consentVacancy.companyName}` : ""}</span>
            </>
          }
          footer={
            <div className="jb-footer-row">
              <button type="button" className="jb-btn jb-btn--ghost" onClick={closeConsent} disabled={applying}>
                Cancelar
              </button>
              <button type="button" className="jb-btn jb-btn--primary" disabled={applying} onClick={handleApply}>
                {applying ? "Enviando…" : "Acepto y me postulo"}
              </button>
            </div>
          }
        >
          <div className="jb-consent">
            <p className="jb-consent-lead">
              Al confirmar, autorizás a Hidden Security a compartir los siguientes datos personales y laborales con la empresa publicante, de forma confidencial y con el único fin de evaluar tu postulación:
            </p>
            <ul className="jb-consent-list">
              <li>Nombre completo, datos de contacto y foto de perfil</li>
              <li>Experiencia laboral, educación y certificaciones</li>
              <li>Skills técnicas, proyectos y preferencias laborales</li>
            </ul>
            <p className="jb-consent-note">
              Esta información solo podrá ser utilizada en el contexto del proceso de selección para esta posición.
            </p>
          </div>
        </Sheet>
      )}

      {/* Toast */}
      {toast && (
        <div className={`jb-toast jb-toast--${toast.type}`} role="status">
          <span className="jb-toast-label">{toast.type === "success" ? "Listo" : "Error"}</span>
          {toast.msg}
        </div>
      )}

    </div>
  );
}