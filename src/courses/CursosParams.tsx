import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useNavigate } from "react-router-dom";
import "./cursoParam.css";

// Assets
import img1 from "../assets/soc-photo1.jpg";
import { UseTheme } from "../contexts/ThemeContext";
import LiveTypingText from "../ui/LiveTypingText";

const TOPICS = [
    "Fundamentos de Ciberseguridad",
    "Redes y Protocolos",
    "Sistemas Operativos (Windows y Linux)",
    "Análisis de Logs",
    "Malware y Amenazas",
    "MITRE ATT&CK",
    "SIEM",
    "EDR/XDR",
    "Threat Intelligence",
    "Introducción al Pentesting",
    "OSINT",
    "Python para Ciberseguridad",
    "PowerShell",
    "Active Directory",
    "Cloud Security",
    "Seguridad Web",
    "Gestión de Incidentes",
    "Ingeniería Social",
    "Seguridad en Identidades",
    "Inteligencia Artificial aplicada a Ciberseguridad",
];

const PREVIEW_COUNT = 8;
const LOCKED_CODE = "EN DESARROLLO - PROXIMAMENTE";

const CursosParams = () => {
    const { theme } = UseTheme();
    const navigate = useNavigate();
    const [topicsExpanded, setTopicsExpanded] = useState(false);

    useEffect(() => {
        window.scrollTo(0, 0);
    }, []);

    const sectors = [
        { id: "01", title: "MODERN SOC OPERATIONS", sub: "La formación integral para el SOC moderno", desc: "Desarrollá las habilidades técnicas, operativas y analíticas que hoy demandan los Centros de Operaciones de Seguridad. Aprendé a investigar alertas, correlacionar eventos, responder incidentes y trabajar junto a herramientas de automatización e inteligencia artificial en escenarios inspirados en situaciones reales.", img: img1, code: "SEC_OPS_01" },
        { id: "02", title: "THREAT HUNTING", sub: "Búsqueda proactiva de amenazas", desc: "Aprendé a detectar amenazas que logran evadir los mecanismos tradicionales de seguridad. Desarrollá hipótesis de hunting, analizá telemetría, correlacioná eventos y descubrí actividad maliciosa antes de que genere un incidente.", img: img1, code: LOCKED_CODE },
        { id: "03", title: "INCIDENT RESPONSE", sub: "Gestión técnica de incidentes", desc: "Conocé el ciclo completo de respuesta ante incidentes de seguridad. Aprendé a contener, investigar, documentar y colaborar en la recuperación de entornos comprometidos siguiendo metodologías utilizadas por equipos de respuesta profesionales.", img: img1, code: LOCKED_CODE },
        { id: "04", title: "THREAT INTELLIGENCE", sub: "Comprender al adversario", desc: "Analizá actores de amenazas, campañas, TTPs e indicadores de compromiso para transformar información en inteligencia accionable. Aprendé a contextualizar riesgos y fortalecer la detección y la toma de decisiones.", img: img1, code: LOCKED_CODE },
        { id: "05", title: "PENTESTING", sub: "Seguridad ofensiva", desc: "Comprendé cómo piensan y trabajan los atacantes mediante pruebas de penetración controladas. Aprendé reconocimiento, identificación de vulnerabilidades, explotación básica y elaboración de recomendaciones para fortalecer la postura de seguridad.", img: img1, code: LOCKED_CODE },
        { id: "06", title: "GRC", sub: "Gobierno, Riesgo y Cumplimiento", desc: "Desarrollá una visión estratégica de la ciberseguridad. Aprendé a gestionar riesgos, implementar controles, comprender marcos normativos y colaborar con las áreas de negocio para fortalecer la seguridad de la organización.", img: img1, code: LOCKED_CODE },
    ];

    // ── Misma lógica de navegación que antes ──
    const getSlug = (title: string) =>
        title.toLowerCase().replace(/ & /g, "-and-").replace(/\s+/g, "-");

    const available = sectors.filter((s) => s.code !== LOCKED_CODE);
    const locked = sectors.filter((s) => s.code === LOCKED_CODE);

    const visibleTopics = topicsExpanded ? TOPICS : TOPICS.slice(0, PREVIEW_COUNT);

    return (
        <main className={`hcp-root ${theme}`}>

            {/* ── HEADER ── */}
            <header className="hcp-header">
                <motion.div
                    className="hcp-header-inner"
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ duration: 0.8 }}
                >
                    <div className="hcp-header-text">
                        <span className="hcp-terminal">// HABILIDADES - 2026</span>
                        <h1 className="hcp-title Montserrat-900">
                            NUESTROS <span>CURSOS</span>
                        </h1>
                        <span className="hcp-terminal hcp-terminal--muted">
                            Aprendé las habilidades que demanda la industria.
                        </span>
                    </div>
                    <img className="hcp-logo" src="/logos/logo-hidden-final.png" alt="hidden-logo" />
                </motion.div>

                <div className="hcp-intro">
                    <LiveTypingText text="Aprendé las habilidades que demanda la industria. Nuestros cursos están diseñados para desarrollar conocimientos técnicos y operativos basados en escenarios reales, preparándote para enfrentar desafíos del mundo laboral y, cuando corresponda, rendir nuestras certificaciones." />
                </div>
            </header>

            {/* ── PROGRAMA DISPONIBLE ── */}
            <section className="hcp-block">
                <div className="hcp-section-label">
                    <span>PROGRAMAS_ACTIVOS</span>
                    <span className="hcp-count">[{available.length}]</span>
                    <div className="hcp-rule" />
                </div>

                {available.map((p) => {
                    const slug = getSlug(p.title);
                    return (
                        <motion.article
                            key={p.id}
                            className="hcp-featured"
                            initial={{ opacity: 0, y: 24 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ duration: 0.7, delay: 0.2, ease: [0.19, 1, 0.22, 1] }}
                        >
                            <div className="hcp-featured-media">
                                <img src={p.img} alt={p.title} />
                                <div className="hcp-featured-scan" />
                                <span className="hcp-featured-id Montserrat-900">{p.id}</span>
                            </div>

                            <div className="hcp-featured-body">
                                <div className="hcp-status hcp-status--live">
                                    <span className="hcp-dot" />
                                    [{p.code}]
                                </div>
                                <h2 className="hcp-featured-title Montserrat-900">{p.title}</h2>
                                <span className="hcp-featured-sub">// {p.sub}</span>
                                <p className="hcp-featured-desc">{p.desc}</p>

                                <button
                                    className="hcp-cta Montserrat-900"
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        navigate(`/courses-info/${slug}`);
                                    }}
                                >
                                    ACCEDER_AL_PROGRAMA [+]
                                </button>
                            </div>
                        </motion.article>
                    );
                })}
            </section>

            {/* ── PROGRAMAS EN DESARROLLO ── */}
            <section className="hcp-block">
                <div className="hcp-section-label">
                    <span>EN_DESARROLLO</span>
                    <span className="hcp-count">[{locked.length}]</span>
                    <div className="hcp-rule" />
                </div>

                <div className="hcp-locked-grid">
                    {locked.map((p) => (
                        <article key={p.id} className="hcp-locked">
                            <div className="hcp-locked-top">
                                <span className="hcp-locked-id">{p.id}</span>
                                <span className="hcp-lock" aria-hidden="true">🔒</span>
                            </div>
                            <h3 className="hcp-locked-title Montserrat-900">{p.title}</h3>
                            <span className="hcp-locked-sub">// {p.sub}</span>
                            <p className="hcp-locked-desc">{p.desc}</p>
                            <div className="hcp-status hcp-status--locked">[{p.code}]</div>
                        </article>
                    ))}
                </div>
            </section>

            {/* ── SECCIÓN: Y MUCHO MÁS ── */}
            <section className="hcp-block hcp-more">
                <div className="hcp-section-label">
                    <span>CONTENIDO_ESPECÍFICO</span>
                    <div className="hcp-rule" />
                </div>

                <div className="hcp-more-body">
                    <div className="hcp-more-left">
                        <h2 className="hcp-more-title Montserrat-900">
                            Y mucho <span>más_</span>
                        </h2>
                        <p className="hcp-more-desc">
                            Además de nuestros programas orientados a roles, Hidden Security ofrecerá cursos específicos para desarrollar habilidades técnicas puntuales que complementen tu crecimiento profesional.
                        </p>
                        <p className="hcp-more-desc">
                            Desde fundamentos para quienes recién comienzan hasta contenidos especializados para profundizar conocimientos en distintas áreas de la ciberseguridad.
                        </p>
                    </div>

                    <div className="hcp-more-right">
                        <span className="hcp-terminal">Algunos de los temas que iremos incorporando incluyen:</span>

                        <ul className="hcp-topics">
                            <AnimatePresence initial={false}>
                                {visibleTopics.map((topic, i) => (
                                    <motion.li
                                        key={topic}
                                        className="hcp-topic"
                                        initial={{ opacity: 0, x: -8 }}
                                        animate={{ opacity: 1, x: 0 }}
                                        exit={{ opacity: 0 }}
                                        transition={{ delay: i >= PREVIEW_COUNT ? (i - PREVIEW_COUNT) * 0.03 : 0, duration: 0.25 }}
                                    >
                                        <span className="hcp-topic-bullet">_</span>
                                        {topic}
                                    </motion.li>
                                ))}
                            </AnimatePresence>
                        </ul>

                        {topicsExpanded && (
                            <motion.p
                                className="hcp-topics-more"
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                transition={{ delay: 0.3 }}
                            >
                                + Y muchos más, que se irán incorporando de acuerdo con las necesidades del mercado.
                            </motion.p>
                        )}

                        <button
                            className="hcp-toggle"
                            onClick={() => setTopicsExpanded(!topicsExpanded)}
                        >
                            {topicsExpanded
                                ? "MOSTRAR MENOS ↑"
                                : `VER TODOS (${TOPICS.length}) ↓`
                            }
                        </button>
                    </div>
                </div>
            </section>

        </main>
    );
};

