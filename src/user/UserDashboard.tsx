import { useEffect, useState, useRef, useCallback, useMemo } from "react";
import axios from "axios";
import "./userDashboard.css";
import { UseSession }   from "../contexts/SessionContext";
import { UseTheme }     from "../contexts/ThemeContext";
import { UseShopping }  from "../contexts/ShoppingContext";
import JobBoard         from "./JobBoard";
import CVBuilder        from "./CvBuilder";
import CourseCatalog    from "../courses/CourseCatalog";
import CertificationCatalog from "../certifications/CertificationCatalog";
import { useNavigate } from "react-router-dom";

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

// Ticket de compra tal como lo devuelve GET /tickets (sin datos de Mercado Pago)
interface PurchaseTicket {
    id:          string;
    reference:   string;
    date:        string;
    items:       string[];
    subtotal:    number;
    amount:      number;
    cuotas:      number;
    couponCode:  string | null;
    discount:    number;
    status:      "approved" | "pending" | "rejected" | "cancelled" | "refunded" | "charged_back" | "in_mediation";
    reason:      string | null;
    activated:   boolean;
    expiresAt:   string | null;
    invoiceSent: boolean;
    isTest:      boolean;
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

// ─── Membership: labels y helper de cálculo de vigencia ───────────────────────
const PLAN_LABELS: Record<string, string> = {
    starter:    "STARTER",
    pro:        "PRO",
    elite:      "ELITE",
    business:   "BUSINESS",
    enterprise: "ENTERPRISE",
};

interface MembershipInfo {
    activePlanId:   string | null;
    activeExpiry:   Date | null;
    voucherCount:   number;
    daysRemaining:  number;
    hoursRemaining: number;
    hasAnyPurchase: boolean;
}

// Recorre purchases/purchaseExpiry (custom claims de Firebase) y calcula:
// - el plan activo no vencido (si hay varios registrados, toma el primero vigente)
// - cuánto tiempo le queda (días + horas restantes dentro del último día)
// - cuántos vouchers de certificación tiene disponibles
function getMembershipInfo(user: any): MembershipInfo {
    const purchases: string[] = Array.isArray(user?.purchases) ? user.purchases : [];
    const purchaseExpiry: Record<string, string> = user?.purchaseExpiry ?? {};

    const now = new Date();
    let activePlanId: string | null = null;
    let activeExpiry:  Date   | null = null;

    for (const planId of purchases) {
        if (planId === 'voucher') continue; // el voucher no es un "plan" con vigencia
        const expiryStr = purchaseExpiry[planId];
        if (!expiryStr) continue;
        const expiry = new Date(expiryStr);
        if (expiry > now) {
            activePlanId = planId;
            activeExpiry = expiry;
            break;
        }
    }

    const voucherCount = purchases.filter(p => p === 'voucher').length;

    let daysRemaining  = 0;
    let hoursRemaining = 0;
    if (activeExpiry) {
        const diffMs = activeExpiry.getTime() - now.getTime();
        daysRemaining  = Math.floor(diffMs / (1000 * 60 * 60 * 24));
        hoursRemaining = Math.floor((diffMs % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    }

    return {
        activePlanId,
        activeExpiry,
        voucherCount,
        daysRemaining,
        hoursRemaining,
        hasAnyPurchase: purchases.length > 0,
    };
}

// ─── Historial de compras: catálogo, estados y mensajes ──────────────────────
const PRODUCT_INFO: Record<string, { name: string; detail: string; price: number }> = {
    starter:    { name: "Plan Starter",             detail: "Acceso a todos los cursos · 3 meses",                    price: 100000  },
    pro:        { name: "Plan Pro",                 detail: "Cursos · 6 meses · incluye 1 voucher de certificación",  price: 200000  },
    elite:      { name: "Plan Elite",               detail: "Cursos · 12 meses · incluye 2 vouchers de certificación", price: 300000 },
    voucher:    { name: "Voucher de certificación", detail: "Un intento de examen · sin vencimiento",                  price: 150000  },
    business:   { name: "Plan Business",            detail: "Bolsa de talento · 6 meses · 3 publicaciones",           price: 900000  },
    enterprise: { name: "Plan Enterprise",          detail: "Bolsa de talento · 12 meses · publicaciones ilimitadas", price: 1500000 },
};

type Tone = "ok" | "warn" | "error" | "neutral";

const PAYMENT_STATUS: Record<PurchaseTicket["status"], { label: string; tone: Tone }> = {
    approved:     { label: "APROBADO",    tone: "ok"      },
    pending:      { label: "EN REVISIÓN", tone: "warn"    },
    rejected:     { label: "RECHAZADO",   tone: "error"   },
    cancelled:    { label: "CANCELADO",   tone: "neutral" },
    refunded:     { label: "REEMBOLSADO", tone: "neutral" },
    charged_back: { label: "CONTRACARGO", tone: "error"   },
    in_mediation: { label: "EN DISPUTA",  tone: "warn"    },
};

// Motivos de rechazo (códigos propios que arma el backend)
const REJECTION_MESSAGES: Record<string, string> = {
    insufficient_funds: "La tarjeta no tenía fondos suficientes.",
    bad_cvv:            "El código de seguridad ingresado era incorrecto.",
    bad_expiry:         "La fecha de vencimiento ingresada era incorrecta.",
    bad_card_number:    "El número de tarjeta ingresado era incorrecto.",
    bad_data:           "Algún dato de la tarjeta estaba mal cargado.",
    call_for_authorize: "Tu banco pidió que autorices el pago antes de procesarlo.",
    card_disabled:      "La tarjeta estaba inhabilitada.",
    high_risk:          "El pago fue rechazado por controles de seguridad.",
    max_attempts:       "Se superó la cantidad de intentos permitidos con esa tarjeta.",
    duplicated:         "Ya existía un pago idéntico reciente.",
    card_error:         "La tarjeta no pudo procesar el pago.",
    bank_rejected:      "El banco emisor rechazó el pago.",
    request_rejected:   "Los datos de pago no pudieron validarse.",
};

interface TicketMessage {
    tone:       Tone;
    title:      string;
    text:       string;
    retryPlan?: string;
}

const formatARS  = (n: number) => `$${Math.round(n).toLocaleString("es-AR")}`;
const formatDate = (d: string | Date) => new Date(d).toLocaleDateString("es-AR", { day: "2-digit", month: "long", year: "numeric" });
const formatTime = (d: string | Date) => new Date(d).toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit" });

// "Plan Starter + voucher", "Voucher de certificación", etc.
function getTicketTitle(items: string[]): string {
    const main     = items.find(i => i !== "voucher");
    const vouchers = items.filter(i => i === "voucher").length;
    if (!main) return vouchers > 1 ? `${vouchers} vouchers de certificación` : "Voucher de certificación";
    const name = PRODUCT_INFO[main]?.name ?? main.toUpperCase();
    return vouchers > 0 ? `${name} + voucher` : name;
}

// Nota corta que se ve en la fila sin desplegarla
function getTicketNote(t: PurchaseTicket): string | null {
    if (t.status === "approved" && !t.activated) return "Activando tu compra…";
    if (t.status === "pending")                  return "En revisión por Mercado Pago";
    if (t.status === "rejected")                 return (t.reason && REJECTION_MESSAGES[t.reason]) || "El pago no fue aprobado";
    return null;
}

// Mensaje completo del estado, dentro del detalle
function getTicketMessage(t: PurchaseTicket): TicketMessage {
    const mainItem = t.items.find(i => i !== "voucher") ?? t.items[0];
    const hasPlan  = t.items.some(i => i !== "voucher");

    switch (t.status) {
        case "approved": {
            if (!t.activated) return {
                tone:  "warn",
                title: "Estamos activando tu compra",
                text:  "El pago está aprobado. La activación puede demorar unos minutos; si todavía no la ves, recargá la página.",
            };
            if (hasPlan && t.expiresAt) {
                const exp = new Date(t.expiresAt);
                return exp > new Date()
                    ? { tone: "ok",      title: "Pago acreditado", text: `Tu plan está activo hasta el ${formatDate(exp)}.` }
                    : { tone: "neutral", title: "Plan finalizado", text: `Este plan venció el ${formatDate(exp)}.` };
            }
            return { tone: "ok", title: "Pago acreditado", text: "El voucher quedó disponible en tu cuenta para rendir la certificación." };
        }

        case "pending":
            return {
                tone:  "warn",
                title: "Pago en revisión",
                text:  (t.reason === "processing"
                    ? "El pago se está procesando y suele resolverse en pocas horas."
                    : "Mercado Pago está revisando el pago. Puede tardar hasta 2 días hábiles.")
                    + " No hace falta volver a pagar: si se aprueba, tu compra se activa automáticamente.",
            };

        case "rejected": {
            const reason = (t.reason && REJECTION_MESSAGES[t.reason]) || "El pago no fue aprobado.";
            const tip    = t.reason === "call_for_authorize" ? "Comunicate con tu banco para autorizarlo y volvé a intentar."
                         : t.reason === "duplicated"         ? "Revisá si ya tenés una compra aprobada antes de reintentar."
                         :                                     "Podés volver a intentarlo con otra tarjeta.";
            return { tone: "error", title: "Pago rechazado", text: `${reason} No se realizó ningún cobro. ${tip}`, retryPlan: mainItem };
        }

        case "cancelled":
            return { tone: "neutral", title: "Pago cancelado", text: "La operación se canceló y no se realizó ningún cobro.", retryPlan: mainItem };

        case "refunded":
            return { tone: "neutral", title: "Pago reembolsado", text: "Te devolvimos el dinero de esta compra. El reintegro puede tardar algunos días en verse en tu resumen, según tu banco." };

        case "charged_back":
            return { tone: "error", title: "Pago desconocido ante el banco", text: "Este pago fue desconocido ante tu banco y la compra quedó sin efecto. Si fue un error, contactanos." };

        case "in_mediation":
            return { tone: "warn", title: "Reclamo abierto", text: "Hay un reclamo abierto sobre este pago en Mercado Pago. Te avisamos cuando se resuelva." };

        default:
            return { tone: "neutral", title: "Estado desconocido", text: "Si tenés dudas sobre esta compra, contactanos indicando la referencia." };
    }
}

// ─── UserDashboard ────────────────────────────────────────────────────────────
const UserDashboard = () => {
    const session = UseSession();
    const { user, loading: sessionLoading } = session;
    // refreshUser (si el SessionContext lo expone) actualiza el user global
    const refreshUser = (session as { refreshUser?: () => Promise<void> }).refreshUser;
    const { purchased, getPurchased, loading: loadingPurchases } = UseShopping();
    const { theme } = UseTheme();
    const navigate = useNavigate();

    const [expandedId,    setExpandedId]    = useState<string | null>(null);
    const [activeTab, setActiveTab] = useState<"compras" | "cuenta" | "bolsa" | "notif" | "cv" | "cursos" | "certificaciones">(() => {
        const stored = localStorage.getItem("hs_user_tab");
        const valid  = ["compras", "cuenta", "bolsa", "notif", "cv", "cursos", "certificaciones"];
        return (valid.includes(stored ?? "") ? stored : "cuenta") as "compras" | "cuenta" | "bolsa" | "notif" | "cv" | "cursos" | "certificaciones";
    });
    const [notifications, setNotifications] = useState<UserNotification[]>([]);
    const [unreadCount,   setUnreadCount]   = useState(0);
    const [toast,         setToast]         = useState<{ msg: string; color: string; bg: string } | null>(null);
    const [cvProfile,     setCvProfile]     = useState<{ firstName: string; lastName: string; photo: string } | null>(null);

    // Claims frescas desde Firebase: se piden en cada recarga del dashboard.
    // El user de la sesión puede venir de una cookie con claims viejas
    // (p. ej. un voucher ya usado), por eso la membresía se calcula con estas.
    const [freshClaims, setFreshClaims] = useState<{
        purchases:      string[];
        purchaseExpiry: Record<string, string>;
    } | null>(null);

    const sseRef       = useRef<EventSource | null>(null);
    const audioCtxRef  = useRef<AudioContext | null>(null);
    const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const activeTabRef = useRef(activeTab);
    useEffect(() => { activeTabRef.current = activeTab; }, [activeTab]);

    // Re-chequear claims al montar (cada recarga). Si la cookie tenía claims
    // viejas, el backend la renueva y se actualiza también el user global.
    // Depende de user?.uid (no de user) para no entrar en loop cuando
    // refreshUser actualiza el usuario.
    useEffect(() => {
        if (!user?.uid) return;
        axios.get(`${import.meta.env.VITE_API_URL}/api/refresh-claims`, { withCredentials: true })
            .then(({ data }) => {
                if (!data?.ok) return;
                setFreshClaims({
                    purchases:      data.purchases ?? [],
                    purchaseExpiry: data.purchaseExpiry ?? {},
                });
                if (data.sessionRefreshed) refreshUser?.().catch(() => {});
            })
            .catch(() => {});
    }, [user?.uid]); // eslint-disable-line

    // Info de membresía (plan activo, tiempo restante, vouchers): usa las
    // claims frescas si ya llegaron, si no las del user de la sesión.
    const membership = useMemo(
        () => getMembershipInfo(freshClaims ? { ...user, ...freshClaims } : user),
        [user, freshClaims]
    );

    useEffect(() => {
        if (user?.partner === true || user?.admin === true || user?.isEnterprise === true) {
            return;
        }
    }, [user, navigate]);

    // Cargar notificaciones desde DB al montar
    useEffect(() => {
        console.log("USER", user);
        
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

    const purchases: PurchaseTicket[] = Array.isArray(purchased) ? (purchased as unknown as PurchaseTicket[]) : [];
    const hasPendingPayment = purchases.some(p => p.status === "pending");

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
                                ? ((cvProfile.firstName?.charAt(0) ?? "") + (cvProfile.lastName?.charAt(0) ?? "")).toUpperCase()
                                : (user.nombre?.charAt(0)?.toUpperCase() ?? user.email?.charAt(0)?.toUpperCase() ?? "U")
                        }
                    </div>
                    <div className="dm-hero-info">
                        <h1 className="dm-hero-name">
                            {(cvProfile?.firstName || cvProfile?.lastName)
                                ? `${cvProfile.firstName} ${cvProfile.lastName}`.trim()
                                : (user.nombre || user.email?.split("@")[0] || "Usuario")
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

            {/* ── MEMBRESÍA: plan activo, tiempo restante y vouchers ── */}
            <div className="dm-membership-block">
                {membership.activeExpiry && membership.daysRemaining < 7 && (
                    <div className="dm-expiry-alert">
                        <span className="dm-expiry-alert-icon">⚠</span>
                        <span>
                            Tu plan {PLAN_LABELS[membership.activePlanId!] ?? membership.activePlanId} vence en{" "}
                            {membership.daysRemaining > 0
                                ? `${membership.daysRemaining} día${membership.daysRemaining !== 1 ? "s" : ""}`
                                : `${membership.hoursRemaining} hora${membership.hoursRemaining !== 1 ? "s" : ""}`}
                            {" — "}
                            <a href="/planes" className="dm-expiry-alert-link">RENOVAR AHORA</a>
                        </span>
                    </div>
                )}

                {!membership.hasAnyPurchase ? (
                    <div className="dm-membership-empty">
                        <span className="dm-membership-empty-icon">◫</span>
                        <span className="dm-membership-empty-text">SIN_PLAN_ACTIVO</span>
                        <a href="/pricing" className="dm-membership-cta">VER_PLANES</a>
                    </div>
                ) : (
                    <div className="dm-membership-grid">

                        {/* PLAN ACTIVO */}
                        <div className={`dm-membership-card ${membership.activeExpiry && membership.daysRemaining < 7 ? "dm-time-urgent" : ""}`}>
                            <span className="dm-membership-card-label">PLAN_ACTIVO</span>
                            {membership.activePlanId ? (
                                <>
                                    <span className="dm-membership-plan-name">
                                        {PLAN_LABELS[membership.activePlanId] ?? membership.activePlanId.toUpperCase()}
                                    </span>
                                    <span className="dm-membership-expires">
                                        Vence el {membership.activeExpiry!.toLocaleDateString("es-AR", { day: "2-digit", month: "long", year: "numeric" })}
                                    </span>
                                </>
                            ) : (
                                <>
                                    <span className="dm-membership-plan-name" style={{ opacity: 0.3 }}>—</span>
                                    <span className="dm-membership-expires">Sin plan vigente</span>
                                </>
                            )}
                        </div>

                        {/* TIEMPO RESTANTE */}
                        <div className={`dm-membership-card ${membership.activeExpiry && membership.daysRemaining < 7 ? "dm-time-urgent" : ""}`}>
                            <span className="dm-membership-card-label">TIEMPO_RESTANTE</span>
                            {membership.activeExpiry ? (
                                <>
                                    <span className="dm-membership-time-value">
                                        {membership.daysRemaining > 0
                                            ? `${membership.daysRemaining} día${membership.daysRemaining !== 1 ? "s" : ""}`
                                            : `${membership.hoursRemaining} hora${membership.hoursRemaining !== 1 ? "s" : ""}`}
                                    </span>
                                    <span className="dm-membership-time-detail">
                                        {membership.daysRemaining > 0
                                            ? `+ ${membership.hoursRemaining}h`
                                            : "Vence hoy"}
                                    </span>
                                </>
                            ) : (
                                <>
                                    <span className="dm-membership-time-value" style={{ opacity: 0.3 }}>—</span>
                                    <span className="dm-membership-time-detail">Sin plan vigente</span>
                                </>
                            )}
                        </div>

                        {/* VOUCHERS DISPONIBLES */}
                        <div className={`dm-membership-card ${membership.voucherCount === 0 ? "dm-voucher-empty" : ""}`}>
                            <span className="dm-membership-card-label">VOUCHERS_DISPONIBLES</span>
                            <span className="dm-membership-voucher-count">{membership.voucherCount}</span>
                            <span className="dm-membership-voucher-label">
                                {membership.voucherCount === 0 ? "Sin certificaciones" : "Para certificación"}
                            </span>
                        </div>

                    </div>
                )}
            </div>

            {/* ── TABS ── */}
            <div className="dm-tabs">
                <button className={`dm-tab ${activeTab === "compras" ? "active" : ""}`} onClick={() => handleTabChange("compras")}>
                    HISTORIAL
                </button>
                <button className={`dm-tab ${activeTab === "cursos" ? "active" : ""}`} onClick={() => handleTabChange("cursos")}>
                    CURSOS
                </button>
                <button className={`dm-tab ${activeTab === "certificaciones" ? "active" : ""}`} onClick={() => handleTabChange("certificaciones")}>
                    CERTIFICACIONES
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
                        <>
                            {/* Aviso general si hay un pago en revisión */}
                            {hasPendingPayment && (
                                <div className="dm-hist-banner">
                                    <span className="dm-hist-banner-dot" />
                                    <span>
                                        Tenés un pago en revisión. No hace falta volver a pagar: si se aprueba,
                                        tu compra se activa automáticamente. Mientras tanto no vas a poder iniciar otra compra.
                                    </span>
                                </div>
                            )}

                            <div className="dm-purchase-list">
                                {purchases.map((p) => {
                                    const isExpanded = expandedId === p.id;
                                    const statusInfo = PAYMENT_STATUS[p.status] ?? { label: String(p.status).toUpperCase(), tone: "neutral" as Tone };
                                    const note       = getTicketNote(p);
                                    const message    = getTicketMessage(p);
                                    const isVoid     = ["rejected", "cancelled", "refunded", "charged_back"].includes(p.status);

                                    return (
                                        <div key={p.id} className={`dm-purchase-wrapper dm-hist-tone-${statusInfo.tone}`}>
                                            <div className="dm-purchase-row" onClick={() => setExpandedId(isExpanded ? null : p.id)}>
                                                <div className="dm-purchase-left">
                                                    <span className="dm-purchase-date">[{new Date(p.date).toLocaleDateString("es-AR")}]</span>
                                                    <div className="dm-hist-title-group">
                                                        <span className="dm-purchase-id">
                                                            {getTicketTitle(p.items)}
                                                            {p.isTest && <span className="dm-hist-test">PRUEBA</span>}
                                                        </span>
                                                        {note && <span className={`dm-hist-note dm-hist-note--${statusInfo.tone}`}>{note}</span>}
                                                    </div>
                                                </div>
                                                <div className="dm-purchase-right">
                                                    <span className={`dm-hist-status dm-hist-status--${statusInfo.tone}`}>{statusInfo.label}</span>
                                                    {p.invoiceSent && <span className="dm-invoice-badge" title="Factura enviada">✓ FACTURA RECIBIDA POR EMAIL</span>}
                                                    <span className={`dm-purchase-amount ${isVoid ? "dm-hist-amount-void" : ""}`}>{formatARS(p.amount)}</span>
                                                    <span className="dm-chevron">{isExpanded ? "▲" : "▼"}</span>
                                                </div>
                                            </div>

                                            {isExpanded && (
                                                <div className="dm-purchase-detail">

                                                    {/* Estado */}
                                                    <div className={`dm-hist-message dm-hist-message--${message.tone}`}>
                                                        <div className="dm-hist-message-text">
                                                            <strong>{message.title}</strong>
                                                            <span>{message.text}</span>
                                                        </div>
                                                        {message.retryPlan && !p.isTest && (
                                                            <a href={`/checkout/${message.retryPlan}`} className="dm-hist-retry">
                                                                REINTENTAR →
                                                            </a>
                                                        )}
                                                    </div>

                                                    {/* Productos */}
                                                    <div className="dm-detail-block">
                                                        <span className="dm-detail-title">DETALLE DE LA COMPRA</span>
                                                        {p.items.map((item, i) => {
                                                            const info = PRODUCT_INFO[item];
                                                            return (
                                                                <div key={`${item}-${i}`} className="dm-item-row">
                                                                    <div className="dm-item-info">
                                                                        <strong>{info?.name ?? item.toUpperCase()}</strong>
                                                                        {info?.detail && <em className="dm-variante">{info.detail}</em>}
                                                                    </div>
                                                                    <div className="dm-item-right">
                                                                        {info && <span className="dm-item-price">{formatARS(info.price)}</span>}
                                                                    </div>
                                                                </div>
                                                            );
                                                        })}
                                                    </div>

                                                    {/* Resumen de pago */}
                                                    <div className="dm-detail-block">
                                                        <span className="dm-detail-title">RESUMEN DE PAGO</span>
                                                        <div className="dm-detail-row"><span>Subtotal</span><strong>{formatARS(p.subtotal)}</strong></div>
                                                        {p.discount > 0 && (
                                                            <div className="dm-detail-row dm-green">
                                                                <span>Cupón {p.couponCode ?? ""}</span>
                                                                <strong>- {p.discount}%</strong>
                                                            </div>
                                                        )}
                                                        <div className="dm-detail-row">
                                                            <span>Forma de pago</span>
                                                            <strong>
                                                                {p.cuotas > 1
                                                                    ? `${p.cuotas} cuotas de ${formatARS(p.amount / p.cuotas)}`
                                                                    : "1 pago"}
                                                            </strong>
                                                        </div>
                                                        <div className="dm-detail-row dm-total">
                                                            <span>TOTAL</span>
                                                            <strong className={isVoid ? "dm-hist-amount-void" : ""}>{formatARS(p.amount)}</strong>
                                                        </div>
                                                        <div className="dm-hist-meta">
                                                            <span>REF #{p.reference}</span>
                                                            <span>{formatDate(p.date)} · {formatTime(p.date)}</span>
                                                        </div>
                                                    </div>

                                                </div>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        </>
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

            {/* ══ TAB: CERTIFICACIONES ══ */}
            {activeTab === "certificaciones" && (
                <div className="dm-section">
                    <CertificationCatalog />
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