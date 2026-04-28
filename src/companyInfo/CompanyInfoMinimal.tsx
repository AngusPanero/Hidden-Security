import React, { useRef } from 'react';
import { motion } from 'framer-motion';
import "./companyInfoMinimal.css";
import videoMinimal from "../assets/minimal-company.mp4";
import HighPerformanceSection from './HighPerformanceSection';
import { MetricGrid } from './MetricGrid';
import LiveTypingText from '../ui/LiveTypingText';
import { UseTheme } from '../contexts/ThemeContext';
import FloatingTitle from './FloatingTitle';

const CompanyInfo: React.FC = () => {
    const { theme } = UseTheme();
    const containerRef = useRef(null);

    // Acto 1: Métricas de Enfoque (Valores numéricos para el counter)
    const operationalStats = [
        { id: "LVL", value: "1", suffix: "SOC", label: "Nivel de validación operativa inicial enfocado en analistas de seguridad." },
        { id: "DEC", value: "100", suffix: "%", label: "Evaluación basada íntegramente en la toma de decisiones críticas." },
        { id: "GAP", value: "0", suffix: "ERR", label: "Objetivo: eliminar la brecha de error entre el CV y la capacidad real." }
    ];

    // Acto 2: Métricas de Tracción (Valores numéricos para el counter)
    const tractionStats = [
        { id: "REG", value: "1200", suffix: "+", label: "Aspirantes registrados en nuestra plataforma de validación técnica." },
        { id: "QUAL", value: "85", suffix: "QTY", label: "Alumnos que han superado los rigurosos filtros de validación práctica." },
        { id: "EMP", value: "92", suffix: "%", label: "Tasa de empleabilidad directa en perfiles validados." }
    ];

    return (
        <main className={`kaleida-corp-root ${theme}`} ref={containerRef}>
            <div className="kaleida-grid-overlay" />

            {/* --- HERO --- */}
            <section className="k-hero">
                <motion.div className="k-video-wrapper">
                    <video autoPlay muted loop playsInline className="k-video">
                        <source src={videoMinimal} type="video/mp4" />
                    </video>
                    <div className="k-video-mask" />
                </motion.div>
                <div className="k-hero-content">
                    <motion.div initial={{ opacity: 0, y: 50 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 1.5 }}>
                        <h1><FloatingTitle text='HIDDEN HISTORY'/></h1>
                    </motion.div>
                </div>
            </section>

            {/* =========================================
               ACTO 01: EL ORIGEN Y LA CONCIENTIZACIÓN
               ========================================= */}
            <section className="k-dna">
                <div className="k-dna-grid">
                    <div className="k-dna-left"><span className="k-label">01 // GENESIS</span></div>
                    <div className="k-dna-right">
                        <p className="k-dna-text">
                            <LiveTypingText text="Hidden Security nació de una motivación simple: la pasión por la ciberseguridad y la necesidad de aprender más allá del entorno laboral. Iniciamos como un espacio para acercar conceptos técnicos a usuarios comunes y protegerlos de amenazas cotidianas." className="k-dna-typing" />
                        </p>
                    </div>
                </div>
            </section>

            <HighPerformanceSection 
                label='// STATUS: EVOLVING_MISSION' 
                text1="DEL CONTENIDO A" 
                text1span='LA ORIENTACIÓN' 
                description='Lo que comenzó como videos informativos detectó un patrón crítico: una gran incertidumbre sobre cómo iniciar una carrera real en la industria de la seguridad.'
            />

            <section className="k-evolution">
                <span className="k-label">01 // EARLY MILESTONES</span>
                <div className="k-evolution-list">
                    {[
                        { year: "START", title: "Creación de contenido para democratizar el acceso a la ciberseguridad." },
                        { year: "EXP", title: "Incorporación de una mirada técnica para orientar nuevos perfiles." },
                        { year: "GAP", title: "Identificación de la falta de rutas claras para el primer empleo." }
                    ].map((milestone, i) => (
                        <motion.div key={i} className="k-evolution-row" initial={{ x: -20, opacity: 0 }} whileInView={{ x: 0, opacity: 1 }} transition={{ duration: 1, delay: i * 0.1 }} viewport={{ once: true }}>
                            <span className="k-evo-year">{milestone.year}</span>
                            <h4 className="k-evo-title">{milestone.title}</h4>
                            <div className="k-evo-line" />
                        </motion.div>
                    ))}
                </div>
            </section>

            <MetricGrid items={operationalStats} columns={3} />

            {/* =========================================
               ACTO 02: LA METODOLOGÍA Y LA VALIDACIÓN
               ========================================= */}
            <section className="k-dna">
                <div className="k-dna-grid">
                    <div className="k-dna-left"><span className="k-label">02 // METHODOLOGY</span></div>
                    <div className="k-dna-right">
                        <p className="k-dna-text">
                            <LiveTypingText text="Evolucionamos para conectar dos problemas: personas que necesitan una guía clara y empresas que requieren validaciones concretas sobre las capacidades de sus candidatos, más allá de lo que indica un CV." className="k-dna-typing" />
                        </p>
                    </div>
                </div>
            </section>

            <HighPerformanceSection 
                label='// FOCUS: REAL_SKILLS' 
                text1="VALIDACIÓN BASADA EN" 
                text1span='ESCENARIOS PRÁCTICOS' 
                description='Nos centramos en cómo las personas analizan, priorizan y toman decisiones en contextos reales de trabajo. Menos teoría, más ejecución operativa.'
            />

            <section className="k-evolution">
                <span className="k-label">02 // OPERATIONAL FOCUS</span>
                <div className="k-evolution-list">
                    {[
                        { year: "SOC L1", title: "Validación intensiva para el rol con mayor demanda inicial en la industria." },
                        { year: "DECISION", title: "Evaluación de procesos de pensamiento crítico bajo presión operativa." },
                        { year: "BRIDGE", title: "Conexión directa entre el talento validado y las necesidades corporativas." }
                    ].map((milestone, i) => (
                        <motion.div key={i} className="k-evolution-row" initial={{ x: -20, opacity: 0 }} whileInView={{ x: 0, opacity: 1 }} transition={{ duration: 1, delay: i * 0.1 }} viewport={{ once: true }}>
                            <span className="k-evo-year">{milestone.year}</span>
                            <h4 className="k-evo-title">{milestone.title}</h4>
                            <div className="k-evo-line" />
                        </motion.div>
                    ))}
                </div>
            </section>

            <MetricGrid items={tractionStats} columns={3} />

            {/* =========================================
               ACTO 03: EL FUTURO Y EL CAMBIO DE PARADIGMA
               ========================================= */}
            <section className="k-dna">
                <div className="k-dna-grid">
                    <div className="k-dna-left"><span className="k-label">03 // VISION</span></div>
                    <div className="k-dna-right">
                        <p className="k-dna-text">
                            <LiveTypingText text="Hidden Security busca contribuir a un cambio en la forma en que el talento se desarrolla y se evalúa. No somos solo un curso; somos el motor de validación para la próxima generación de especialistas." className="k-dna-typing" />
                        </p>
                    </div>
                </div>
            </section>

            <HighPerformanceSection 
                label='// TARGET: GLOBAL_REACH' 
                text1="REDEFINIENDO EL" 
                text1span='ESTÁNDAR DE LA INDUSTRIA' 
                description='Partimos del SOC, pero nuestra visión se expande hacia dominios estratégicos y operativos complejos, alineados con las necesidades reales de las organizaciones.'
            />

            <section className="k-evolution">
                <span className="k-label">03 // STRATEGIC ROADMAP</span>
                <div className="k-evolution-list">
                    {[
                        { year: "SOC+", title: "Expansión hacia arquitecturas de seguridad y respuesta avanzada." },
                        { year: "VALID", title: "Consolidación como el estándar de oro en validación de habilidades reales." },
                        { year: "GLOBAL", title: "Soberanía digital y desarrollo de talento a escala internacional." }
                    ].map((milestone, i) => (
                        <motion.div key={i} className="k-evolution-row" initial={{ x: -20, opacity: 0 }} whileInView={{ x: 0, opacity: 1 }} transition={{ duration: 1, delay: i * 0.1 }} viewport={{ once: true }}>
                            <span className="k-evo-year">{milestone.year}</span>
                            <h4 className="k-evo-title">{milestone.title}</h4>
                            <div className="k-evo-line" />
                        </motion.div>
                    ))}
                </div>
            </section>

            {/* --- NETWORK --- */}
            <section className="k-network">
                <div className="k-net-wrapper">
                    <div className="k-net-item">
                        <span className="k-city">ALUMNOS</span>
                        <span className="k-coord">Validación técnica y acceso a oportunidades de carrera reales.</span>
                    </div>
                    <div className="k-net-item">
                        <span className="k-city">EMPRESAS</span>
                        <span className="k-coord">Acceso a especialistas probados en escenarios críticos.</span>
                    </div>
                </div>
            </section>

            <footer className="k-footer">
                <motion.a href="/contact" className="k-big-link" whileHover={{ x: -20 }}>
                    CONECTAR TALENTO →
                </motion.a>
            </footer>
        </main>
    );
};

export default CompanyInfo;