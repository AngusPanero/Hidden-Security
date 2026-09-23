import { useState, useMemo, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { UseTheme } from "../contexts/ThemeContext";
import { UseCart } from "../contexts/CartContext";
import { UseSession } from "../contexts/SessionContext";
import { v4 } from 'uuid';
import axios from "axios";
import "./checkout.css";
import Error from "../processMessages/Error";
import Loader from "../loader/Loader";
import useMercadoPago from "../hooks/useMercadoPago";
import CreditCard from "../ui/creditCard/CreditCard";
import ProcessOk from "../processMessages/ProcessOk";

const ALL_PLANS = [
    {
        id: "starter", title: "STARTER", price: 100000, cuotas_sin_interes: 6,
        label: "01 - TRAINING", period: "3 MESES DISPONIBLES",
        features: ["Acceso a todos los cursos", "Acceso a futuros cursos publicados", "Certificado de finalización de curso"]
    },
    {
        id: "pro", title: "PRO", price: 200000, cuotas_sin_interes: 6,
        label: "02 - RECOMENDADO", period: "6 MESES DISPONIBLES",
        features: ["1 Voucher de certificación Hidden Security", "Acceso a todos los cursos", "Acceso a futuros cursos publicados", "Certificado de finalización de curso"]
    },
    {
        id: "elite", title: "ELITE", price: 300000, cuotas_sin_interes: 6,
        label: "03 - FULL_STACK", period: "12 MESES DISPONIBLES",
        features: ["Acceso a todos los cursos", "Acceso a futuros cursos publicados", "Certificado de finalización de curso", "Voucher de certificación Hidden Security", "2do Voucher de certificación en caso de no aprobar el primero"]
    },
    {
        id: "voucher", title: "CERTIFICACIÓN INDIVIDUAL", price: 150000, cuotas_sin_interes: 6,
        label: "04 - CERTIFICATION", period: "ÚNICO USO",
        features: ["Un Intento de certificación Hidden Security", "Validación de conocimiento obtenido", "Título de certificación Hidden Security"]
    },
    {
        id: "business", title: "BUSINESS", price: 900000, cuotas_sin_interes: 6,
        label: "01 // BUSINESS", period: "6 MESES",
        features: ["Acceso a base de datos de perfiles", "Búsqueda por habilidades, herramientas y certificaciones", "Publicación de ofertas laborales", "Contacto directo con candidatos", "Hasta 10 búsquedas activas"]
    },
    {
        id: "enterprise", title: "ENTERPRISE", price: 1500000, cuotas_sin_interes: 6,
        label: "02 // ENTERPRISE: RECOMENDADO", period: "12 MESES",
        features: ["Todo lo incluído en Business", "Publicaciones ilimitadas", "Búsquedas activas ilimitadas", "Soporte prioritario", "Acceso prioritario a nuevas funcionalidades"]
    },
];

const INTERES_RATES: Record<string, number> = {
    "1": 0, "3": 0.05, "6": 0.10, "12": 0.20
};

const UPGRADE_MAP: Record<string, { targetId: string; targetTitle: string; benefits: string[] } | null> = {
    "starter":    { targetId: "pro",        targetTitle: "PRO",        benefits: ["1 Voucher de certificación Hidden Security", "Acceso a futuros cursos publicados", "6 meses de acceso"] },
    "pro":        { targetId: "elite",      targetTitle: "ELITE",      benefits: ["2do Voucher en caso de no aprobar el primero", "12 meses de acceso"] },
    "elite":      null,
    "voucher":    null,
    "business":   { targetId: "enterprise", targetTitle: "ENTERPRISE", benefits: ["Publicaciones ilimitadas", "Búsquedas activas ilimitadas", "Soporte prioritario"] },
    "enterprise": null,
};

const ENTERPRISE_PLANS = ["business", "enterprise"];
const USER_PLANS        = ["starter", "pro", "elite", "voucher"];
const PLANS_WITHOUT_VOUCHER = ["starter"];
const VOUCHER_PLAN = ALL_PLANS.find(p => p.id === "voucher")!;

// ─── Helper: detectar plan activo no vencido en las claims del usuario ─────────
function getActivePlan(purchases: string[], purchaseExpiry: Record<string, string>): { planId: string; expiresAt: Date } | null {
    if (!Array.isArray(purchases)) return null;
    const now = new Date();
    for (const planId of purchases) {
        if (planId === 'voucher') continue;
        const expiryStr = purchaseExpiry?.[planId];
        if (!expiryStr) continue;
        const expiry = new Date(expiryStr);
        if (expiry > now) return { planId, expiresAt: expiry };
    }
    return null;
}

// ─── Componente de bloqueo ─────────────────────────────────────────────────────
function PurchaseBlockedBanner({ title, detail }: { title: string; detail: string }) {
    const navigate = useNavigate();
    return (
        <div style={{
            minHeight: "100vh",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            background: "#000",
            padding: "40px 24px",
            textAlign: "center",
            gap: 24,
        }}>
            <span style={{
                fontFamily: "'JetBrains Mono', monospace",
                fontSize: "0.65rem",
                fontWeight: 800,
                letterSpacing: "4px",
                color: "#f43f5e",
                textTransform: "uppercase",
            }}>
                // COMPRA_BLOQUEADA
            </span>
            <h2 style={{
                fontFamily: "'Montserrat', sans-serif",
                fontSize: "clamp(1.2rem, 3vw, 2rem)",
                fontWeight: 900,
                letterSpacing: "-1px",
                textTransform: "uppercase",
                color: "#fff",
                margin: 0,
                maxWidth: 600,
            }}>
                {title}
            </h2>
            <p style={{
                fontFamily: "'Montserrat', sans-serif",
                fontSize: "0.85rem",
                fontWeight: 500,
                color: "rgba(255,255,255,0.55)",
                maxWidth: 520,
                lineHeight: 1.7,
                margin: 0,
            }}>
                {detail}
            </p>
            <button
                onClick={() => navigate(-1)}
                style={{
                    marginTop: 8,
                    background: "transparent",
                    border: "1px solid rgba(255,255,255,0.2)",
                    color: "rgba(255,255,255,0.5)",
                    fontFamily: "'JetBrains Mono', monospace",
                    fontSize: "0.65rem",
                    fontWeight: 800,
                    letterSpacing: "2px",
                    textTransform: "uppercase",
                    padding: "10px 22px",
                    cursor: "pointer",
                    transition: "all 0.2s",
                }}
                onMouseEnter={e => { (e.target as HTMLButtonElement).style.borderColor = "#fff"; (e.target as HTMLButtonElement).style.color = "#fff"; }}
                onMouseLeave={e => { (e.target as HTMLButtonElement).style.borderColor = "rgba(255,255,255,0.2)"; (e.target as HTMLButtonElement).style.color = "rgba(255,255,255,0.5)"; }}
            >
                ← VOLVER
            </button>
        </div>
    );
}

const Checkout = () => {
    const { planId } = useParams();
    const mp         = useMercadoPago();

    const [idempotencyKey, setIdempotencyKey] = useState(() => v4());
    const renewIdempotencyKey = () => setIdempotencyKey(v4());

    const { theme }  = UseTheme();
    const session    = UseSession();
    const { user }   = session;
    // refreshUser tiene que volver a pedir la sesión al backend (que ya re-emitió la cookie)
    const refreshUser = (session as { refreshUser?: () => Promise<void> }).refreshUser;
    const { applyCoupon, appliedCoupon } = UseCart();

    const [isFlipped,     setIsFlipped]     = useState(false);
    const [loading,       setLoading]       = useState(false);
    const [couponInput,   setCouponInput]   = useState('');
    const [couponMsg,     setCouponMsg]     = useState({ text: '', isError: false });
    const [error,         setError]         = useState<string | null>(null);
    const [paymentError,  setPaymentError]  = useState<string | null>(null);
    const [status,        setStatus]        = useState<"" | "ok" | "pending">("");
    const [voucherAdded,  setVoucherAdded]  = useState(false);

    useEffect(() => {
        window.scrollTo(0, 0);
    }, []);

    const [formData, setFormData] = useState({
        nombre: "", email: user?.email || "", telefono: "", dni: "",
        domicilio: "", ciudad: "", provincia: "", codigoPostal: "",
        tarjetaNumero: "", mesVencimiento: "", añoVencimiento: "", cvv: "",
        cuotas: "1",
    });

    // Voucher disponible sin usar — no importa si vino de comprar pro/elite
    const hasAvailableVoucher = user?.purchases?.includes("voucher") ?? false;

    const selectedPlan  = useMemo(() => ALL_PLANS.find(p => p.id === planId?.toLowerCase()), [planId]);
    const upgradeInfo   = useMemo(() => planId ? UPGRADE_MAP[planId.toLowerCase()] ?? null : null, [planId]);
    const canAddVoucher = useMemo(
        () => planId ? PLANS_WITHOUT_VOUCHER.includes(planId.toLowerCase()) && !hasAvailableVoucher : false,
        [planId, hasAvailableVoucher]
    );
    const upgradePlan   = useMemo(() => upgradeInfo ? ALL_PLANS.find(p => p.id === upgradeInfo.targetId) : null, [upgradeInfo]);

    const cuotasSeleccionadas = parseInt(formData.cuotas);

    // ─── Validaciones de acceso ──────────────────────────────────────────────
    const isEnterprise     = !!user?.isEnterprise;
    const planIsEnterprise = planId ? ENTERPRISE_PLANS.includes(planId.toLowerCase()) : false;
    const planIsUserPlan   = planId ? USER_PLANS.includes(planId.toLowerCase())       : false;

    const enterpriseBlockedFromUserPlan = isEnterprise && planIsUserPlan;
    const userBlockedFromEnterprisePlan = !isEnterprise && planIsEnterprise && !!user;

    const purchases      = (user as any)?.purchases      ?? [];
    const purchaseExpiry = (user as any)?.purchaseExpiry ?? {};
    const activePlanInfo = planId?.toLowerCase() !== 'voucher'
        ? getActivePlan(purchases, purchaseExpiry)
        : null;

    // ─── Totales ─────────────────────────────────────────────────────────────
    const totalConInteres = useMemo(() => {
        if (!selectedPlan) return 0;
        const base     = selectedPlan.price + (voucherAdded ? VOUCHER_PLAN.price : 0);
        const esGratis = selectedPlan.cuotas_sin_interes && cuotasSeleccionadas <= selectedPlan.cuotas_sin_interes;
        const tasa     = (cuotasSeleccionadas > 1 && !esGratis) ? (INTERES_RATES[formData.cuotas] || 0) : 0;
        return base * (1 + tasa);
    }, [selectedPlan, formData.cuotas, cuotasSeleccionadas, voucherAdded]);

    const finalAmount = useMemo(() => {
        if (!appliedCoupon) return totalConInteres;
        if (appliedCoupon.scope === 'all') return totalConInteres * (1 - appliedCoupon.discount / 100);
        let discountableBase = 0;
        const allowedPlans = appliedCoupon.allowedPlans ?? [];
        if (allowedPlans.includes(selectedPlan!.id)) discountableBase += selectedPlan!.price;
        if (voucherAdded && allowedPlans.includes('voucher')) discountableBase += VOUCHER_PLAN.price;
        return totalConInteres - (discountableBase * (appliedCoupon.discount / 100));
    }, [totalConInteres, appliedCoupon, selectedPlan, voucherAdded]);

    const discountAmount = totalConInteres - finalAmount;

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
        setFormData({ ...formData, [e.target.name]: e.target.value });

    const handleApplyCoupon = async () => {
        if (!user)         { setCouponMsg({ text: "REGISTRO_REQUERIDO", isError: true }); return; }
        if (!selectedPlan) return;
        setLoading(true);
        const itemsToValidate = [selectedPlan.id, ...(voucherAdded ? ["voucher"] : [])];
        const message = await applyCoupon(couponInput, itemsToValidate);
        setCouponMsg({ text: message.toUpperCase(), isError: !message.includes('éxito') && !message.includes('🟢') });
        setLoading(false);
    };

    // ═════════════════════════════════════════════════════════════════════════
    //  🔧 DEV — COBRO DE PRUEBA (sin tarjeta, sin validaciones de negocio)
    //  Para producción: comentar esta función completa
    // ═════════════════════════════════════════════════════════════════════════
    /* const makePaymentTest = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedPlan || !user) return;

        const items: string[] = [selectedPlan.id];
        if (voucherAdded) items.push("voucher");

        try {
            setPaymentError(null);
            setLoading(true);

            const { data } = await axios.post(
                `${import.meta.env.VITE_API_URL}/test-course-payment`,
                {
                    payer: {
                        nombre:       formData.nombre.trim(),
                        dni:          formData.dni.trim(),
                        domicilio:    formData.domicilio.trim(),
                        ciudad:       formData.ciudad.trim(),
                        provincia:    formData.provincia.trim(),
                        codigoPostal: formData.codigoPostal.trim(),
                        email:        formData.email,
                        telefono:     formData.telefono || null,
                    },
                    idempotencyKey,
                    items,
                    couponCode:   appliedCoupon?.code || null,
                    installments: Number(formData.cuotas),
                },
                { withCredentials: true }
            );

            if (data.mp_status === "approved") {
                // El backend ya renovó la cookie: se refresca el usuario sin re-login
                try { await refreshUser?.(); } catch (err) { console.warn("No se pudo refrescar la sesión", err); }
                setStatus("ok");

                try {
                    await axios.post(
                        `${import.meta.env.VITE_API_URL}/confirm-order`,
                        {
                            name:         formData.nombre,
                            email:        formData.email,
                            telefono:     formData.telefono,
                            dni:          formData.dni,
                            domicilio:    formData.domicilio,
                            ciudad:       formData.ciudad,
                            provincia:    formData.provincia,
                            codigoPostal: formData.codigoPostal,
                            items,
                            totalPrice:   data.amount,
                            couponCode:   appliedCoupon?.code     || null,
                            discount:     appliedCoupon?.discount || null,
                        },
                        { withCredentials: true }
                    );
                } catch (err: any) {
                    setError(`PAGO_REALIZADO_PERO_FALLO_CONFIRMACION, ${err}`);
                }
            } else {
                renewIdempotencyKey();
                setPaymentError(data.message || "La simulación no devolvió un pago aprobado.");
            }

        } catch (err: any) {
            renewIdempotencyKey();
            const res = err.response;
            if (!res) {
                setPaymentError("No hubo respuesta del servidor. Revisá que el backend esté levantado.");
            } else if (res.status === 404) {
                setPaymentError("El modo test está desactivado en el backend (ENABLE_TEST_PAYMENTS).");
            } else {
                setPaymentError(res.data?.message || "Error en la simulación.");
            }
        } finally {
            setLoading(false);
        }
    }; */


    const makePayment = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedPlan || !user || !mp) return;

        if (!window.confirm("¿Confirmar el procesamiento del pago?")) return;

        // Motivos de rechazo de MP más comunes → qué hacer
        const MP_REJECTION_MESSAGES: Record<string, string> = {
            cc_rejected_insufficient_amount:      "La tarjeta no tiene fondos suficientes. Probá con otra tarjeta.",
            cc_rejected_bad_filled_security_code: "El código de seguridad es incorrecto. Revisalo y volvé a intentar.",
            cc_rejected_bad_filled_date:          "La fecha de vencimiento es incorrecta. Revisala y volvé a intentar.",
            cc_rejected_bad_filled_card_number:   "El número de tarjeta es incorrecto. Revisalo y volvé a intentar.",
            cc_rejected_bad_filled_other:         "Hay un dato de la tarjeta mal cargado. Revisalos y volvé a intentar.",
            cc_rejected_call_for_authorize:       "Tu banco pide autorizar el pago. Llamá al banco y volvé a intentar.",
            cc_rejected_card_disabled:            "La tarjeta está inhabilitada. Activala con tu banco o usá otra.",
            cc_rejected_high_risk:                "El pago fue rechazado por seguridad. Probá con otra tarjeta.",
            cc_rejected_max_attempts:             "Superaste los intentos permitidos. Probá con otra tarjeta.",
            cc_rejected_duplicated_payment:       "Ya hiciste un pago por este monto. Revisá tus compras antes de reintentar.",
            cc_rejected_other_reason:             "El banco rechazó el pago. Probá con otra tarjeta.",
        };

        const items: string[] = [selectedPlan.id];
        if (voucherAdded) items.push("voucher");

        try {
            setPaymentError(null);
            setLoading(true);

            const cardNumber = formData.tarjetaNumero.trim().replace(/\s/g, "");
            const bin = cardNumber.substring(0, 6);

            // 1. Obtener el método de pago a partir del BIN
            const paymentMethodsResponse = await mp.getPaymentMethods({ bin });
            const paymentMethod = paymentMethodsResponse?.results?.[0] ?? null;

            if (!paymentMethod) {
                setPaymentError("No pudimos identificar la tarjeta. Revisá el número.");
                return;
            }

            // 2. Obtener el emisor (con fallback al que ya trae paymentMethod)
            let issuerId = undefined;
            try {
                const issuers = await mp.getIssuers({ paymentMethodId: paymentMethod.id, bin });
                if (issuers && issuers.length > 0) issuerId = issuers[0].id;
                else if (paymentMethod.issuer?.id) issuerId = paymentMethod.issuer.id;
            } catch (issuerError) {
                console.warn("No se pudo obtener el emisor, continuando sin él...", issuerError);
            }

            // 3. Generar el CardToken (uno nuevo en cada intento)
            const cardToken = await mp.createCardToken({
                cardNumber,
                cardholderName:       formData.nombre.trim(),
                cardExpirationMonth:  formData.mesVencimiento.trim(),
                cardExpirationYear:   formData.añoVencimiento.trim(),
                securityCode:         formData.cvv.trim(),
                identificationType:   "DNI",
                identificationNumber: formData.dni.trim(),
            });

            if (!cardToken?.id) {
                setPaymentError("No se pudo validar la tarjeta. Revisá los datos y volvé a intentar.");
                return;
            }

            // 4. Enviar el pago al backend (valida y calcula todo del lado del servidor)
            const { data } = await axios.post(
                `${import.meta.env.VITE_API_URL}/course-payment`,
                {
                    payer: {
                        nombre:       formData.nombre.trim(),
                        dni:          formData.dni.trim(),
                        domicilio:    formData.domicilio.trim(),
                        ciudad:       formData.ciudad.trim(),
                        provincia:    formData.provincia.trim(),
                        codigoPostal: formData.codigoPostal.trim(),
                        email:        formData.email,
                        telefono:     formData.telefono || null,
                        identification: { type: "DNI", number: formData.dni.trim() },
                    },
                    idempotencyKey,
                    items,
                    couponCode:        appliedCoupon?.code || null,
                    token:             cardToken.id,
                    issuer_id:         issuerId ? String(issuerId) : undefined,
                    payment_method_id: paymentMethod.id,
                    installments:      Number(formData.cuotas),
                },
                { withCredentials: true }
            );

            // 5a. Aprobado
            if (data.mp_status === "approved") {
                // El backend ya renovó la cookie: se refresca el usuario sin re-login
                try { await refreshUser?.(); } catch (err) { console.warn("No se pudo refrescar la sesión", err); }
                setStatus("ok");

                try {
                    await axios.post(
                        `${import.meta.env.VITE_API_URL}/confirm-order`,
                        {
                            name:         formData.nombre,
                            email:        formData.email,
                            telefono:     formData.telefono,
                            dni:          formData.dni,
                            domicilio:    formData.domicilio,
                            ciudad:       formData.ciudad,
                            provincia:    formData.provincia,
                            codigoPostal: formData.codigoPostal,
                            items,
                            totalPrice:   data.amount,
                            couponCode:   appliedCoupon?.code     || null,
                            discount:     appliedCoupon?.discount || null,
                        },
                        { withCredentials: true }
                    );
                } catch (err: any) {
                    setError(`PAGO_REALIZADO_PERO_FALLO_CONFIRMACION, ${err}`);
                }
                return;
            }

            // 5b. En revisión → lo resuelve el webhook
            if (["pending", "in_process", "authorized"].includes(data.mp_status)) {
                setStatus("pending");
                return;
            }

            // 5c. Cualquier otro estado
            renewIdempotencyKey();
            setPaymentError("El pago no se pudo completar. Probá con otra tarjeta.");

        } catch (err: any) {
            const res = err.response;

            // Sin respuesta: no sabemos si se cobró → se CONSERVA la key
            if (!res) {
                setPaymentError("No hubo respuesta del servidor. Revisá tu conexión y volvé a intentar: si el cobro ya se hizo, no se repite.");
                return;
            }

            const { code, message, detail, status_detail } = res.data ?? {};

            // Respuesta definitiva sin cobro (4xx) → la key MUERE
            // 5xx → se conserva: reintentar con la misma key no cobra dos veces
            if (res.status < 500) renewIdempotencyKey();

            if (res.status === 402) {
                // Rechazo de la tarjeta: se queda en el form para probar con otra
                setPaymentError(MP_REJECTION_MESSAGES[status_detail] ?? "El pago fue rechazado. Probá con otra tarjeta.");
            } else if (code === "ENTERPRISE_CANNOT_BUY_USER_PLANS" || code === "USER_CANNOT_BUY_ENTERPRISE_PLANS") {
                setError("TU_TIPO_DE_USUARIO_ESTÁ_INHABILITADO_PARA_ESTA_COMPRA");
            } else if (code === "ACTIVE_PLAN_EXISTS" || code === "VOUCHER_ALREADY_AVAILABLE" || code === "PENDING_PAYMENT_EXISTS") {
                setError(detail || message);
            } else if (code === "PAYMENT_REQUEST_REJECTED") {
                setPaymentError("Mercado Pago rechazó los datos de la tarjeta. Revisalos y volvé a intentar.");
            } else if (code === "IDEMPOTENCY_KEY_USED") {
                setPaymentError("La operación anterior ya se cerró. Volvé a enviar el pago.");
            } else if (code === "PAYMENT_IN_PROGRESS") {
                setPaymentError("Ya hay un pago en curso. Esperá unos segundos y revisá tus compras antes de reintentar.");
            } else if (res.status >= 500) {
                setPaymentError("Error al procesar el pago. Volvé a intentar: si el cobro ya se hizo, no se repite.");
            } else {
                setError(message || "Error al procesar el pago. Verifique los datos de su tarjeta.");
            }
        } finally {
            setLoading(false);
        }
    };

    // ─── Guards de renderizado ────────────────────────────────────────────────
    if (!selectedPlan)        return <Error processMessage="PLAN_NO_IDENTIFICADO" />;
    if (loading)              return <Loader />;
    if (status === "ok")      return <ProcessOk processMessage="COMPRA EXITOSA!" />;
    if (status === "pending") return <ProcessOk processMessage="PAGO EN REVISIÓN: vas a ver tu plan activo apenas Mercado Pago lo acredite" />;

    if (enterpriseBlockedFromUserPlan) return (
        <PurchaseBlockedBanner
            title="Tu tipo de cuenta no puede adquirir este plan"
            detail="Las cuentas Enterprise están habilitadas únicamente para planes B2B. Los planes de estudio individuales (Starter, Pro, Elite, Voucher) son exclusivos para usuarios personales."
        />
    );

    if (userBlockedFromEnterprisePlan) return (
        <PurchaseBlockedBanner
            title="Tu tipo de cuenta no puede adquirir este plan"
            detail="Los planes B2B son exclusivos para cuentas Enterprise. Si tu empresa necesita acceso a la bolsa de talento Hidden Security, contactanos para activar tu cuenta enterprise."
        />
    );

    if (activePlanInfo) {
        const expiryStr = activePlanInfo.expiresAt.toLocaleDateString('es-AR', { day: '2-digit', month: 'long', year: 'numeric' });
        return (
            <PurchaseBlockedBanner
                title={`Ya tenés el plan ${activePlanInfo.planId.toUpperCase()} activo`}
                detail={`Tu plan está vigente hasta el ${expiryStr}. Podrás renovar o cambiar de plan una vez que finalice. Si querés agregar un voucher de certificación, podés hacerlo desde tu dashboard.`}
            />
        );
    }

    const isBuyingVoucher = planId?.toLowerCase() === "voucher";

    if (isBuyingVoucher && hasAvailableVoucher) {
        return (
            <PurchaseBlockedBanner
                title="Ya tenés un voucher de certificación disponible"
                detail="Tenés un voucher sin usar en tu cuenta — ya sea de un plan Pro/Elite o de una compra individual. Usalo para rendir tu certificación antes de comprar uno nuevo, o hacelo desde tu dashboard."
            />
        );
    }

    if (error) return <Error processMessage={error} />;

    const upgradeDiff = upgradePlan ? upgradePlan.price - selectedPlan.price : 0;

    return (
        <main className={`checkout-screen ${theme}`}>

            {/* AVISO SESIÓN */}
            {!user && (
                <motion.div className="session-required-banner" initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}>
                    <span className="session-required-tag">// AUTENTICACIÓN_REQUERIDA</span>
                    <p className="session-required-text">
                        El acceso al curso se registra en tu cuenta. Iniciá sesión para continuar con la compra.
                    </p>
                </motion.div>
            )}

            <div className="checkout-wrapper">

                {/* ── COLUMNA FORMULARIO ── */}
                <motion.div className="checkout-form-column" initial={{ opacity: 0, x: -30 }} animate={{ opacity: 1, x: 0 }}>
                    <header className="checkout-header">
                        <span className="terminal-text">// SECURE_GATEWAY_v2.0</span>
                        <h1 className="Montserrat-900">PROCESAR_<span>ACCESO</span></h1>
                    </header>

                    {/* 🔧 DEV: onSubmit={makePaymentTest}   ·   🚀 PROD: onSubmit={makePayment} */}
                    <form id="checkout-form" className="main-checkout-form" onSubmit={makePayment}>
                        <section className={`checkout-section ${!user ? 'section-locked' : ''}`}>
                            <span className="section-label">01 // IDENTIDAD_DIGITAL</span>
                            <div className="input-field">
                                <label>TITULAR_DE_TARJETA</label>
                                <input name="nombre" placeholder="NOMBRE_COMPLETO" value={formData.nombre} onChange={handleChange} required disabled={!user} />
                            </div>
                            <div className="input-row" style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '15px' }}>
                                <div className="input-field">
                                    <label>ID_EMAIL</label>
                                    <input value={user ? formData.email : '—'} disabled className="disabled-input" />
                                </div>
                                <div className="input-field">
                                    <label>TELÉFONO</label>
                                    <input name="telefono" placeholder="11-1234-5678" value={formData.telefono} onChange={handleChange} disabled={!user} />
                                </div>
                                <div className="input-field">
                                    <label>DNI</label>
                                    <input name="dni" placeholder="NÚMERO" value={formData.dni} onChange={handleChange} required disabled={!user} />
                                </div>
                                <br />
                                <div className="input-field">
                                    <label>DIRECCIÓN</label>
                                    <input name="domicilio" placeholder="DOMICILIO" value={formData.domicilio} onChange={handleChange} required disabled={!user} />
                                </div>
                                <div className="input-field">
                                    <label>CIUDAD</label>
                                    <input name="ciudad" placeholder="CIUDAD" value={formData.ciudad} onChange={handleChange} required disabled={!user} />
                                </div>
                                <div className="input-field">
                                    <label>PROVINCIA</label>
                                    <input name="provincia" placeholder="PROVINCIA" value={formData.provincia} onChange={handleChange} required disabled={!user} />
                                </div>
                                <div className="input-field">
                                    <label>CÓDIGO_POSTAL</label>
                                    <input name="codigoPostal" placeholder="ej: 1704" value={formData.codigoPostal} onChange={handleChange} required disabled={!user} />
                                </div>
                            </div>
                        </section>

                        <section className={`checkout-section ${!user ? 'section-locked' : ''}`}>
                            <span className="section-label">02 // CREDIT_CARD_PROTOCOLS</span>
                            <div className="input-field">
                                <label>NUMERO_DE_TARJETA</label>
                                <input name="tarjetaNumero" placeholder="0000 0000 0000 0000" value={formData.tarjetaNumero} onChange={handleChange} maxLength={19} required disabled={!user} />
                            </div>
                            <div className="input-row">
                                <input name="mesVencimiento" placeholder="MM" maxLength={2} value={formData.mesVencimiento} onFocus={() => setIsFlipped(false)} onChange={handleChange} required disabled={!user} />
                                <input name="añoVencimiento" placeholder="YY" maxLength={2} value={formData.añoVencimiento} onFocus={() => setIsFlipped(false)} onChange={handleChange} required disabled={!user} />
                                <input name="cvv" placeholder="CVV" maxLength={4} value={formData.cvv} onFocus={() => setIsFlipped(true)} onBlur={() => setIsFlipped(false)} onChange={handleChange} required disabled={!user} />
                                <select className="select-cuotas" name="cuotas" value={formData.cuotas} onChange={handleChange} disabled={!user}>
                                    <option value="1">1 PAGO</option>
                                    <option value="3">3 CUOTAS</option>
                                    <option value="6">6 CUOTAS</option>
                                    <option value="12">12 CUOTAS</option>
                                </select>
                            </div>

                            {paymentError && (
                                <motion.p
                                    className="checkout-payment-error"
                                    role="alert"
                                    initial={{ opacity: 0, y: -6 }}
                                    animate={{ opacity: 1, y: 0 }}
                                >
                                    {paymentError}
                                </motion.p>
                            )}
                        </section>
                    </form>
                </motion.div>

                {/* ── COLUMNA RESUMEN ── */}
                <motion.div className="checkout-summary-column" initial={{ opacity: 0, x: 30 }} animate={{ opacity: 1, x: 0 }}>
                    <div className="summary-sticky-content">
                        <CreditCard data={formData} isFlipped={isFlipped} />

                        <div className="checkout-items-preview">
                            <span className="section-label">SISTEMA_PLAN_ACTIVO</span>
                            <div className="plan-preview-header">
                                <span className="plan-preview-label">{selectedPlan.label}</span>
                                <div className="plan-preview-title-row">
                                    <h3 className="plan-preview-title Montserrat-900">{selectedPlan.title}</h3>
                                    <span className="plan-preview-price Montserrat-900">ARS ${selectedPlan.price.toLocaleString()}</span>
                                </div>
                                <span className="plan-preview-period">// {selectedPlan.period}</span>
                            </div>
                            <ul className="plan-preview-features">
                                {selectedPlan.features.map((f, i) => (
                                    <li key={i}><span className="preview-bullet">_</span> {f}</li>
                                ))}
                            </ul>
                            {cuotasSeleccionadas <= selectedPlan.cuotas_sin_interes && cuotasSeleccionadas > 1 && (
                                <span className="badge-benefit Montserrat-800">SIN_INTERES_ACTIVO</span>
                            )}
                            {voucherAdded && (
                                <motion.div className="mini-item-container" initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}>
                                    <div className="mini-item">
                                        <span className="item-name Montserrat-900" style={{ fontSize: '0.85rem' }}>+ VOUCHER_EXAMEN</span>
                                        <span className="item-price Montserrat-900" style={{ fontSize: '0.9rem' }}>${VOUCHER_PLAN.price.toLocaleString()}</span>
                                    </div>
                                </motion.div>
                            )}
                        </div>

                        {/* UPSELL UPGRADE */}
                        {upgradeInfo && upgradePlan && (
                            <motion.div className="upsell-block" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
                                <div className="upsell-header">
                                    <span className="upsell-tag">// UPGRADE_DISPONIBLE</span>
                                    <span className="upsell-plan-name">{upgradeInfo.targetTitle}</span>
                                </div>
                                <ul className="upsell-benefits">
                                    {upgradeInfo.benefits.map((b, i) => <li key={i}><span className="upsell-bullet">+</span> {b}</li>)}
                                </ul>
                                <div className="upsell-diff"><span>DIFERENCIA</span><span>+ ${upgradeDiff.toLocaleString()}</span></div>
                                <a href={`/checkout/${upgradeInfo.targetId}`} className="upsell-cta Montserrat-900">MEJORAR_PLAN →</a>
                            </motion.div>
                        )}

                        {/* UPSELL VOUCHER ADD-ON (oculto si ya tiene un voucher sin usar) */}
                        {canAddVoucher && !voucherAdded && (
                            <motion.div className="upsell-block upsell-voucher" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }}>
                                <div className="upsell-header">
                                    <span className="upsell-tag">// ADD-ON_DISPONIBLE</span>
                                    <span className="upsell-plan-name">VOUCHER_EXAMEN</span>
                                </div>
                                <ul className="upsell-benefits">
                                    <li><span className="upsell-bullet">+</span> Derecho a examen final</li>
                                    <li><span className="upsell-bullet">+</span> Certificación oficial</li>
                                    <li><span className="upsell-bullet">+</span> Validez internacional</li>
                                </ul>
                                <div className="upsell-diff"><span>ADICIONAL</span><span>+ ${VOUCHER_PLAN.price.toLocaleString()}</span></div>
                                <button type="button" className="upsell-cta Montserrat-900" onClick={() => setVoucherAdded(true)}>AGREGAR_VOUCHER →</button>
                            </motion.div>
                        )}

                        {voucherAdded && (
                            <motion.div className="upsell-block upsell-added" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                                <div className="upsell-header">
                                    <span className="upsell-tag">// ADD-ON_ACTIVO</span>
                                    <span className="upsell-plan-name">VOUCHER_EXAMEN ✓</span>
                                </div>
                                <button type="button" className="upsell-remove" onClick={() => setVoucherAdded(false)}>QUITAR_VOUCHER</button>
                            </motion.div>
                        )}

                        {/* CUPÓN */}
                        <div className="checkout-coupon-box">
                            <div className="coupon-input-group">
                                <input placeholder="CODIGO_CUPON" value={couponInput} onChange={(e) => setCouponInput(e.target.value)} disabled={!user} />
                                <button type="button" onClick={handleApplyCoupon} className="Montserrat-900" disabled={!user}>APPLY</button>
                            </div>
                            {couponMsg.text && <p className={`coupon-msg ${couponMsg.isError ? 'err' : 'ok'}`}>{couponMsg.text}</p>}
                        </div>

                        {/* RESUMEN TOTAL */}
                        <div className="cart-summary-card">
                            <div className="summary-line">
                                <span>INVERSION_BASE</span>
                                <span>${selectedPlan.price.toLocaleString()}</span>
                            </div>
                            {voucherAdded && (
                                <div className="summary-line">
                                    <span>VOUCHER_EXAMEN</span>
                                    <span>+ ${VOUCHER_PLAN.price.toLocaleString()}</span>
                                </div>
                            )}
                            {totalConInteres > (selectedPlan.price + (voucherAdded ? VOUCHER_PLAN.price : 0)) && (
                                <div className="summary-line interest-row">
                                    <span>RECARGO_FINANCIERO</span>
                                    <span>+ ${(totalConInteres - selectedPlan.price - (voucherAdded ? VOUCHER_PLAN.price : 0)).toLocaleString()}</span>
                                </div>
                            )}
                            {appliedCoupon && (
                                <div className="summary-line discount-row Montserrat-800">
                                    <div className="discount-label-group">
                                        <span>CUPÓN_APLICADO</span>
                                        <span className="discount-badge">-{appliedCoupon.discount}%</span>
                                    </div>
                                    <span>- ${discountAmount.toLocaleString()}</span>
                                </div>
                            )}
                            <div className="divider-tech"></div>
                            <div className="summary-line total">
                                <span className="Montserrat-900">TOTAL_FINAL:</span>
                                <span className="Montserrat-900 accent-glow">${Math.round(finalAmount).toLocaleString()}</span>
                            </div>
                            {cuotasSeleccionadas > 1 && (
                                <div className="installment-details Montserrat-700">
                                    {cuotasSeleccionadas} PAGOS DE: ${Math.round(finalAmount / cuotasSeleccionadas).toLocaleString()}
                                </div>
                            )}
                        </div>
                    </div>
                </motion.div>
            </div>

            {/* BOTÓN FINAL */}
            <button
                type="submit"
                form="checkout-form"
                className="final-pay-btn Montserrat-900"
                disabled={loading || !user}
                style={{ maxWidth: '1400px', margin: '30px auto 0', display: 'block' }}
            >
                {!user ? 'INICIÁ SESIÓN PARA COMPRAR' : 'EJECUTAR_COMPRA'}
            </button>

        </main>
    );
};

export default Checkout;