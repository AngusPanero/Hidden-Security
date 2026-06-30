import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useNavigate } from "react-router-dom"; 
import "./cursoParam.css";

// Assets
import img1 from "../assets/soc-photo1.jpg"; 
import { UseTheme } from "../contexts/ThemeContext";
import { UseWidth } from "../contexts/WidthContext";
import LiveTypingText from "../ui/LiveTypingText";

const CursosParams = () => {
    const { theme } = UseTheme();
    const { width } = UseWidth();
    const navigate = useNavigate();
    const [expanded, setExpanded] = useState<number | null>(0);
    const isMobile = width <= 768;

    useEffect(() => {
        window.scrollTo(0, 0);
    }, []);

    const sectors = [
        { id: "01", title: "SOC Operations & Defence", desc: "Monitoreo de infraestructuras críticas en tiempo real bajo protocolos de alta fidelidad. Desarrollamos arquitecturas de detección inmersiva y respuesta proactiva con visión realista para perímetros corporativos. Diseñamos centros de operaciones que permiten una gestión de amenazas fluida y una resiliencia profunda, rompiendo los límites de la defensa tradicional de redes.", img: img1, code: "SEC_OPS_01" },
        { id: "02", title: "Offensive Red Teaming", desc: "Simulamos vectores de ataque avanzados para validar la integridad de sistemas de alta fidelidad. Desarrollamos auditorías de intrusión inmersivas y modelado de adversarios con enfoque realista para entornos de nube y on-premise. Diseñamos tácticas de explotación que permiten una evaluación de vulnerabilidades fluida y una protección profunda, rompiendo los límites del pentesting tradicional.", img: img1, code: "EN DESARROLLO - PROXIMAMENTE" },
        { id: "03", title: "Forensics & IR", desc: "Traducimos trazas digitales en evidencias procesables de alta fidelidad. Desarrollamos investigaciones post-mortem inmersivas y análisis de artefactos con reconstrucción realista para incidentes de ransomware y exfiltración. Diseñamos protocolos de preservación que permiten una recuperación de datos fluida y una victoria técnica profunda ante el compromiso, rompiendo los límites del análisis tradicional.", img: img1, code: "EN DESARROLLO - PROXIMAMENTE" },
        { id: "04", title: "Cloud & DevSecOps", desc: "Integramos seguridad en ciclos de despliegue automatizados de alta fidelidad. Desarrollamos pipelines de CI/CD inmersivos y monitoreo nativo con transparencia realista para arquitecturas de microservicios. Diseñamos perímetros definidos por software que permiten una escalabilidad fluida y una confianza de infraestructura profunda, rompiendo los límites de la ingeniería de sistemas tradicional.", img: img1, code: "EN DESARROLLO - PROXIMAMENTE" },
        { id: "05", title: "Malware Analysis & RE", desc: "Ingeniería inversa aplicada a ejecutables hostiles de alta fidelidad. Desarrollamos entornos de sandbox inmersivos y de-obfuscación avanzada con precisión realista para variantes de malware polimórfico. Diseñamos firmas de detección que permiten una neutralización fluida y una inmunidad operativa profunda en la red, rompiendo los límites de la actualización técnica tradicional.", img: img1, code: "EN DESARROLLO - PROXIMAMENTE" },
        { id: "06", title: "Cryptographic Engineering", desc: "Consolidamos protocolos de cifrado y privacidad de datos de alta fidelidad. Desarrollamos implementaciones de Zero Trust inmersivas y cifrado avanzado con validez realista para transacciones críticas y activos digitales. Diseñamos arquitecturas de identidad que permiten una transición fluida y una tranquilidad de datos profunda para el ecosistema, rompiendo los límites de la criptografía tradicional.", img: img1, code: "EN DESARROLLO - PROXIMAMENTE" },
    ];

    const handleExpand = (i: number) => {
        setExpanded(expanded === i ? i : i);
    };

    return (
        <main className={`h-tactic-root ${theme}`}>
            <header className="h-tactic-header">
                <div className="h-header-top-block">
                    <motion.div className="h-tactic-intro" initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.8 }}>
                        <span className="h-label-mono">// HABILIDADES - 2026</span>
                        <div className="h-title-logo-flex">
                            <h1 className="h-massive-title Montserrat-900">
                                NUESTRAS <span className="h-outline">CAPACITACIONES</span>
                            </h1>
                            <img className='hidden-logo-cursos' src="/logos/hidden-logo-sf.png" alt="hidden-logo" />
                        </div>
                        <div className="h-intro-p">
                            <LiveTypingText text="Unimos la inteligencia técnica con una ejecución de vanguardia. Nuestra metodología está diseñada para transformar perímetros digitales complejos en fortalezas de alta fidelidad, garantizando la supremacía defensiva en cada nodo de la red." />
                        </div>
                    </motion.div>
                </div>
            </header>

            <div className="h-tactic-horizon">
                <div className="h-tactic-wrapper">
                    {sectors.map((p, i) => {
                        const isAvailable = p.code !== "EN DESARROLLO - PROXIMAMENTE";
                        const slug = p.title.toLowerCase().replace(/ & /g, "-and-").replace(/\s+/g, "-");

                        return (
                            <motion.section
                                key={p.id}
                                className={`h-tactic-strip ${expanded === i ? 'is-active' : ''} ${isAvailable ? 'is-link' : 'is-locked'}`}
                                onClick={() => handleExpand(i)}
                                onMouseEnter={() => !isMobile && setExpanded(i)}
                                animate={{ width: isMobile ? "100%" : (expanded === i ? "55%" : "9%"), height: isMobile ? (expanded === i ? "510px" : "75px") : "100%" }}
                                transition={{ duration: 0.7, ease: [0.19, 1, 0.22, 1] }}
                            >
                                <div className="h-strip-bg">
                                    <motion.img src={p.img} alt={p.title} animate={{ scale: expanded === i ? 1.05 : 1.3, filter: expanded === i ? "grayscale(0) brightness(0.4)" : "grayscale(1) brightness(0.15)" }} />
                                    <div className="h-strip-overlay" />
                                </div>

                                <AnimatePresence>
                                    {expanded !== i && (
                                        <motion.div className="h-strip-collapsed" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                                            <span className="h-strip-id">{p.id}</span>
                                            <span className="h-strip-vertical-title">{p.title}</span>
                                        </motion.div>
                                    )}
                                </AnimatePresence>

                                <AnimatePresence>
                                    {expanded === i && (
                                        <motion.div className="h-strip-expanded" initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 10 }} transition={{ delay: 0.2, duration: 0.5 }}>
                                            <div className="h-expanded-header">
                                                <span className={`h-label-mono ${!isAvailable ? 'txt-disabled' : ''}`}>[{p.code}]</span>
                                                <h2 className="h-title Montserrat-900">{p.title}</h2>
                                            </div>
                                            <p className="h-expanded-desc">{p.desc}</p>
                                            {isAvailable && (
                                                <motion.button 
                                                    className="h-nav-button"
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        navigate(`/courses-info/${slug}`);
                                                    }}
                                                >
                                                    ACCEDER_AL_PROGRAMA [+]
                                                </motion.button>
                                            )}
                                        </motion.div>
                                    )}
                                </AnimatePresence>
                            </motion.section>
                        );
                    })}
                </div>
            </div>
        </main>
    );
};

export default CursosParams;