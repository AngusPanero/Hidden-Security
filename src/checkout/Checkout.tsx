import { useState, useMemo } from "react";
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
import ProcessOk from "../processMessages/ProcessOk";
import useMercadoPago from "../hooks/useMercadoPago";
import CreditCard from "../ui/creditCard/CreditCard";

const ALL_PLANS = [
    {
        id: "starter", title: "STARTER", price: 80000, cuotas_sin_interes: 6,
        label: "01 - TRAINING", period: "3 MESES DISPONIBLES",
        features: ["Acceso completo al curso", "Material descargable", "Certificado de cursada"]
    },
    {
        id: "pro", title: "PRO", price: 250000, cuotas_sin_interes: 6,
        label: "02 - BEST_SELLER", period: "6 MESES DISPONIBLES",
        features: ["1 Voucher de examen incluido", "Acceso a laboratorios", "Soporte prioritario"]
    },
    {
        id: "elite", title: "ELITE", price: 350000, cuotas_sin_interes: 6,
        label: "03 - FULL_STACK", period: "12 MESES DISPONIBLES",
        features: ["Beneficio de Re-intento", "Mentorship 1-to-1", "Acceso a Red de Empleo"]
    },
    {
        id: "voucher", title: "VOUCHER", price: 180000, cuotas_sin_interes: 6,
        label: "04 - CERTIFICATION", period: "ÚNICO USO",
        features: ["Derecho a examen final", "Certificación oficial", "Validez internacional"]
    },
    {
        id: "b2b_seis", title: "B2B_SEIS", price: 400000, cuotas_sin_interes: 6,
        label: "01 // BUSINESS_CORE", period: "6 MESES",
        features: ["Acceso a base de perfiles", "Filtros por habilidades", "3 Búsquedas activas", "Candidatos en dominio activo"]
    },
    {
        id: "b2b_doce", title: "B2B_DOCE", price: 700000, cuotas_sin_interes: 6,
        label: "02 // ENTERPRISE_PRO", period: "12 MESES",
        features: ["Publicaciones ilimitadas", "Estabilidad comercial extendida", "Continuidad en el ecosistema", "Soporte dedicado 24/7"]
    },
];

const INTERES_RATES: Record<string, number> = {
    "1": 0, "3": 0.05, "6": 0.10, "12": 0.20
};

const UPGRADE_MAP: Record<string, { targetId: string; targetTitle: string; benefits: string[] } | null> = {
    "starter":  { targetId: "pro",      targetTitle: "PRO",      benefits: ["1 Voucher de examen incluido", "Acceso a laboratorios", "Soporte prioritario"] },
    "pro":      { targetId: "elite",    targetTitle: "ELITE",    benefits: ["Beneficio de re-intento en examen", "Mentorship 1-to-1", "Acceso a Red de Empleo"] },
    "elite":    null,
    "voucher":  null,
    "b2b_seis": { targetId: "b2b_doce", targetTitle: "B2B_DOCE", benefits: ["Publicaciones ilimitadas", "Continuidad en el ecosistema", "Soporte dedicado 24/7"] },
    "b2b_doce": null,
};

const PLANS_WITHOUT_VOUCHER = ["starter"];
const VOUCHER_PLAN = ALL_PLANS.find(p => p.id === "voucher")!;

