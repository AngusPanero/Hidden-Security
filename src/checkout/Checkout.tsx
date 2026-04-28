import { useState, useMemo } from "react";
import { useParams } from "react-router-dom";
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
    { id: "starter", title: "STARTER", price: 80000, cuotas_sin_interes: 6 },
    { id: "pro", title: "PRO", price: 250000, cuotas_sin_interes: 6 },
    { id: "elite", title: "ELITE", price: 350000, cuotas_sin_interes: 6 },
    { id: "voucher", title: "VOUCHER", price: 180000, cuotas_sin_interes: 6 },
    { id: "b2b_seis", title: "B2B_SEIS", price: 400000, cuotas_sin_interes: 6 },
    { id: "b2b_doce", title: "B2B_DOCE", price: 700000, cuotas_sin_interes: 6 }
];

const INTERES_RATES: Record<string, number> = {
    "1": 0,
    "3": 0.05, 
    "6": 0.10, 
    "12": 0.20 
};

const Checkout = () => {
    const { planId } = useParams();
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

    const [formData, setFormData] = useState({ 
        nombre: "", email: user?.email || "", dni: "", 
        tarjetaNumero: "", mesVencimiento: "", añoVencimiento: "", cvv: "", 
        cuotas: "1",
    });

    const selectedPlan = useMemo(() => 
        ALL_PLANS.find(p => p.id === planId?.toLowerCase()), 
    [planId]);

    const cuotasSeleccionadas = parseInt(formData.cuotas);

    // --- CÁLCULOS TÁCTICOS ---
    const totalConInteres = useMemo(() => {
        if (!selectedPlan) return 0;
        const base = selectedPlan.price;
        const esGratis = selectedPlan.cuotas_sin_interes && cuotasSeleccionadas <= selectedPlan.cuotas_sin_interes;
        const tasa = (cuotasSeleccionadas > 1 && !esGratis) ? (INTERES_RATES[formData.cuotas] || 0) : 0;
        return base * (1 + tasa);
    }, [selectedPlan, formData.cuotas, cuotasSeleccionadas]);

    const finalAmount = useMemo(() => {
        if (!appliedCoupon) return totalConInteres;
        return totalConInteres * (1 - appliedCoupon.discount / 100);
    }, [totalConInteres, appliedCoupon]);

    // Ahorro total por cupón
    const discountAmount = totalConInteres - finalAmount;

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        setFormData({ ...formData, [e.target.name]: e.target.value });
    };

    const handleApplyCoupon = async () => {
        if (!user) {
            setCouponMsg({ text: "REGISTRO_REQUERIDO", isError: true });
            return;
        }
        setLoading(true);
        const message = await applyCoupon(couponInput);
        const isError = message.includes('Error') || message.includes('expirado');
        setCouponMsg({ text: message.toUpperCase(), isError });
        setLoading(false);
    };

    const makePayment = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!mp || !selectedPlan) return;

        try {
            setLoading(true);
            const cardNumber = formData.tarjetaNumero.replace(/\s/g, "");
            const bin = cardNumber.substring(0, 6);
            const paymentMethods = await mp.getPaymentMethods({ bin });
            const paymentMethod = paymentMethods?.results?.[0];

            if (!paymentMethod) throw new Error("TARJETA_NO_SOPORTADA");

            const cardToken = await mp.createCardToken({
                cardNumber,
                cardholderName: formData.nombre,
                cardExpirationMonth: formData.mesVencimiento,
                cardExpirationYear: formData.añoVencimiento,
                securityCode: formData.cvv,
                identificationType: "DNI",
                identificationNumber: formData.dni,
            });

            const payload = {
                token: cardToken.id,
                payment_method_id: paymentMethod.id,
                transaction_amount: Math.round(finalAmount),
                installments: cuotasSeleccionadas,
                description: `HIDDEN_SECURITY_PLAN: ${selectedPlan.title}`,
                payer: { email: formData.email, identification: { type: "DNI", number: formData.dni } },
                idempotencyKey
            };

            const { data } = await axios.post(`${import.meta.env.VITE_API_URL}/mercado-pago-payments`, payload);

            if (data.status === "approved") {
                setStatus("ok");
            } else {
                setError(data.status_detail || "ERROR_TRANSACCION");
            }
        } catch (err: any) {
            setError(err.message || "FALLO_CRITICO_SISTEMA_PAGO");
        } finally {
            setLoading(false);
        }
    };

    if (!selectedPlan) return <Error processMessage="PLAN_NO_IDENTIFICADO" />;
    if (error) return <Error processMessage={error}/>;
    if (loading) return <Loader />;
    if (status === "ok") return <ProcessOk processMessage={"ACCESO_CONCEDIDO_AL_NODO"} />;

    return (
        <main className={`checkout-screen ${theme}`}>
            <div className="checkout-wrapper">
                
                {/* COLUMNA FORMULARIO */}
                <motion.div 
                    className="checkout-form-column"
                    initial={{ opacity: 0, x: -30 }}
                    animate={{ opacity: 1, x: 0 }}
                >
                    <header className="checkout-header">
                        <span className="terminal-text">// SECURE_GATEWAY_v2.0</span>
                        <h1 className="Montserrat-900">PROCESAR_<span>ACCESO</span></h1>
                    </header>

                    <form className="main-checkout-form" onSubmit={makePayment}>
                        <section className="checkout-section">
                            <span className="section-label">01 // IDENTIDAD_DIGITAL</span>
                            <div className="input-field">
                                <label>TITULAR_DE_TARJETA</label>
                                <input name="nombre" placeholder="NOMBRE_COMPLETO" onChange={handleChange} required />
                            </div>
                            <div className="input-row" style={{display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '15px'}}>
                                <div className="input-field">
                                    <label>ID_EMAIL</label>
                                    <input value={formData.email} disabled className="disabled-input" />
                                </div>
                                <div className="input-field">
                                    <label>DNI</label>
                                    <input name="dni" placeholder="NUMERO" onChange={handleChange} required />
                                </div>
                            </div>
                        </section>

                        <section className="checkout-section">
                            <span className="section-label">02 // CREDIT_CARD_PROTOCOLS</span>
                            <div className="input-field">
                                <label>NUMERO_DE_TARJETA</label>
                                <input name="tarjetaNumero" placeholder="0000 0000 0000 0000" onChange={handleChange} maxLength={19} required />
                            </div>
                            <div className="input-row">
                                <input name="mesVencimiento" placeholder="MM" maxLength={2} onFocus={() => setIsFlipped(false)} onChange={handleChange} required />
                                <input name="añoVencimiento" placeholder="YY" maxLength={2} onFocus={() => setIsFlipped(false)} onChange={handleChange} required />
                                <input name="cvv" placeholder="CVV" maxLength={4} onFocus={() => setIsFlipped(true)} onBlur={() => setIsFlipped(false)} onChange={handleChange} required />
                                <select className="select-cuotas" name="cuotas" value={formData.cuotas} onChange={handleChange}>
                                    <option value="1">1 PAGO</option>
                                    <option value="3">3 CUOTAS</option>
                                    <option value="6">6 CUOTAS</option>
                                    <option value="12">12 CUOTAS</option>
                                </select>
                            </div>
                        </section>

                        <button type="submit" className="final-pay-btn Montserrat-900">
                            EJECUTAR_TRANSACCION
                        </button>
                    </form>
                </motion.div>

                {/* COLUMNA RESUMEN */}
                <motion.div 
                    className="checkout-summary-column"
                    initial={{ opacity: 0, x: 30 }}
                    animate={{ opacity: 1, x: 0 }}
                >
                    <div className="summary-sticky-content">
                        <CreditCard data={formData} isFlipped={isFlipped} />
                        
                        <div className="checkout-items-preview">
                            <span className="section-label">SISTEMA_PLAN_ACTIVO</span>
                            <div className="mini-item-container">
                                <div className="mini-item">
                                    <span className="item-name Montserrat-900">{selectedPlan.title}</span>
                                    <span className="item-price Montserrat-900">${selectedPlan.price.toLocaleString()}</span>
                                </div>
                                {cuotasSeleccionadas <= selectedPlan.cuotas_sin_interes && cuotasSeleccionadas > 1 && (
                                    <span className="badge-benefit Montserrat-800">SIN_INTERES_ACTIVO</span>
                                )}
                            </div>
                        </div>

                        <div className="checkout-coupon-box">
                            <div className="coupon-input-group">
                                <input placeholder="CODIGO_CUPON" value={couponInput} onChange={(e) => setCouponInput(e.target.value)} />
                                <button type="button" onClick={handleApplyCoupon} className="Montserrat-900">APPLY</button>
                            </div>
                            {couponMsg.text && <p className={`coupon-msg ${couponMsg.isError ? 'err' : 'ok'}`}>{couponMsg.text}</p>}
                        </div>

                        <div className="cart-summary-card">
                            <div className="summary-line">
                                <span>INVERSION_BASE</span>
                                <span>${selectedPlan.price.toLocaleString()}</span>
                            </div>
                            
                            {totalConInteres > selectedPlan.price && (
                                <div className="summary-line interest-row">
                                    <span>RECARGO_FINANCIERO</span>
                                    <span>+ ${(totalConInteres - selectedPlan.price).toLocaleString()}</span>
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
                                    {cuotasSeleccionadas} PAGOS DE: ${(finalAmount / cuotasSeleccionadas).toLocaleString()}
                                </div>
                            )}
                        </div>
                    </div>
                </motion.div>
            </div>
        </main>
    );
};

export default Checkout;