export default CursosParams;

/* import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useNavigate } from "react-router-dom"; 
import "./cursoParam.css";

// Assets
import img1 from "../assets/soc-photo1.jpg"; 
import { UseTheme } from "../contexts/ThemeContext";
import { UseWidth } from "../contexts/WidthContext";
import LiveTypingText from "../ui/LiveTypingText";

const TOPICS = [
    "Fundamentos de Ciberseguridad",
    "Redes y Protocolos",
    "Sistemas Operativos (Windows y Linux)",
    "Análisis de Logs",
    "Malware y Amenazas",
    "MITRE ATT&CK",
    "SIEM",
    "EDR/XDR",
    "Threat Intelligence",
    "Introducción al Pentesting",
    "OSINT",
    "Python para Ciberseguridad",
    "PowerShell",
    "Active Directory",
    "Cloud Security",
    "Seguridad Web",
    "Gestión de Incidentes",
    "Ingeniería Social",
    "Seguridad en Identidades",
    "Inteligencia Artificial aplicada a Ciberseguridad",
];

const PREVIEW_COUNT = 8;

const CursosParams = () => {
    const { theme } = UseTheme();
    const { width } = UseWidth();
    const navigate = useNavigate();
    const [expanded, setExpanded] = useState<number | null>(0);
    const [topicsExpanded, setTopicsExpanded] = useState(false);
    const isMobile = width <= 768;

    useEffect(() => {
        window.scrollTo(0, 0);
    }, []);

    const sectors = [
        { id: "01", title: "MODERN SOC OPERATIONS", sub: "La formación integral para el SOC moderno", desc: "Desarrollá las habilidades técnicas, operativas y analíticas que hoy demandan los Centros de Operaciones de Seguridad. Aprendé a investigar alertas, correlacionar eventos, responder incidentes y trabajar junto a herramientas de automatización e inteligencia artificial en escenarios inspirados en situaciones reales.", img: img1, code: "SEC_OPS_01" },
        { id: "02", title: "THREAT HUNTING", sub: "Búsqueda proactiva de amenazas", desc: "Aprendé a detectar amenazas que logran evadir los mecanismos tradicionales de seguridad. Desarrollá hipótesis de hunting, analizá telemetría, correlacioná eventos y descubrí actividad maliciosa antes de que genere un incidente.", img: img1, code: "EN DESARROLLO - PROXIMAMENTE" },
        { id: "03", title: "INCIDENT RESPONSE", sub: "Gestión técnica de incidentes", desc: "Conocé el ciclo completo de respuesta ante incidentes de seguridad. Aprendé a contener, investigar, documentar y colaborar en la recuperación de entornos comprometidos siguiendo metodologías utilizadas por equipos de respuesta profesionales.", img: img1, code: "EN DESARROLLO - PROXIMAMENTE" },
        { id: "04", title: "THREAT INTELLIGENCE", sub: "Comprender al adversario", desc: "Analizá actores de amenazas, campañas, TTPs e indicadores de compromiso para transformar información en inteligencia accionable. Aprendé a contextualizar riesgos y fortalecer la detección y la toma de decisiones.", img: img1, code: "EN DESARROLLO - PROXIMAMENTE" },
        { id: "05", title: "PENTESTING", sub: "Seguridad ofensiva", desc: "Comprendé cómo piensan y trabajan los atacantes mediante pruebas de penetración controladas. Aprendé reconocimiento, identificación de vulnerabilidades, explotación básica y elaboración de recomendaciones para fortalecer la postura de seguridad.", img: img1, code: "EN DESARROLLO - PROXIMAMENTE" },
        { id: "06", title: "GRC", sub: "Gobierno, Riesgo y Cumplimiento", desc: "Desarrollá una visión estratégica de la ciberseguridad. Aprendé a gestionar riesgos, implementar controles, comprender marcos normativos y colaborar con las áreas de negocio para fortalecer la seguridad de la organización.", img: img1, code: "EN DESARROLLO - PROXIMAMENTE" },
    ];

    const handleExpand = (i: number) => {
        setExpanded(expanded === i ? i : i);
    };

    const visibleTopics = topicsExpanded ? TOPICS : TOPICS.slice(0, PREVIEW_COUNT);

    return (
        <main className={`h-tactic-root ${theme}`}>

            <header className="h-tactic-header">
                <div className="h-header-top-block">
                    <motion.div className="h-tactic-intro" initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.8 }}>
                        <span className="h-label-mono">// HABILIDADES - 2026</span>
                        <div className="h-title-logo-flex">
                            <h1 className="h-massive-title Montserrat-900">
                                NUESTROS <span className="h-outline">CURSOS</span>
                            </h1>
                            <img className='hidden-logo-cursos' src="/logos/logo-hidden-final.png" alt="hidden-logo" />
                        </div>
                        <span className="h-label-mono">Aprendé las habilidades que demanda la industria.</span>    
                        <div className="h-intro-p">
                            <LiveTypingText text="Aprendé las habilidades que demanda la industria. Nuestros cursos están diseñados para desarrollar conocimientos técnicos y operativos basados en escenarios reales, preparándote para enfrentar desafíos del mundo laboral y, cuando corresponda, rendir nuestras certificaciones." />
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
                                onClick={() => !isMobile && handleExpand(i)}
                                onPointerUp={() => isMobile && handleExpand(i)}
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
                                                <span className="h-label-mono">{p.sub}</span>
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

            <motion.section
                className="h-more-section"
                initial={{ opacity: 0, y: 40 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-80px" }}
                transition={{ duration: 0.8, ease: [0.19, 1, 0.22, 1] }}
            >

                <div className="h-more-eyebrow">
                    <span className="h-label-mono">// CONTENIDO_ESPECÍFICO</span>
                    <div className="h-more-divider" />
                </div>


                <div className="h-more-body">
                    <div className="h-more-left">
                        <h2 className="h-more-title">
                            Y mucho<br />
                            <span className="h-more-title-accent">más_</span>
                        </h2>
                        <p className="h-more-desc">
                            Además de nuestros programas orientados a roles, Hidden Security ofrecerá cursos específicos para desarrollar habilidades técnicas puntuales que complementen tu crecimiento profesional.
                        </p>
                        <p className="h-more-desc">
                            Desde fundamentos para quienes recién comienzan hasta contenidos especializados para profundizar conocimientos en distintas áreas de la ciberseguridad.
                        </p>
                        <p className="h-more-subdesc">
                            Algunos de los temas que iremos incorporando incluyen:
                        </p>
                    </div>

    
                    <div className="h-more-right">
                        <div className="h-topics-grid">
                            <AnimatePresence>
                                {visibleTopics.map((topic, i) => (
                                    <motion.span
                                        key={topic}
                                        className="h-topic-tag"
                                        initial={{ opacity: 0, y: 10 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        exit={{ opacity: 0, y: -10 }}
                                        transition={{ delay: i * 0.03, duration: 0.3 }}
                                    >
                                        <span className="h-topic-bullet">▸</span>
                                        {topic}
                                    </motion.span>
                                ))}
                            </AnimatePresence>

            
                            {topicsExpanded && (
                                <motion.span
                                    className="h-topic-tag h-topic-tag--more"
                                    initial={{ opacity: 0, y: 10 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    transition={{ delay: TOPICS.length * 0.03 }}
                                >
                                    <span className="h-topic-bullet">+</span>
                                    Y muchos más, que se irán incorporando de acuerdo con las necesidades del mercado.
                                </motion.span>
                            )}
                        </div>

        
                        <button
                            className="h-topics-toggle"
                            onClick={() => setTopicsExpanded(!topicsExpanded)}
                        >
                            {topicsExpanded
                                ? "MOSTRAR MENOS ↑"
                                : `VER TODOS (${TOPICS.length}) ↓`
                            }
                        </button>
                    </div>
                </div>
            </motion.section>

        </main>
    );
};

export default CursosParams; */