import { useEffect, useState, useRef, useCallback } from "react";
import axios from "axios";
import "./userDashboard.css";
import { UseSession }   from "../contexts/SessionContext";
import { UseTheme }     from "../contexts/ThemeContext";
import { UseShopping }  from "../contexts/ShoppingContext";
import JobBoard         from "./JobBoard";
import CVBuilder        from "./CvBuilder";
import CourseCatalog    from "../courses/CourseCatalog";

// ─── Types ────────────────────────────────────────────────────────────────────
interface UserNotification {
  id:           string;
  type:         string;
  vacancyId:    string;
  vacancyTitle: string;
  companyName:  string | null;
  companyLogo:  string | null;
  status:       string;
  createdAt:    string;
  read:         boolean;
}

// ─── Labels de estado ─────────────────────────────────────────────────────────
const APP_STATUS: Record<string, { label: string; color: string; bg: string; toastMsg: string }> = {
  pending:  { label: "Postulación enviada",              color: "#94a3b8", bg: "rgba(148,163,184,0.1)", toastMsg: "Tu postulación fue recibida"             },
  cv_read:  { label: "Tu CV fue leído",                  color: "#38bdf8", bg: "rgba(56,189,248,0.1)",  toastMsg: "Una empresa leyó tu CV"                  },
  filter_1: { label: "Pasaste el filtro 1 ✓",            color: "#a78bfa", bg: "rgba(167,139,250,0.1)", toastMsg: "¡Pasaste el primer filtro!"               },
  filter_2: { label: "Pasaste el filtro 2 ✓",            color: "#818cf8", bg: "rgba(129,140,248,0.1)", toastMsg: "¡Pasaste el segundo filtro!"              },
  filter_3: { label: "Pasaste el filtro 3 ✓",            color: "#6366f1", bg: "rgba(99,102,241,0.1)",  toastMsg: "¡Pasaste el tercer filtro!"               },
  contact:  { label: "La empresa se contactará contigo", color: "#22c55e", bg: "rgba(34,197,94,0.1)",   toastMsg: "¡La empresa se va a contactar con vos!"   },
  rejected: { label: "No fuiste seleccionado",           color: "#f43f5e", bg: "rgba(244,63,94,0.1)",   toastMsg: "Tu postulación no fue seleccionada"        },
};

// Notas por tipo de estado — positivos suben, negativo baja
const STATUS_NOTES: Record<string, { freq: number; delay: number }[]> = {
  cv_read:  [{ freq: 660, delay: 0 }, { freq: 880, delay: 0.12 }],
  filter_1: [{ freq: 660, delay: 0 }, { freq: 880, delay: 0.12 }, { freq: 1100, delay: 0.24 }],
  filter_2: [{ freq: 660, delay: 0 }, { freq: 880, delay: 0.12 }, { freq: 1100, delay: 0.24 }, { freq: 1320, delay: 0.36 }],
  filter_3: [{ freq: 660, delay: 0 }, { freq: 880, delay: 0.12 }, { freq: 1100, delay: 0.24 }, { freq: 1320, delay: 0.36 }, { freq: 1760, delay: 0.48 }],
  contact:  [{ freq: 523, delay: 0 }, { freq: 659, delay: 0.1  }, { freq: 784, delay: 0.2  }, { freq: 1047, delay: 0.3 }],
  rejected: [{ freq: 330, delay: 0 }, { freq: 262, delay: 0.2 }],
  default:  [{ freq: 523, delay: 0 }],
};

