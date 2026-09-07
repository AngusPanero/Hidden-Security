import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import axios from "axios";
import { UseTheme } from "../contexts/ThemeContext";
import LiveTypingText from "../ui/LiveTypingText";
import "./pricing.css";
import { useNavigate } from "react-router-dom";

// --- Tipos y textos del formulario de solicitud (Empresa / Trainee) ------------
type RequestType = "empresa" | "trainee";

interface RequestFormState {
    email:   string;
    fullName: string;
    company: string;
    country: string;
}

const EMPTY_REQUEST_FORM: RequestFormState = {
    email: "", fullName: "", company: "", country: "",
};

const REQUEST_TYPE_COPY: Record<RequestType, { label: string; description: string }> = {
    empresa: {
        label: "EMPRESA",
        description:
            "Solicitá acceso corporativo para tu organización: acceso a la base de datos de candidatos certificados y búsqueda de talento por habilidades, herramientas y certificaciones dentro de la plataforma de Hidden Security.",
    },
    trainee: {
        label: "TRAINEE / SPONSOR",
        description:
            "Sumate como trainee o sponsor para brindar capacitaciones en conjunto con Hidden Security y formar parte activa de nuestro ecosistema de formación en ciberseguridad.",
    },
};

const Pricing = () => {
    const { theme } = UseTheme();
    const navigate = useNavigate();
    const [view, setView] = useState<"students" | "business">("students");

    // --- Estado del modal de solicitud --------------------------------------
    const [requestOpen,      setRequestOpen]      = useState(false);
    const [requestType,      setRequestType]      = useState<RequestType>("empresa");
    const [requestForm,      setRequestForm]      = useState<RequestFormState>(EMPTY_REQUEST_FORM);
    const [requestSubmitted, setRequestSubmitted] = useState(false);
    const [requestLoading,   setRequestLoading]   = useState(false);
    const [requestError,     setRequestError]     = useState<string | null>(null);

    useEffect(() => {
        window.scrollTo(0, 0);
    }, []);

    // Cerrar el modal con ESC
    useEffect(() => {
        if (!requestOpen) return;
        const onKeyDown = (e: KeyboardEvent) => {
            if (e.key === "Escape") closeRequestModal();
        };
        document.addEventListener("keydown", onKeyDown);
        return () => document.removeEventListener("keydown", onKeyDown);
    }, [requestOpen]);

    const openRequestModal = (type: RequestType) => {
        setRequestType(type);
        setRequestSubmitted(false);
        setRequestError(null);
        setRequestForm(EMPTY_REQUEST_FORM);
        setRequestOpen(true);
    };

    const closeRequestModal = () => {
        setRequestOpen(false);
    };

    const handleRequestChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setRequestForm({ ...requestForm, [e.target.name]: e.target.value });
    };

    const handleRequestSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setRequestError(null);
        setRequestLoading(true);

        try {
            await axios.post(
                `${import.meta.env.VITE_API_URL}/corporate-mailing/request`,
                { requestType, ...requestForm },
                { withCredentials: true }
            );
            setRequestSubmitted(true);
        } catch (err: any) {
            const backendMsg = err.response?.data?.message;
            setRequestError(backendMsg || "No se pudo enviar la solicitud. Intentá de nuevo en unos minutos.");
        } finally {
            setRequestLoading(false);
        }
    };

    const handlePurchase = (planTitle: string) => {
        const planMap: Record<string, string> = {
            "CERTIFICACIÓN INDIVIDUAL": "voucher",
        };
        const planId = planMap[planTitle] ?? planTitle.toLowerCase();
        navigate(`/checkout/${planId}`);
    };

    const studentPlans = [
        { title: "STARTER", price: "100.000", desc: "Ideal para comenzar tu formación y desarrollar las habilidades necesarias para iniciar una carrera en ciberseguridad.", period: "3 MESES DISPONIBLES", features: ["Acceso a todos los cursos", "Acceso a futuros cursos publicados", "Certificado de finalización de curso"], label: "01 - TRAINING", cuotas: 3 },
        { title: "PRO", price: "200.000", desc: "La mejor opción para quienes buscan prepararse y validar sus habilidades.",period: "6 MESES DISPONIBLES", features: ["1 Voucher de certificación Hidden Security", "Acceso a todos los cursos", "Acceso a futuros cursos publicados", "Certificado de finalización de curso"], label: "02 - RECOMENDADO", highlight: true, cuotas: 3},
        { title: "ELITE", price: "300.000", desc: "La experiencia más completa para quienes desean aprovechar al máximo el ecosistema de Hidden Security.", period: "12 MESES DISPONIBLES", features: ["Acceso a todos los cursos", "Acceso a futuros cursos publicados", "Certificado de finalización de curso", "Voucher de certificación Hidden Security", "2do Voucher de certificación en caso de no aprobar el primero"], label: "03 - FULL_STACK", cuotas: 3 },
        { title: "CERTIFICACIÓN INDIVIDUAL", desc: "Si ya contás con los conocimientos necesarios, podés rendir la certificación sin necesidad de realizar nuestros cursos.", price: "150.000", period: "UNICO USO", features: ["Un Intento de certificación Hidden Security", "Validación de conocimiento obtenido", "Título de certificacion Hidden Security"], label: "04 - CERTIFICATION", cuotas: 3 }
    ];

    const businessPlans = [
        { 
            title: "BUSINESS", // B2B_SEIS
            price: "900.000", 
            period: "6 MESES",
            desc: "Ideal para empresas que buscan incorporar talento especializado en ciberseguridad.", 
            features: ["Acceso a base de datos de perfiles", "Búsqueda por habilidades, herramientas y certificaciones", "Publicación de ofertas laborales", "Contacto directo con candidatos", "Hasta 10 busquedas activas"],
            label: "01 // BUSINESS",
            cuotas: 3
        },
        { 
            title: "ENTERPRISE", // B2B_DOCE
            price: "1.500.000", 
            period: "12 MESES", 
            desc: "Para organizaciones con procesos de selección continuos.",
            features: ["Todo lo incluído en Business", "Publicaciones ilimitadas", "Busquedas activas ilimitadas", "Soporte prioritario", "Acceso prioritario a nuevas funcionalidades"],
            label: "02 // ENTERPRISE: RECOMENDADO",
            highlight: true,
            cuotas: 3
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

                {/* -- Banner de solicitud previa -- solo en vista Corporativo -- */}
                {view === "business" && (
                    <motion.div
                        className="pr-banner"
                        initial={{ opacity: 0, y: -10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.4 }}
                    >
                        <div className="pr-banner-text">
                            <span className="h-label-mono pr-banner-tag">// ACCESO_RESTRINGIDO</span>
                            <p>
                                Los planes corporativos, y la incorporación como trainee/sponsor, requieren
                                completar una solicitud externa antes de quedar habilitados para la compra.
                            </p>
                        </div>
                        <div className="pr-banner-actions">
                            <button className="pr-banner-btn" onClick={() => openRequestModal("empresa")}>
                                SOLICITAR ACCESO EMPRESA
                            </button>
                            <button className="pr-banner-btn pr-banner-btn--ghost" onClick={() => openRequestModal("trainee")}>
                                POSTULARME COMO TRAINEE / SPONSOR
                            </button>
                        </div>
                    </motion.div>
                )}

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

                                <p className="plan-desc">{plan.desc}</p>
                                
                                <ul className="plan-features">
                                    {plan.features.map((f, idx) => (
                                        <li key={idx} className="Montserrat-500">
                                            <span className="bullet">_</span> {f}
                                        </li>
                                    ))}
                                </ul>

                                {view === "business" ? (
                                    <button className="plan-cta Montserrat-900" onClick={() => openRequestModal("empresa")}>
                                        SOLICITAR_ACCESO
                                    </button>
                                ) : (
                                    <button className="plan-cta Montserrat-900" onClick={() => handlePurchase(plan.title)}>
                                        {plan.title === "CERTIFICACIÓN INDIVIDUAL" ? "ADQUIRIR_EXAMEN" : "COMPRAR"}
                                    </button>
                                )}
                                
                                {plan.highlight && <div className="highlight-glow" />}
                            </motion.div>
                        ))}
                    </AnimatePresence>
                </div>
            </section>

            {/* -- Modal de solicitud (Empresa / Trainee-Sponsor) -- */}
            <AnimatePresence>
                {requestOpen && (
                    <motion.div
                        className="pr-overlay"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.25 }}
                        onClick={closeRequestModal}
                    >
                        <motion.div
                            className={`pr-modal ${theme}`}
                            initial={{ opacity: 0, y: 24, scale: 0.98 }}
                            animate={{ opacity: 1, y: 0, scale: 1 }}
                            exit={{ opacity: 0, y: 16, scale: 0.98 }}
                            transition={{ duration: 0.3 }}
                            onClick={(e) => e.stopPropagation()}
                        >
                            <button className="pr-close" onClick={closeRequestModal} aria-label="Cerrar">×</button>

                            {requestSubmitted ? (
                                <div className="pr-success">
                                    <span className="h-label-mono pr-banner-tag">// SOLICITUD_ENVIADA</span>
                                    <h3>¡Listo! Recibimos tu solicitud.</h3>
                                    <p>
                                        Nuestro equipo va a revisar la información y se va a poner en contacto
                                        con vos a la brevedad para continuar con el proceso.
                                    </p>
                                    <button className="plan-cta Montserrat-900" onClick={closeRequestModal}>
                                        CERRAR
                                    </button>
                                </div>
                            ) : (
                                <>
                                    <span className="h-label-mono pr-banner-tag">// SOLICITUD_DE_ACCESO</span>
                                    <h3 className="pr-title">Completá tu solicitud</h3>

                                    <div className="pr-field">
                                        <label htmlFor="pr-type">TIPO DE SOLICITUD</label>
                                        <select
                                            id="pr-type"
                                            className="pr-select"
                                            value={requestType}
                                            onChange={(e) => setRequestType(e.target.value as RequestType)}
                                            disabled={requestLoading}
                                        >
                                            <option value="empresa">Empresa</option>
                                            <option value="trainee">Trainee / Sponsor</option>
                                        </select>
                                    </div>

                                    <p className="pr-desc">{REQUEST_TYPE_COPY[requestType].description}</p>

                                    <form className="pr-form" onSubmit={handleRequestSubmit}>
                                        <div className="pr-field">
                                            <label htmlFor="pr-email">EMAIL CORPORATIVO</label>
                                            <input
                                                id="pr-email"
                                                name="email"
                                                type="email"
                                                className="pr-input"
                                                placeholder="nombre@empresa.com"
                                                value={requestForm.email}
                                                onChange={handleRequestChange}
                                                required
                                                disabled={requestLoading}
                                            />
                                        </div>

                                        <div className="pr-field">
                                            <label htmlFor="pr-fullName">NOMBRE COMPLETO</label>
                                            <input
                                                id="pr-fullName"
                                                name="fullName"
                                                type="text"
                                                className="pr-input"
                                                placeholder="Nombre y apellido"
                                                value={requestForm.fullName}
                                                onChange={handleRequestChange}
                                                required
                                                disabled={requestLoading}
                                            />
                                        </div>

                                        <div className="pr-field">
                                            <label htmlFor="pr-company">NOMBRE DE LA EMPRESA</label>
                                            <input
                                                id="pr-company"
                                                name="company"
                                                type="text"
                                                className="pr-input"
                                                placeholder="Empresa u organización"
                                                value={requestForm.company}
                                                onChange={handleRequestChange}
                                                required
                                                disabled={requestLoading}
                                            />
                                        </div>

                                        <div className="pr-field">
                                            <label htmlFor="pr-country">PAÍS</label>
                                            <input
                                                id="pr-country"
                                                name="country"
                                                type="text"
                                                className="pr-input"
                                                placeholder="País desde donde se contactan"
                                                value={requestForm.country}
                                                onChange={handleRequestChange}
                                                required
                                                disabled={requestLoading}
                                            />
                                        </div>

                                        {requestError && (
                                            <p className="pr-error">{requestError}</p>
                                        )}

                                        <button type="submit" className="plan-cta Montserrat-900 pr-submit" disabled={requestLoading}>
                                            {requestLoading ? "ENVIANDO..." : "ENVIAR_SOLICITUD →"}
                                        </button>
                                    </form>
                                </>
                            )}
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>
        </main>
    );
};

export default Pricing;