import { useEffect, useState, useRef, useCallback } from "react";
import "./enterpriseDashboard.css";
import { UseSession } from "../contexts/SessionContext";
import { UseShopping } from "../contexts/ShoppingContext";
import { UseTheme } from "../contexts/ThemeContext";
import VacancyManager from "./VacancyManager";

const TABS = [
  {
    id: "users", label: "USUARIOS",
    icon: (<svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><circle cx="8" cy="6" r="3"/><path d="M2 17c0-3.3 2.7-6 6-6s6 2.7 6 6"/><circle cx="15" cy="7" r="2"/><path d="M18 17c0-2.2-1.3-4-3-5"/></svg>)
  },
  {
    id: "vacancy", label: "VACANTES",
    icon: (<svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><circle cx="8" cy="6" r="3"/><path d="M2 17c0-3.3 2.7-6 6-6s6 2.7 6 6"/><circle cx="15" cy="7" r="2"/><path d="M18 17c0-2.2-1.3-4-3-5"/></svg>)
  }
];

const NOTES = [
  { freq: 523.25, delay: 0    },
  { freq: 659.25, delay: 0.13 },
  { freq: 783.99, delay: 0.26 },
  { freq: 1046.5, delay: 0.39 },
];

const EnterpriseDashboard = () => {
  const { user } = UseSession();
  const { allTickets, getAllTickets } = UseShopping();
  const { theme } = UseTheme();

  const [activeTab, setActiveTab] = useState("vacantes");
  const [toast, setToast]         = useState<string | null>(null);

  const audioCtxRef   = useRef<AudioContext | null>(null);
  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const sseRef        = useRef<EventSource | null>(null);

  const getAllTicketsRef = useRef(getAllTickets);
  const showToastRef    = useRef<(msg: string) => void>(() => {});
  useEffect(() => { getAllTicketsRef.current = getAllTickets; });

  const uncheckedCount = allTickets.filter(t => !t.checked).length;

  const playSound = useCallback(() => {
    try {
      if (!audioCtxRef.current)
        audioCtxRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
      const ctx = audioCtxRef.current;
      NOTES.forEach(({ freq, delay }) => {
        const osc  = ctx.createOscillator();
        const gain = ctx.createGain();
        const t    = ctx.currentTime + delay;
        const dur  = 0.45;
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.type = "sine";
        osc.frequency.value = freq;
        gain.gain.setValueAtTime(0, t);
        gain.gain.linearRampToValueAtTime(0.22, t + 0.02);
        gain.gain.linearRampToValueAtTime(0.18, t + 0.1);
        gain.gain.exponentialRampToValueAtTime(0.001, t + dur);
        osc.start(t);
        osc.stop(t + dur);
      });
    } catch (e) { console.error("Audio error:", e); }
  }, []);

  const showToast = (msg: string) => {
    setToast(msg);
    playSound();
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    toastTimerRef.current = setTimeout(() => setToast(null), 15000);
  };
  useEffect(() => { showToastRef.current = showToast; });

  useEffect(() => {
    if (!user?.admin) return;
    const connect = () => {
      if (sseRef.current) sseRef.current.close();
      const es = new EventSource(
        `${import.meta.env.VITE_API_URL}/api/payments/stream`,
        { withCredentials: true }
      );
      es.onmessage = (event) => {
        try {
          const sale = JSON.parse(event.data);
          getAllTicketsRef.current();
          if (!sale.checked)
            showToastRef.current(`🔔 NUEVA_VENTA — ${sale.email} · $${Number(sale.amount).toLocaleString()}`);
        } catch (e) { console.error("SSE parse error:", e); }
      };
      es.onerror = () => { es.close(); setTimeout(connect, 5000); };
      sseRef.current = es;
    };
    connect();
    return () => { sseRef.current?.close(); sseRef.current = null; };
  }, [user]); // eslint-disable-line

  if (!user?.isEnterprise) return (
    <div className={`hs-admin ${theme}`}>
      <div className="hs-unauthorized">
        <span className="hs-mono">// ACCESO_DENEGADO</span>
        <h1 className="hs-401">401</h1>
        <p>No autorizado</p>
      </div>
    </div>
  );

  return (
    <div className={`hs-admin ${theme}`}>

      {/* ── TOAST ── */}
      {toast && (
        <div className="hs-toast">
          <span className="hs-toast-dot" />
          <span>{toast}</span>
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
          {TABS.map(tab => (
            <button
              key={tab.id}
              className={`hs-tab-btn ${activeTab === tab.id ? "active" : ""}`}
              onClick={() => setActiveTab(tab.id)}
            >
              <span className="hs-tab-icon">{tab.icon}</span>
              <span className="hs-tab-label">{tab.label}</span>
              {tab.id === "sales" && uncheckedCount > 0 && (
                <span className="hs-tab-badge">{uncheckedCount}</span>
              )}
            </button>
          ))}
        </div>
      </nav>

      {/* ── CONTENIDO ── */}
      <main className="hs-content">
        {activeTab === "vacancy"   && <VacancyManager />}
      </main>

    </div>
  );
};

export default EnterpriseDashboard;