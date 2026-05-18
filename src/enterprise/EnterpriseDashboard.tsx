import { useEffect, useState, useRef, useCallback } from "react";
import axios from "axios";
import "./enterpriseDashboard.css";
import { UseSession } from "../contexts/SessionContext";
import { UseShopping } from "../contexts/ShoppingContext";
import { UseTheme } from "../contexts/ThemeContext";
import VacancyManager from "./VacancyManager";

// ─── Types ────────────────────────────────────────────────────────────────────
interface ApplicantEvent {
  vacancyId:    string;
  vacancyTitle: string;
  userId:       string;
  createdAt:    string;
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
  filter_1:   { label: "Filtro 1",        color: "#a78bfa" },
  filter_2:   { label: "Filtro 2",        color: "#818cf8" },
  filter_3:   { label: "Filtro 3",        color: "#6366f1" },
  contact:    { label: "Te contactaremos",   color: "#22c55e" },
  rejected:   { label: "No seleccionado",    color: "#f43f5e" },
};

// ─── Badge helper ─────────────────────────────────────────────────────────────
function ApplicantBadge({ count }: { count: number }) {
  if (count === 0) return null;
  return (
    <span className="hs-tab-badge">
      {count >= 100 ? "+99" : count}
    </span>
  );
}

// ─── Tab: Postulados ──────────────────────────────────────────────────────────
function PostuladosTab() {
  const [vacancies,       setVacancies]       = useState<VacancySummary[]>([]);
  const [loading,         setLoading]         = useState(true);
  const [expanded,        setExpanded]        = useState<string | null>(null);
  const [updatingStatus,  setUpdatingStatus]  = useState<string | null>(null);

  const fetchVacancies = () => {
    axios
      .get(`${import.meta.env.VITE_API_URL}/api/vacancies`, { withCredentials: true })
      .then(({ data }) => setVacancies(Array.isArray(data.data) ? data.data : []))
      .catch(console.error)
      .finally(() => setLoading(false));
  };

  useEffect(() => { fetchVacancies(); }, []);

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
                      return (
                        <div key={applicant.userId} className="hs-postulados-applicant-row">
                          <span className="hs-postulados-applicant-num">#{i + 1}</span>
                          <div className="hs-postulados-applicant-info">
                            <span className="hs-postulados-applicant-uid">{applicant.userId}</span>
                            {applicant.appliedAt && (
                              <span className="hs-postulados-applicant-date">
                                {new Date(applicant.appliedAt).toLocaleDateString("es-AR", { day: "2-digit", month: "short", year: "numeric" })}
                              </span>
                            )}
                          </div>
                          <div className="hs-postulados-applicant-status">
                            <span
                              className="hs-postulados-status-dot"
                              style={{ background: statusInfo.color }}
                            />
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
    </div>
  );
}

// ─── EnterpriseDashboard ──────────────────────────────────────────────────────
const EnterpriseDashboard = () => {
  const { user }                         = UseSession();
  const { allTickets, getAllTickets }     = UseShopping();
  const { theme }                        = UseTheme();

  const [activeTab,       setActiveTab]       = useState("vacancy");
  const [toast,           setToast]           = useState<{ msg: string; color: string; bg: string } | null>(null);
  const [applicantCount,  setApplicantCount]  = useState(0);
  const [newApplicants,   setNewApplicants]   = useState<ApplicantEvent[]>([]);

  const audioCtxRef        = useRef<AudioContext | null>(null);
  const toastTimerRef      = useRef<ReturnType<typeof setTimeout> | null>(null);
  const sseSalesRef        = useRef<EventSource | null>(null);
  const sseApplicantsRef   = useRef<EventSource | null>(null);
  const getAllTicketsRef    = useRef(getAllTickets);
  const showToastRef       = useRef<(msg: string, color?: string, bg?: string) => void>(() => {});
  const activeTabRef       = useRef(activeTab);

  useEffect(() => { getAllTicketsRef.current = getAllTickets; });
  useEffect(() => { activeTabRef.current = activeTab; }, [activeTab]);

  const uncheckedCount = allTickets.filter((t) => !t.checked).length;

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