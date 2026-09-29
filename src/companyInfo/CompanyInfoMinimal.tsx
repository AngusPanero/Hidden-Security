import React, { useRef } from 'react';
import { motion } from 'framer-motion';
import "./companyInfoMinimal.css";
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
        { id: "LVL", suffix: "IDENTIDAD PROFESIONAL CYBER", label: "Un perfil especializado para centralizar experiencia, skills, herramientas, formación y certificaciones." },
        { id: "DEC", suffix: "TALENT ↔ COMPANY", label: "Empresas y profesionales dentro de un ecosistema diseñado específicamente para ciberseguridad." },
        { id: "GAP", suffix: "SKILLS", label: "Formación y validación para desarrollar nuevas capacidades y fortalecer el perfil profesional." }
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
                        <source src="https://res.cloudinary.com/dfpomipab/video/upload/v1782857864/minimal-company_knrkl8.mp4" type="video/mp4" />
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
                text1="DE LA ORIENTACIÓN A" 
                text1span='UNA RED PARA CYBER' 
                description='Hidden Security nació acercando conocimiento y orientación a personas interesadas en ciberseguridad. Con el tiempo, detectamos un problema más amplio: talento y oportunidades seguían teniendo dificultades para encontrarse.'
            />

            <section className="k-evolution">
                <span className="k-label">01 // EARLY MILESTONES</span>
                <div className="k-evolution-list">
                    {[
                        { year: "START", title: "CREACIÓN DE CONTENIDO PARA ACERCAR LA CIBERSEGURIDAD A MÁS PERSONAS." },
                        { year: "EXP", title: "INCORPORACIÓN DE EXPERIENCIA TÉCNICA PARA ORIENTAR EL DESARROLLO PROFESIONAL." },
                        { year: "GAP", title: "IDENTIFICACIÓN DE UNA BRECHA ENTRE EL TALENTO EN CIBERSEGURIDAD Y LAS OPORTUNIDADES DE LA INDUSTRIA." }
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
                            <LiveTypingText text="Experiencia, skills, herramientas, certificaciones y formación reunidas en un perfil profesional pensado desde cero para la industria de la ciberseguridad.

Las habilidades pueden ser declaradas por el profesional, desarrolladas mediante formación o respaldadas mediante procesos de validación, aportando distintos niveles de evidencia al perfil." className="k-dna-typing" />
                        </p>
                    </div>
                </div>
            </section>

            <HighPerformanceSection 
                label='// FOCUS: REAL_SKILLS' 
                text1="UN PERFIL QUE EVOLUCIONA" 
                text1span='CON TU CARRERA' 
                description='Nos centramos en cómo las personas analizan, priorizan y toman decisiones en contextos reales de trabajo. Menos teoría, más ejecución operativa.'
            />

            <section className="k-evolution">
                <span className="k-label">02 // OPERATIONAL FOCUS</span>
                <div className="k-evolution-list">
                    {[
                        { year: "VALIDATE", title: "VALIDACIÓN DE HABILIDADES MEDIANTE EVALUACIONES TÉCNICAS Y ESCENARIOS PRÁCTICOS." },
                        { year: "LEARN", title: "FORMACIÓN PARA DESARROLLAR CAPACIDADES Y PREPARARSE PARA NUEVOS DESAFÍOS." },
                        { year: "CONNECT", title: "CONEXIÓN ENTRE PERFILES CYBER Y OPORTUNIDADES PROFESIONALES." }
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
                            <LiveTypingText text="Hidden Security busca construir un espacio donde una carrera en ciberseguridad pueda desarrollarse de punta a punta: crear una identidad profesional, demostrar capacidades, continuar aprendiendo y conectarse con empresas y oportunidades especializadas." className="k-dna-typing" />
                        </p>
                    </div>
                </div>
            </section>

            <HighPerformanceSection 
                label='// TARGET: GLOBAL_REACH' 
                text1="EL ECOSISTEMA PROFESIONAL" 
                text1span='DE CIBERSEGURIDAD' 
                description='Comenzamos en Argentina con una visión regional y global, incorporando progresivamente nuevos roles, especialidades y formas de validar talento.'
            />

            <section className="k-evolution">
                <span className="k-label">03 // STRATEGIC ROADMAP</span>
                <div className="k-evolution-list">
                    {[
                        { year: "CONNECT", title: "CONSOLIDAR UNA COMUNIDAD PROFESIONAL Y UN MERCADO DE TALENTO ESPECIALIZADO EN CIBERSEGURIDAD." },
                        { year: "EXPAND", title: "INCORPORAR NUEVOS ROLES, DOMINIOS, FORMACIONES Y CERTIFICACIONES." },
                        { year: "GLOBAL", title: "ESCALAR EL ECOSISTEMA HACIA LATINOAMÉRICA Y NUEVOS MERCADOS." }
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
                        <span className="k-city">PROFESIONALES</span>
                        <span className="k-coord">Construí tu perfil, desarrollá tus habilidades y conectate con oportunidades.</span>
                    </div>
                    <div className="k-net-item">
                        <span className="k-city">EMPRESAS</span>
                        <span className="k-coord">Descubrí talento especializado y buscá perfiles según las necesidades de tu organización.</span>
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