import { useEffect, useState, useRef, useCallback } from "react";
import "./enterpriseDashboard.css";
import { UseSession } from "../contexts/SessionContext";
import { UseShopping } from "../contexts/ShoppingContext";
import { UseTheme } from "../contexts/ThemeContext";
import VacancyManager from "./VacancyManager";
import UsersDatabase from "./usersDataBase";
import PostuladosTab from "./PostuladosTab";

// ─── Types ────────────────────────────────────────────────────────────────────
interface ApplicantEvent {
  vacancyId:     string;
  vacancyTitle:  string;
  userId:        string;
  applicantName: string;
  createdAt:     string;
}

// ─── Constantes ───────────────────────────────────────────────────────────────
const NOTES = [
  { freq: 523.25, delay: 0    },
  { freq: 659.25, delay: 0.13 },
  { freq: 783.99, delay: 0.26 },
  { freq: 1046.5, delay: 0.39 },
];

// ─── Badge helper ─────────────────────────────────────────────────────────────
function ApplicantBadge({ count }: { count: number }) {
  if (count === 0) return null;
  return (
    <span className="hs-tab-badge">
      {count >= 100 ? "+99" : count}
    </span>
  );
}

// ─── EnterpriseDashboard ──────────────────────────────────────────────────────
const EnterpriseDashboard = () => {
  const { user }                         = UseSession();
  const { getAllTickets }     = UseShopping();
  const { theme }                        = UseTheme();

  const [activeTab, setActiveTab] = useState<string>(() => {
    return localStorage.getItem("hs_enterprise_tab") ?? "vacancy";
  });
  const [toast,           setToast]           = useState<{ msg: string; color: string; bg: string } | null>(null);
  const [applicantCount,  setApplicantCount]  = useState(0);
  const [,   setNewApplicants]   = useState<ApplicantEvent[]>([]);

  // ── Plan B2B info ─────────────────────────────────────────────
  const [planInfo, setPlanInfo] = useState<{
    plan:     string;
    expiry:   Date;
    limit:    number | null;
    used:     number;
    daysLeft: number;
  } | null>(null);

  useEffect(() => {
    
    if (!user) return;
    const plan      = (user as any).enterprisePlan       ?? null;
    const expiryStr = (user as any).enterprisePlanExpiry ?? null;
    const limit     = (user as any).vacancyLimit         ?? null;
    const used      = (user as any).vacanciesUsed        ?? 0;

    if (!plan || !expiryStr) { setPlanInfo(null); return; }

    const expiry   = new Date(expiryStr);
    if (expiry <= new Date()) { setPlanInfo(null); return; }

    const msLeft   = expiry.getTime() - Date.now();
    const daysLeft = Math.ceil(msLeft / (1000 * 60 * 60 * 24));
    setPlanInfo({ plan, expiry, limit, used, daysLeft });
  }, [user]);

  const audioCtxRef        = useRef<AudioContext | null>(null);
  const toastTimerRef      = useRef<ReturnType<typeof setTimeout> | null>(null);
  const sseSalesRef        = useRef<EventSource | null>(null);
  const sseApplicantsRef   = useRef<EventSource | null>(null);
  const getAllTicketsRef    = useRef(getAllTickets);
  const showToastRef       = useRef<(msg: string, color?: string, bg?: string) => void>(() => {});
  const activeTabRef       = useRef(activeTab);

  useEffect(() => { getAllTicketsRef.current = getAllTickets; });
  useEffect(() => { activeTabRef.current = activeTab; }, [activeTab]);


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

  // Limpiar badge al entrar al tab de postulados y persistir en localStorage
  const handleTabChange = (id: string) => {
    setActiveTab(id);
    localStorage.setItem("hs_enterprise_tab", id);
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
    {
      id: "users", label: "USUARIOS",
      icon: (<svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><circle cx="8" cy="6" r="3"/><path d="M2 17c0-3.3 2.7-6 6-6s6 2.7 6 6"/><path d="M14 9l1.5 1.5L18 8"/></svg>),
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
            {/* Plan B2B activo */}
            {planInfo && (
              <div className="hs-plan-badge">
                <span className="hs-plan-badge-name">
                  {planInfo.plan.toUpperCase()}
                </span>
                <span className="hs-plan-badge-sep">·</span>
                <span className={`hs-plan-badge-days${planInfo.daysLeft <= 30 ? " hs-plan-badge-days--warn" : ""}`}>
                  {planInfo.daysLeft}d
                </span>
                {planInfo.limit !== null && (
                  <>
                    <span className="hs-plan-badge-sep">·</span>
                    <span className="hs-plan-badge-slots">
                      {planInfo.used}/{planInfo.limit} pub.
                    </span>
                  </>
                )}
              </div>
            )}
            <span className="hs-header-user">
              <span className="hs-live-dot" />
              {user?.email}
            </span>
            <span className="hs-sse-badge">
              <span className="hs-live-dot" />
              ONLINE
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
        {activeTab === "users" && <UsersDatabase />}
      </main>

    </div>
  );
};

export default EnterpriseDashboard;