import { useEffect, useState, useRef, useCallback } from "react";
import axios from "axios";
import "./adminDashboard.css";
import Loader from "../loader/Loader";
import Charts from "./Charts";
import UserList from "./UserList";
import SalesHistory from "./SalesHistory";
import CouponCreator from "./CouponCreator";
import { UseSession } from "../contexts/SessionContext";
import { UseShopping } from "../contexts/ShoppingContext";
import { UseUsers } from "../contexts/UsersContext";
import { UseTheme } from "../contexts/ThemeContext";
import LearningProgress from "./LearningProgress";

const TABS = [
  {
    id: "charts", label: "MÉTRICAS",
    icon: (<svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d="M3 17V10M7 17V6M11 17V9M15 17V3"/></svg>)
  },
  {
    id: "sales", label: "VENTAS",
    icon: (<svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d="M3 3h2l.4 2M7 13h10l2-8H5.4M7 13l-1 4h12M9 17a1 1 0 100 2 1 1 0 000-2zM18 17a1 1 0 100 2 1 1 0 000-2z"/></svg>)
  },
  {
    id: "users", label: "USUARIOS",
    icon: (<svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><circle cx="8" cy="6" r="3"/><path d="M2 17c0-3.3 2.7-6 6-6s6 2.7 6 6"/><circle cx="15" cy="7" r="2"/><path d="M18 17c0-2.2-1.3-4-3-5"/></svg>)
  },
  {
    id: "coupons", label: "CUPONES",
    icon: (<svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d="M3 7a2 2 0 012-2h10a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2V7z"/><path d="M7 10h6M10 7v6"/></svg>)
  },
  {
    id: "progress", label: "PROGRESOS",
    icon: (<svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d="M10 3a7 7 0 11-7 7"/><path d="M3 10a7 7 0 017-7" strokeDasharray="1.5 2.5"/><path d="M7.5 10.2l1.8 1.8 3.4-3.6"/></svg>)
  },
];

const NOTES = [
  { freq: 523.25, delay: 0    },
  { freq: 659.25, delay: 0.13 },
  { freq: 783.99, delay: 0.26 },
  { freq: 1046.5, delay: 0.39 },
];

// "checking" → esperando al servidor · "ok" → admin real
// "threat"   → el servidor detectó que NO es admin (incidente registrado + ban)
// "denied"   → sin sesión válida o error de red: no se muestra nada
type AccessStatus = "checking" | "ok" | "threat" | "denied";

