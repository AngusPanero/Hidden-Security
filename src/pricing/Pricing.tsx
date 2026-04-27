import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { UseTheme } from "../contexts/ThemeContext";
import LiveTypingText from "../ui/LiveTypingText";
import "./pricing.css";

const Pricing = () => {
    const { theme } = UseTheme();
    const [view, setView] = useState<"students" | "business">("students");

    useEffect(() => {
        window.scrollTo(0, 0);
    }, []);

    const studentPlans = [
        { title: "STARTER", price: "80.000", period: "3 MESES DISPONIBLES", features: ["Acceso completo al curso", "Material descargable", "Certificado de cursada"], label: "01 - TRAINING" },
        { title: "PRO", price: "250.000", period: "6 MESES DISPONIBLES", features: ["1 Voucher de examen incluido", "Acceso a laboratorios", "Soporte prioritario"], label: "02 - BEST_SELLER", highlight: true },
        { title: "ELITE", price: "350.000", period: "12 MESES DISPONIBLES", features: ["Beneficio de Re-intento", "Mentorship 1-to-1", "Acceso a Red de Empleo"], label: "03 - FULL_STACK" },
        { title: "VOUCHER", price: "180.000", period: "UNICO USO", features: ["Derecho a examen final", "Certificación oficial", "Validez internacional"], label: "04 - CERTIFICATION" }
    ];

    const businessPlans = [
        { 
            title: "B2B_SEIS", 
            price: "400.000", 
            period: "6 MESES", 
            features: ["Acceso a base de perfiles", "Filtros por habilidades", "3 Búsquedas activas", "Candidatos en dominio activo"],
            label: "01 // BUSINESS_CORE"
        },
        { 
            title: "B2B_DOCE", 
            price: "700.000", 
            period: "12 MESES", 
            features: ["Publicaciones ilimitadas", "Estabilidad comercial extendida", "Continuidad en el ecosistema", "Soporte dedicado 24/7"],
            label: "02 // ENTERPRISE_PRO",
            highlight: true
        }
    ];

    return (
        <main className={`pricing-root ${theme}`}>
            <section className="pricing-container">
                <header className="pricing-header">
                    <motion.div 
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ duration: 0.8 }}
                    >
                        <span className="h-label-mono">// ESTRUCTURA_DE_COSTOS</span>
                        <h1 className="h-massive-title Montserrat-900">
                            INVERSIÓN EN <span className="h-outline">CAPACIDAD</span>
                        </h1>
                        <div className="pricing-intro-p">
                            <LiveTypingText text="Selecciona el nodo de acceso que mejor se adapte a tus requerimientos operativos. Todos nuestros planes incluyen acceso a la infraestructura de aprendizaje de Hidden Security." />
                        </div>
                    </motion.div>
                    
                    {/* TOGGLE SWITCH CORPORATIVO */}
                    <div className="pricing-selector-container">
                        <div className="pricing-toggle-wrapper">
                            <button className={`toggle-btn ${view === "students" ? "active" : ""}`} onClick={() => setView("students")}>ESTUDIANTES</button>
                            <button className={`toggle-btn ${view === "business" ? "active" : ""}`} onClick={() => setView("business")}>CORPORATIVO</button>
                            <motion.div 
                                className="toggle-slider"
                                animate={{ x: view === "students" ? "0%" : "100%" }}
                                transition={{ type: "spring", stiffness: 300, damping: 30 }}
                            />
                        </div>
                    </div>
                </header>

                <div className="pricing-grid">
                    <AnimatePresence mode="wait">
                        {(view === "students" ? studentPlans : businessPlans).map((plan, i) => (
                            <motion.div 
                                key={plan.title}
                                className={`pricing-card ${plan.highlight ? 'highlight' : ''}`}
                                initial={{ opacity: 0, y: 30 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, scale: 0.95 }}
                                transition={{ duration: 0.5, delay: i * 0.1 }}
                            >
                                <div className="card-header">
                                    <span className="h-label-mono">{plan.label}</span>
                                    <h3 className="plan-title Montserrat-900">{plan.title}</h3>
                                </div>
                                
                                <div className="price-block">
                                    <div className="plan-price">
                                        <span className="currency">ARS $</span>
                                        <span className="amount">{plan.price}</span>
                                    </div>
                                    <span className="plan-period Montserrat-700">// {plan.period}</span>
                                </div>
                                
                                <ul className="plan-features">
                                    {plan.features.map((f, idx) => (
                                        <li key={idx} className="Montserrat-500">
                                            <span className="bullet">_</span> {f}
                                        </li>
                                    ))}
                                </ul>

                                <button className="plan-cta Montserrat-900">
                                    {plan.title === "VOUCHER" ? "ADQUIRIR_EXAMEN" : "SOLICITAR_ACCESO"}
                                </button>
                                
                                {plan.highlight && <div className="highlight-glow" />}
                            </motion.div>
                        ))}
                    </AnimatePresence>
                </div>
            </section>
        </main>
    );
};

export default Pricing;