// ─── UserDashboard ────────────────────────────────────────────────────────────
const UserDashboard = () => {
    const { user, loading: sessionLoading } = UseSession();
    const { purchased, getPurchased, loading: loadingPurchases } = UseShopping();
    const { theme } = UseTheme();

    const [expandedId,    setExpandedId]    = useState<string | null>(null);
    const [activeTab, setActiveTab] = useState<"compras" | "cuenta" | "bolsa" | "notif" | "cv" | "cursos">(() => {
        const stored = localStorage.getItem("hs_user_tab");
        const valid  = ["compras", "cuenta", "bolsa", "notif", "cv", "cursos"];
        return (valid.includes(stored ?? "") ? stored : "cuenta") as "compras" | "cuenta" | "bolsa" | "notif" | "cv" | "cursos";
    });
    const [notifications, setNotifications] = useState<UserNotification[]>([]);
    const [unreadCount,   setUnreadCount]   = useState(0);
    const [toast,         setToast]         = useState<{ msg: string; color: string; bg: string } | null>(null);
    const [cvProfile,     setCvProfile]     = useState<{ firstName: string; lastName: string; photo: string } | null>(null);

    const sseRef       = useRef<EventSource | null>(null);
    const audioCtxRef  = useRef<AudioContext | null>(null);
    const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const activeTabRef = useRef(activeTab);
    useEffect(() => { activeTabRef.current = activeTab; }, [activeTab]);

    // Cargar notificaciones desde DB al montar
    useEffect(() => {
        if (!user?.userCertificated) return;
        axios.get(`${import.meta.env.VITE_API_URL}/api/notifications`, { withCredentials: true })
            .then(({ data }) => {
                setNotifications(Array.isArray(data.data) ? data.data : []);
                setUnreadCount(data.unreadCount ?? 0);
            })
            .catch(() => {});
    }, [user?.uid, user?.userCertificated]);

    useEffect(() => {
        if (user && user.email) getPurchased(user.email);
    }, [user?.email, user]);

    // Cargar datos del CV para el hero
    const fetchCvProfile = () => {
        if (!user) return;
        axios.get(`${import.meta.env.VITE_API_URL}/api/cv/me`, { withCredentials: true })
            .then(({ data }) => {
                if (data.data?.personalInfo) {
                    const { firstName, lastName, photo } = data.data.personalInfo;
                    if (firstName || lastName || photo) {
                        setCvProfile({ firstName: firstName ?? "", lastName: lastName ?? "", photo: photo ?? "" });
                    }
                }
            })
            .catch(() => {});
    };

    useEffect(() => { fetchCvProfile(); }, [user]); // eslint-disable-line

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

    // ── Sonido ────────────────────────────────────────────────────────────────
    const playSound = useCallback((notes: { freq: number; delay: number }[]) => {
        try {
            if (!audioCtxRef.current)
                audioCtxRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
            const ctx = audioCtxRef.current;
            notes.forEach(({ freq, delay }) => {
                const osc  = ctx.createOscillator();
                const gain = ctx.createGain();
                const t    = ctx.currentTime + delay;
                const dur  = 0.4;
                osc.connect(gain); gain.connect(ctx.destination);
                osc.type = "sine"; osc.frequency.value = freq;
                gain.gain.setValueAtTime(0, t);
                gain.gain.linearRampToValueAtTime(0.2, t + 0.02);
                gain.gain.linearRampToValueAtTime(0.15, t + 0.1);
                gain.gain.exponentialRampToValueAtTime(0.001, t + dur);
                osc.start(t); osc.stop(t + dur);
            });
        } catch (e) { console.error("Audio error:", e); }
    }, []);

    // ── Toast ─────────────────────────────────────────────────────────────────
    const showToast = useCallback((msg: string, color: string, bg: string) => {
        setToast({ msg, color, bg });
        if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
        toastTimerRef.current = setTimeout(() => setToast(null), 6000);
    }, []);

    // ── SSE notificaciones ────────────────────────────────────────────────────
    useEffect(() => {
        if (!user?.userCertificated) return;

        const connect = () => {
            if (sseRef.current) sseRef.current.close();
            const es = new EventSource(
                `${import.meta.env.VITE_API_URL}/api/user/notifications/stream`,
                { withCredentials: true }
            );

            es.onmessage = (event) => {
                try {
                    const data = JSON.parse(event.data);
                    if (data.type !== "application_status") return;

                    const statusInfo = APP_STATUS[data.status] ?? APP_STATUS.pending;
                    const notes      = STATUS_NOTES[data.status] ?? STATUS_NOTES.default;

                    const notif: UserNotification = {
                        id:           data.id ?? `${Date.now()}-${Math.random()}`,
                        type:         data.type,
                        vacancyId:    data.vacancyId,
                        vacancyTitle: data.vacancyTitle,
                        companyName:  data.companyName ?? null,
                        companyLogo:  data.companyLogo ?? null,
                        status:       data.status,
                        createdAt:    data.createdAt,
                        read:         activeTabRef.current === "notif",
                    };

                    setNotifications((prev) => [notif, ...prev].slice(0, 50));
                    if (activeTabRef.current !== "notif") setUnreadCount((prev) => prev + 1);

                    // Sonido y toast visual
                    playSound(notes);
                    showToast(
                        `${statusInfo.toastMsg} — ${data.vacancyTitle}`,
                        statusInfo.color,
                        statusInfo.bg
                    );
                } catch (e) { console.error("SSE notif parse error:", e); }
            };

            es.onerror = () => { es.close(); setTimeout(connect, 5000); };
            sseRef.current = es;
        };

        connect();
        return () => { sseRef.current?.close(); sseRef.current = null; };
    }, [user, playSound, showToast]); // eslint-disable-line

    const handleTabChange = (tab: typeof activeTab) => {
        setActiveTab(tab);
        localStorage.setItem("hs_user_tab", tab);
        if (tab === "notif") {
            setUnreadCount(0);
            setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
            axios.patch(`${import.meta.env.VITE_API_URL}/api/notifications/read-all`, {}, { withCredentials: true })
                .catch(() => {});
        }
        if (activeTab === "cv" && tab !== "cv") {
            fetchCvProfile();
        }
    };

    const purchases    = Array.isArray(purchased) ? purchased : [];
    const totalGastado = purchases.filter(p => p.status === "approved").reduce((acc, p) => acc + (p.calculo?.totalFinal ?? p.amount), 0);
    const totalOrdenes = purchases.filter(p => p.status === "approved").length;
    const ultimaCompra = purchases.length > 0 ? new Date(purchases[0].createdAt).toLocaleDateString("es-AR") : "—";

    if (sessionLoading) {
        return (
            <div className={`dm-container ${theme}`}>
                <div className="dm-loading">
                    <span className="dm-loading-dot" /><span className="dm-loading-dot" /><span className="dm-loading-dot" />
                </div>
            </div>
        );
    }

    if (!user) {
        return (
            <div className={`dm-container ${theme}`}>
                <div className="dm-empty-state">
                    <span className="dm-empty-icon">⊘</span>
                    <p>NO_SESSION_ACTIVE</p>
                </div>
            </div>
        );
    }

    return (
        <div className={`dm-container ${theme}`}>

            {/* ── TOAST NOTIFICACIÓN ── */}
            {toast && (
                <div
                    className="dm-notif-toast"
                    style={{ borderColor: toast.color, background: toast.bg }}
                    onClick={() => setToast(null)}
                >
                    <span className="dm-notif-toast-dot" style={{ background: toast.color }} />
                    <span className="dm-notif-toast-msg">{toast.msg}</span>
                    <button className="dm-notif-toast-close">×</button>
                </div>
            )}

            {/* ── HERO PERFIL ── */}
            <div className="dm-hero">
                <div className="dm-hero-left">
                    <div className="dm-avatar">
                        {cvProfile?.photo
                            ? <img src={cvProfile.photo} alt="Foto de perfil" className="dm-avatar-photo" />
                            : (cvProfile?.firstName || cvProfile?.lastName)
                                ? (cvProfile.firstName.charAt(0) + (cvProfile.lastName.charAt(0) ?? "")).toUpperCase()
                                : (user.nombre?.charAt(0).toUpperCase() ?? user.email.charAt(0).toUpperCase())
                        }
                    </div>
                    <div className="dm-hero-info">
                        <h1 className="dm-hero-name">
                            {(cvProfile?.firstName || cvProfile?.lastName)
                                ? `${cvProfile.firstName} ${cvProfile.lastName}`.trim()
                                : (user.nombre || user.email.split("@")[0])
                            }
                        </h1>
                        <p className="dm-hero-email">{user.email}</p>
                    </div>
                </div>
                <div className="dm-hero-right">
                    <div className="dm-hero-badge">
                        {user.userCertificated ? "CERTIFICADO" : "ESTUDIANTE"}
                    </div>
                    {user.userCertificated && (
                        <span className="dm-live-badge">
                            <span className="dm-live-dot" />
                            ONLINE
                        </span>
                    )}
                </div>
            </div>

            {/* ── STATS ── */}
            <div className="dm-stats">
                <div className="dm-stat">
                    <span className="dm-stat-label">ÓRDENES</span>
                    <span className="dm-stat-value">{totalOrdenes}</span>
                </div>
                <div className="dm-stat dm-stat-accent">
                    <span className="dm-stat-label">TOTAL GASTADO</span>
                    <span className="dm-stat-value">${totalGastado.toLocaleString("es-AR")}</span>
                </div>
                <div className="dm-stat">
                    <span className="dm-stat-label">ÚLTIMA COMPRA</span>
                    <span className="dm-stat-value dm-stat-small">{ultimaCompra}</span>
                </div>
            </div>

            {/* ── TABS ── */}
            <div className="dm-tabs">
                <button className={`dm-tab ${activeTab === "compras" ? "active" : ""}`} onClick={() => handleTabChange("compras")}>
                    HISTORIAL
                </button>
                <button className={`dm-tab ${activeTab === "cursos" ? "active" : ""}`} onClick={() => handleTabChange("cursos")}>
                    CURSOS
                </button>
                <button className={`dm-tab ${activeTab === "bolsa" ? "active" : ""}`} onClick={() => handleTabChange("bolsa")}>
                    BOLSA DE TRABAJO
                </button>
                <button className={`dm-tab ${activeTab === "cv" ? "active" : ""}`} onClick={() => handleTabChange("cv")}>
                    MI CV
                </button>
                {user.userCertificated && (
                    <button className={`dm-tab dm-tab--notif ${activeTab === "notif" ? "active" : ""}`} onClick={() => handleTabChange("notif")}>
                        NOTIFICACIONES
                        {unreadCount > 0 && (
                            <span className="dm-notif-badge">
                                {unreadCount >= 100 ? "+99" : unreadCount}
                            </span>
                        )}
                    </button>
                )}
                <button className={`dm-tab ${activeTab === "cuenta" ? "active" : ""}`} onClick={() => handleTabChange("cuenta")}>
                    MI CUENTA
                </button>
            </div>

            {/* ══ TAB: HISTORIAL ══ */}
            {activeTab === "compras" && (
                <div className="dm-section">
                    {loadingPurchases ? (
                        <div className="dm-loading">
                            <span className="dm-loading-dot" /><span className="dm-loading-dot" /><span className="dm-loading-dot" />
                        </div>
                    ) : purchases.length === 0 ? (
                        <div className="dm-empty-state">
                            <span className="dm-empty-icon">◫</span>
                            <p>SIN_COMPRAS_REGISTRADAS</p>
                        </div>
                    ) : (
                        <div className="dm-purchase-list">
                            {purchases.map((p) => {
                                const isExpanded = expandedId === p._id;
                                return (
                                    <div key={p._id} className="dm-purchase-wrapper">
                                        <div className="dm-purchase-row" onClick={() => setExpandedId(isExpanded ? null : p._id)}>
                                            <div className="dm-purchase-left">
                                                <span className="dm-purchase-date">[{new Date(p.createdAt).toLocaleDateString("es-AR")}]</span>
                                                <span className="dm-purchase-id">{p.orderId || p._id.slice(-8).toUpperCase()}</span>
                                            </div>
                                            <div className="dm-purchase-right">
                                                <span className={`dm-status ${p.status?.toLowerCase()}`}>{p.status?.toUpperCase()}</span>
                                                {p.invoiceSent && <span className="dm-invoice-badge" title="Factura enviada">✓ FACTURA RECIBIDA POR EMAIL</span>}
                                                <span className="dm-purchase-amount">${(p.calculo?.totalFinal ?? p.amount)?.toLocaleString("es-AR")}</span>
                                                <span className="dm-chevron">{isExpanded ? "▲" : "▼"}</span>
                                            </div>
                                        </div>
                                        {isExpanded && (
                                            <div className="dm-purchase-detail">
                                                <div className="dm-detail-block">
                                                    <span className="dm-detail-title">RESUMEN DE PAGO</span>
                                                    {p.calculo ? (
                                                        <>
                                                            <div className="dm-detail-row"><span>Cuotas</span><strong>{p.calculo.cuotas}x</strong></div>
                                                            <div className="dm-detail-row"><span>Subtotal</span><strong>${p.calculo.subtotalBase?.toLocaleString("es-AR")}</strong></div>
                                                            {p.calculo.descuentoCupon > 0 && <div className="dm-detail-row dm-green"><span>Descuento</span><strong>- ${p.calculo.descuentoCupon?.toLocaleString("es-AR")}</strong></div>}
                                                            {p.calculo.costoFinanciacion > 0 && <div className="dm-detail-row dm-red"><span>Financiación</span><strong>+ ${p.calculo.costoFinanciacion?.toLocaleString("es-AR")}</strong></div>}
                                                            {p.calculo.cupon && <div className="dm-detail-row"><span>Cupón</span><strong>{p.calculo.cupon.code} — {p.calculo.cupon.discount}%</strong></div>}
                                                            <div className="dm-detail-row dm-total"><span>TOTAL</span><strong>${p.calculo.totalFinal?.toLocaleString("es-AR")}</strong></div>
                                                        </>
                                                    ) : (
                                                        <div className="dm-detail-row dm-total"><span>TOTAL</span><strong>${p.amount?.toLocaleString("es-AR")}</strong></div>
                                                    )}
                                                </div>
                                                {p.items && p.items.length > 0 && (
                                                    <div className="dm-detail-block">
                                                        <span className="dm-detail-title">PRODUCTOS</span>
                                                        {p.items.map((item, i) => (
                                                            <div key={i} className="dm-item-row">
                                                                <div className="dm-item-info">
                                                                    <strong>{item.nombre}</strong>
                                                                    {item.varianteLabel && <em className="dm-variante">{item.varianteLabel}</em>}
                                                                </div>
                                                                <div className="dm-item-right">
                                                                    <span className="dm-item-price">${item.totalItem?.toLocaleString("es-AR")}</span>
                                                                </div>
                                                            </div>
                                                        ))}
                                                    </div>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>
            )}

            {/* ══ TAB: BOLSA DE TRABAJO ══ */}
            {activeTab === "bolsa" && <JobBoard />}

            {/* ══ TAB: MI CV ══ */}
            {activeTab === "cv" && (
                <div className="dm-section">
                    <CVBuilder />
                </div>
            )}

            {/* ══ TAB: CURSOS ══ */}
            {activeTab === "cursos" && (
                <div className="dm-section">
                    <CourseCatalog />
                </div>
            )}

            {/* ══ TAB: NOTIFICACIONES ══ */}
            {activeTab === "notif" && (
                <div className="dm-section">
                    {notifications.length === 0 ? (
                        <div className="dm-empty-state">
                            <span className="dm-empty-icon">◫</span>
                            <p>SIN_NOTIFICACIONES</p>
                            <p style={{ fontSize: "0.75rem", opacity: 0.4, marginTop: 8 }}>
                                Cuando una empresa actualice tu postulación, aparecerá acá.
                            </p>
                        </div>
                    ) : (
                        <div className="dm-notif-list">
                            {notifications.map((n) => {
                                const statusInfo = APP_STATUS[n.status] ?? APP_STATUS.pending;
                                return (
                                    <div
                                        key={n.id}
                                        className={`dm-notif-item${n.read ? "" : " dm-notif-item--unread"}`}
                                        style={{ borderLeftColor: statusInfo.color }}
                                    >
                                        {/* Empresa */}
                                        <div className="dm-notif-company">
                                            {n.companyLogo
                                                ? <img src={n.companyLogo} alt={n.companyName ?? "empresa"} className="dm-notif-logo" />
                                                : <div className="dm-notif-logo-placeholder">{(n.companyName ?? "?")[0].toUpperCase()}</div>
                                            }
                                            <span className="dm-notif-company-name">{n.companyName ?? "Empresa"}</span>
                                        </div>

                                        {/* Vacante */}
                                        <p className="dm-notif-vacancy">{n.vacancyTitle}</p>

                                        {/* Estado */}
                                        <div className="dm-notif-status" style={{ background: statusInfo.bg, borderColor: statusInfo.color }}>
                                            <span className="dm-notif-status-dot" style={{ background: statusInfo.color }} />
                                            <span className="dm-notif-status-label" style={{ color: statusInfo.color }}>
                                                {statusInfo.label}
                                            </span>
                                        </div>

                                        {/* Fecha */}
                                        <p className="dm-notif-date">
                                            {new Date(n.createdAt).toLocaleDateString("es-AR", { day: "2-digit", month: "long", year: "numeric" })}
                                            {" · "}
                                            {new Date(n.createdAt).toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit" })}
                                        </p>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>
            )}

            {/* ══ TAB: MI CUENTA ══ */}
            {activeTab === "cuenta" && (
                <div className="dm-section">
                    <div className="dm-account-grid">
                        <div className="dm-account-card">
                            <span className="dm-account-card-label">EMAIL</span>
                            <span className="dm-account-card-value dm-account-card-value--small">{user.email}</span>
                        </div>
                        <div className="dm-account-card">
                            <span className="dm-account-card-label">ROL</span>
                            <span className="dm-account-card-value">{user.rol?.toUpperCase() || "ESTUDIANTE"}</span>
                        </div>
                        <div className="dm-account-card">
                            <span className="dm-account-card-label">CERTIFICACIÓN</span>
                            <span className="dm-account-card-value" style={{ color: user.userCertificated ? "#22c55e" : "inherit" }}>
                                {user.userCertificated ? "✓ CERTIFICADO" : "PENDIENTE"}
                            </span>
                        </div>
                    </div>
                    {purchases.some(p => p.status === "approved" && !p.invoiceSent) && (
                        <div className="dm-notice">
                            <span className="dm-notice-dot" />
                            Tenés órdenes aprobadas con factura pendiente de envío.
                        </div>
                    )}
                </div>
            )}

        </div>
    );
};

export default UserDashboard;