const AdminDashboard = () => {
  const { user/* , handleUnbanUser, handleBanUser */ } = UseSession();

  // ── Verificación de acceso contra el servidor ─────────────────────────────
  // El panel NO se renderiza (ni pide datos) hasta que el servidor confirme
  // con el token firmado que el usuario es admin. El user del contexto no
  // alcanza: se puede falsear con un proxy (Burp).
  const [access, setAccess]         = useState<AccessStatus>("checking");
  const [incidentId, setIncidentId] = useState<string | null>(null);
  const verifyStartedRef            = useRef(false);

  useEffect(() => {
    // Evita el doble pedido de React StrictMode en desarrollo
    if (verifyStartedRef.current) return;
    verifyStartedRef.current = true;

    axios.post(
      `${import.meta.env.VITE_API_URL}/admin/verify-access`,
      {
        path: window.location.pathname,
        tab:  localStorage.getItem("hs_admin_tab") ?? "charts",
      },
      { withCredentials: true, timeout: 10000 }
    )
      .then((res) => {
        setAccess(res.data?.ok === true ? "ok" : "denied");
      })
      .catch((err) => {
        const data = err.response?.data;
        if (data?.code === "SECURITY_THREAT") {
          setIncidentId(data.incidentId ?? null);
          setAccess("threat");
          return;
        }
        setAccess("denied");
      });
  }, []);
  const { allTickets, getAllTickets }             = UseShopping();
  const { /* users, */ getUsers }                      = UseUsers();
  const { theme }                                = UseTheme();

  const [activeTab, setActiveTab] = useState<string>(() => {
    return localStorage.getItem("hs_admin_tab") ?? "charts";
  });
  const [toast, setToast] = useState<string | null>(null);

  const handleTabChange = (tabId: string) => {
    setActiveTab(tabId);
    localStorage.setItem("hs_admin_tab", tabId);
  };

  const audioCtxRef   = useRef<AudioContext | null>(null);
  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const sseRef        = useRef<EventSource | null>(null);

  const getAllTicketsRef = useRef(getAllTickets);
  const showToastRef    = useRef<(msg: string) => void>(() => {});
  useEffect(() => { getAllTicketsRef.current = getAllTickets; });

  const uncheckedCount = allTickets.filter((t: any) => !t.checked).length;

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

  // Los datos solo se piden cuando el servidor confirmó que es admin
  useEffect(() => {
    if (access === "ok") { getAllTickets(); getUsers(); }
  }, [access]); // eslint-disable-line

  useEffect(() => {
    if (access !== "ok") return;
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
  }, [access]); // eslint-disable-line

  // ── Esperando confirmación del servidor: no se muestra nada del panel ─────
  if (access === "checking") return <Loader />;

  // ── Amenaza detectada: el servidor ya registró el incidente y baneó ───────
  if (access === "threat") return (
    <div className={`hs-admin ${theme}`}>
      <div className="hs-unauthorized">
        <span className="hs-mono">// AMENAZA_DE_SEGURIDAD_DETECTADA</span>
        <h1 className="hs-401">403</h1>
        <p>Se detectó un intento de acceso no autorizado al panel de administración.</p>
        <p>El incidente fue registrado con los datos de tu sesión y tu cuenta fue suspendida.</p>
        {incidentId && <span className="hs-mono">// INCIDENTE_ID: {incidentId}</span>}
      </div>
    </div>
  );

  if (access !== "ok") return (
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
      {toast && (() => {
        // "🔔 NUEVA_VENTA — email · $monto" → título + detalle (solo presentación)
        const [rawTitle, ...rest] = toast.split(" — ");
        const hasDetail = rest.length > 0;
        const title  = hasDetail ? rawTitle.replace(/^\W+/u, "").replace(/_/g, " ") : "Notificación";
        const detail = hasDetail ? rest.join(" — ") : toast;
        const [who, amount] = detail.split(" · ");
        return (
          <div className="hs-toast" role="status" aria-live="polite" key={toast}>
            <span className="hs-toast-icon" aria-hidden="true">
              <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <path d="M10 3a5 5 0 00-5 5v3l-1.5 2.5h13L15 11V8a5 5 0 00-5-5z" />
                <path d="M8.5 16a1.5 1.5 0 003 0" />
              </svg>
            </span>
            <div className="hs-toast-body">
              <span className="hs-toast-title">
                <span className="hs-toast-dot" aria-hidden="true" />
                {title}
              </span>
              <span className="hs-toast-detail">
                <span className="hs-toast-who">{who}</span>
                {amount && <span className="hs-toast-amount">{amount}</span>}
              </span>
            </div>
            <button className="hs-toast-close" onClick={() => setToast(null)} aria-label="Cerrar notificación">✕</button>
            <span className="hs-toast-progress" aria-hidden="true" />
          </div>
        );
      })()}

      {/* ── HEADER ── */}
      <header className="hs-header">
        <div className="hs-header-inner">
          <div className="hs-header-left">
            <span className="hs-mono hs-eyebrow">// HIDDEN_SECURITY</span>
            <h1 className="hs-header-title">ADMIN_<span>DASHBOARD</span></h1>
          </div>
          <div className="hs-header-meta">
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
          {TABS.map(tab => (
            <button
              key={tab.id}
              className={`hs-tab-btn ${activeTab === tab.id ? "active" : ""}`}
              onClick={() => handleTabChange(tab.id)}
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
        {activeTab === "charts"  && <Charts allTickets={allTickets} />}
        {activeTab === "sales"   && <SalesHistory allTickets={allTickets} />}
        {activeTab === "users"   && <UserList /* users={users} handleBanUser={handleBanUser} handleUnbanUser={handleUnbanUser} */ />}
        {activeTab === "coupons" && <CouponCreator />}
        {activeTab === "progress" && <LearningProgress />}
      </main>

    </div>
  );
};

export default AdminDashboard;