const Checkout = () => {
    const { planId } = useParams();
    const navigate = useNavigate();
    const mp = useMercadoPago();
    const [idempotencyKey] = useState(v4());
    const { theme } = UseTheme();
    const { user } = UseSession();
    const { applyCoupon, appliedCoupon } = UseCart();

    const [isFlipped, setIsFlipped] = useState(false);
    const [loading, setLoading] = useState(false);
    const [couponInput, setCouponInput] = useState('');
    const [couponMsg, setCouponMsg] = useState({ text: '', isError: false });
    const [error, setError] = useState<string | null>(null);
    const [status, setStatus] = useState<string>("");
    const [voucherAdded, setVoucherAdded] = useState(false);

    const [formData, setFormData] = useState({
        nombre: "", email: user?.email || "", dni: "",
        tarjetaNumero: "", mesVencimiento: "", añoVencimiento: "", cvv: "",
        cuotas: "1",
    });

    const selectedPlan = useMemo(() => ALL_PLANS.find(p => p.id === planId?.toLowerCase()), [planId]);
    const upgradeInfo  = useMemo(() => planId ? UPGRADE_MAP[planId.toLowerCase()] ?? null : null, [planId]);
    const canAddVoucher = useMemo(() => planId ? PLANS_WITHOUT_VOUCHER.includes(planId.toLowerCase()) : false, [planId]);
    const upgradePlan  = useMemo(() => upgradeInfo ? ALL_PLANS.find(p => p.id === upgradeInfo.targetId) : null, [upgradeInfo]);

    const cuotasSeleccionadas = parseInt(formData.cuotas);

    const totalConInteres = useMemo(() => {
        if (!selectedPlan) return 0;
        const base = selectedPlan.price + (voucherAdded ? VOUCHER_PLAN.price : 0);
        const esGratis = selectedPlan.cuotas_sin_interes && cuotasSeleccionadas <= selectedPlan.cuotas_sin_interes;
        const tasa = (cuotasSeleccionadas > 1 && !esGratis) ? (INTERES_RATES[formData.cuotas] || 0) : 0;
        return base * (1 + tasa);
    }, [selectedPlan, formData.cuotas, cuotasSeleccionadas, voucherAdded]);

    const finalAmount = useMemo(() => {
        if (!appliedCoupon) return totalConInteres;

        if (appliedCoupon.scope === 'all') {
            // descuenta todo
            return totalConInteres * (1 - appliedCoupon.discount / 100);
        }

        // scope: 'plans' — descuenta solo los items que aplican
        let discountableBase = 0;
        if (appliedCoupon.allowedPlans.includes(selectedPlan!.id)) {
            discountableBase += selectedPlan!.price;
        }
        if (voucherAdded && appliedCoupon.allowedPlans.includes('voucher')) {
            discountableBase += VOUCHER_PLAN.price;
        }

        const discount = discountableBase * (appliedCoupon.discount / 100);
        return totalConInteres - discount;

    }, [totalConInteres, appliedCoupon, selectedPlan, voucherAdded]);
    
    const discountAmount = totalConInteres - finalAmount;

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
        setFormData({ ...formData, [e.target.name]: e.target.value });

    const handleApplyCoupon = async () => {
        if (!user) { setCouponMsg({ text: "REGISTRO_REQUERIDO", isError: true }); return; }
        if (!selectedPlan) return;
        setLoading(true);

        // pasamos todos los planes del pedido actual
        const itemsToValidate = [selectedPlan.id, ...(voucherAdded ? ["voucher"] : [])];
        const message = await applyCoupon(couponInput, itemsToValidate);

        setCouponMsg({ text: message.toUpperCase(), isError: !message.includes('éxito') && !message.includes('🟢') });
        setLoading(false);
    };

    /* const makePayment = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!mp || !selectedPlan || !user) return;
        try {
            setLoading(true);
            const cardNumber   = formData.tarjetaNumero.replace(/\s/g, "");
            const paymentMethods = await mp.getPaymentMethods({ bin: cardNumber.substring(0, 6) });
            const paymentMethod  = paymentMethods?.results?.[0];
            if (!paymentMethod) console.error("TARJETA_NO_SOPORTADA");

            const cardToken = await mp.createCardToken({
                cardNumber,
                cardholderName:       formData.nombre,
                cardExpirationMonth:  formData.mesVencimiento,
                cardExpirationYear:   formData.añoVencimiento,
                securityCode:         formData.cvv,
                identificationType:   "DNI",
                identificationNumber: formData.dni,
            });

            const { data } = await axios.post(`${import.meta.env.VITE_API_URL}/mercado-pago-payments`, {
                token:              cardToken.id,
                payment_method_id:  paymentMethod.id,
                transaction_amount: Math.round(finalAmount),
                installments:       cuotasSeleccionadas,
                description:        `HIDDEN_SECURITY_PLAN: ${selectedPlan.title}${voucherAdded ? ' + VOUCHER' : ''}`,
                payer: { email: formData.email, identification: { type: "DNI", number: formData.dni } },
                idempotencyKey
            });

            if (data.status === "approved") setStatus("ok");
            else setError(data.status_detail || "ERROR_TRANSACCION");
        } catch (err: any) {
            setError(err.message || "FALLO_CRITICO_SISTEMA_PAGO");
        } finally {
            setLoading(false);
        }
    }; */

    const makePayment = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedPlan || !user) return;

        const items: string[] = [selectedPlan.id];
        if (voucherAdded) items.push("voucher");

        try {
            setLoading(true);

            const { data } = await axios.post(
                `${import.meta.env.VITE_API_URL}/test-course-payment`,
                {
                    transaction_amount: Math.round(finalAmount),
                    payer: { email: formData.email },
                    idempotencyKey,
                    items,
                    couponCode: appliedCoupon?.code || null,
                },
                { withCredentials: true }
            );

            if (data.mp_status === "approved") setStatus("ok");
            else setError(data.message || "ERROR_TRANSACCION");

        } catch (err: any) {
            setError(err.response?.data?.message || err.message || "FALLO_CRITICO_SISTEMA_PAGO");
        } finally {
            setLoading(false);
        }
    };

    if (!selectedPlan)   return <Error processMessage="NO IDENTIFICADO" />;
    if (error)           return <Error processMessage={error} />;
    if (loading)         return <Loader />;
    if (status === "ok") return <ProcessOk processMessage="COMPRA APROBADA!" />;

    const upgradeDiff = upgradePlan ? upgradePlan.price - selectedPlan.price : 0;

    return (
        <main className={`checkout-screen ${theme}`}>

            {/* AVISO SESIÓN — siempre primero */}
            {!user && (
                <motion.div className="session-required-banner" initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}>
                    <span className="session-required-tag">// AUTENTICACIÓN_REQUERIDA</span>
                    <p className="session-required-text">
                        El acceso al curso se registra en tu cuenta. Iniciá sesión para continuar con la compra.
                    </p>
                    <div className="session-required-actions">
                        <button type="button" className="session-btn-primary Montserrat-900" onClick={() => navigate('/login')}>
                            INICIAR_SESIÓN →
                        </button>
                        <button type="button" className="session-btn-secondary Montserrat-700" onClick={() => navigate('/register')}>
                            CREAR_CUENTA
                        </button>
                    </div>
                </motion.div>
            )}

            <div className="checkout-wrapper">

                {/* ── COLUMNA FORMULARIO ── */}
                <motion.div className="checkout-form-column" initial={{ opacity: 0, x: -30 }} animate={{ opacity: 1, x: 0 }}>
                    <header className="checkout-header">
                        <span className="terminal-text">// SECURE_GATEWAY_v2.0</span>
                        <h1 className="Montserrat-900">PROCESAR_<span>ACCESO</span></h1>
                    </header>

                    <form id="checkout-form" className="main-checkout-form" onSubmit={makePayment}>
                        <section className={`checkout-section ${!user ? 'section-locked' : ''}`}>
                            <span className="section-label">01 // IDENTIDAD_DIGITAL</span>
                            <div className="input-field">
                                <label>TITULAR_DE_TARJETA</label>
                                <input name="nombre" placeholder="NOMBRE_COMPLETO" onChange={handleChange} required disabled={!user} />
                            </div>
                            <div className="input-row" style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '15px' }}>
                                <div className="input-field">
                                    <label>ID_EMAIL</label>
                                    <input value={user ? formData.email : '—'} disabled className="disabled-input" />
                                </div>
                                <div className="input-field">
                                    <label>DNI</label>
                                    <input name="dni" placeholder="NUMERO" onChange={handleChange} required disabled={!user} />
                                </div>
                            </div>
                        </section>

                        <section className={`checkout-section ${!user ? 'section-locked' : ''}`}>
                            <span className="section-label">02 // CREDIT_CARD_PROTOCOLS</span>
                            <div className="input-field">
                                <label>NUMERO_DE_TARJETA</label>
                                <input name="tarjetaNumero" placeholder="0000 0000 0000 0000" onChange={handleChange} maxLength={19} required disabled={!user} />
                            </div>
                            <div className="input-row">
                                <input name="mesVencimiento" placeholder="MM" maxLength={2} onFocus={() => setIsFlipped(false)} onChange={handleChange} required disabled={!user} />
                                <input name="añoVencimiento" placeholder="YY" maxLength={2} onFocus={() => setIsFlipped(false)} onChange={handleChange} required disabled={!user} />
                                <input name="cvv" placeholder="CVV" maxLength={4} onFocus={() => setIsFlipped(true)} onBlur={() => setIsFlipped(false)} onChange={handleChange} required disabled={!user} />
                                <select className="select-cuotas" name="cuotas" value={formData.cuotas} onChange={handleChange} disabled={!user}>
                                    <option value="1">1 PAGO</option>
                                    <option value="3">3 CUOTAS</option>
                                    <option value="6">6 CUOTAS</option>
                                    <option value="12">12 CUOTAS</option>
                                </select>
                            </div>
                        </section>
                    </form>
                </motion.div>

                {/* ── COLUMNA RESUMEN ── */}
                <motion.div className="checkout-summary-column" initial={{ opacity: 0, x: 30 }} animate={{ opacity: 1, x: 0 }}>
                    <div className="summary-sticky-content">
                        <CreditCard data={formData} isFlipped={isFlipped} />

                        {/* PLAN SELECCIONADO — info completa */}
                        <div className="checkout-items-preview">
                            <span className="section-label">SISTEMA_PLAN_ACTIVO</span>

                            <div className="plan-preview-header">
                                <span className="plan-preview-label">{selectedPlan.label}</span>
                                <div className="plan-preview-title-row">
                                    <h3 className="plan-preview-title Montserrat-900">{selectedPlan.title}</h3>
                                    <span className="plan-preview-price Montserrat-900">
                                        ARS ${selectedPlan.price.toLocaleString()}
                                    </span>
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

                        {/* UPSELL: UPGRADE */}
                        {upgradeInfo && upgradePlan && (
                            <motion.div className="upsell-block" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
                                <div className="upsell-header">
                                    <span className="upsell-tag">// UPGRADE_DISPONIBLE</span>
                                    <span className="upsell-plan-name">{upgradeInfo.targetTitle}</span>
                                </div>
                                <ul className="upsell-benefits">
                                    {upgradeInfo.benefits.map((b, i) => (
                                        <li key={i}><span className="upsell-bullet">+</span> {b}</li>
                                    ))}
                                </ul>
                                <div className="upsell-diff">
                                    <span>DIFERENCIA</span>
                                    <span>+ ${upgradeDiff.toLocaleString()}</span>
                                </div>
                                <a href={`/checkout/${upgradeInfo.targetId}`} className="upsell-cta Montserrat-900">
                                    MEJORAR_PLAN →
                                </a>
                            </motion.div>
                        )}

                        {/* UPSELL: VOUCHER ADD-ON */}
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
                                <div className="upsell-diff">
                                    <span>ADICIONAL</span>
                                    <span>+ ${VOUCHER_PLAN.price.toLocaleString()}</span>
                                </div>
                                <button type="button" className="upsell-cta Montserrat-900" onClick={() => setVoucherAdded(true)}>
                                    AGREGAR_VOUCHER →
                                </button>
                            </motion.div>
                        )}

                        {voucherAdded && (
                            <motion.div className="upsell-block upsell-added" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                                <div className="upsell-header">
                                    <span className="upsell-tag">// ADD-ON_ACTIVO</span>
                                    <span className="upsell-plan-name">VOUCHER_EXAMEN ✓</span>
                                </div>
                                <button type="button" className="upsell-remove" onClick={() => setVoucherAdded(false)}>
                                    QUITAR_VOUCHER
                                </button>
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
                {!user ? '🔒 INICIÁ SESIÓN PARA COMPRAR' : 'EJECUTAR_COMPRA'}
            </button>

        </main>
    );
};

export default Checkout;