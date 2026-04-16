import React from 'react';
import { UseTheme } from '../contexts/ThemeContext';
import LiveTypingText from '../ui/LiveTypingText';
import video1 from "../assets/video-curso.mp4"
import posterVideo from "../../public/logos/hidden-logo-sf.png"
import './courses.css';

const Courses: React.FC = () => {
    const { theme } = UseTheme();

    const handleDownloadPDF = () => {
        const link = document.createElement('a');
        link.href = "/pdf/prueba.pdf"; 
        link.download = 'Hidden_Security_SOC_Analyst.pdf';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    return (
        <main className={`hidden-courses-root ${theme}`}>
            <div className="h-container">
                
                {/* --- NODO 01: HERO & VIDEO --- */}
                <section className="h-node-hero">
                    <div className="h-hero-text">
                        <span className="h-label-mono">01 // TRAINING_PROGRAM</span>
                        <h1 className="h-massive-title Montserrat-900">
                            SOC <span className="h-outline">ANALYST.</span>
                        </h1>
                        <div className="h-intro-box">
                            <LiveTypingText text="Formación avanzada en operaciones de seguridad. Domina la detección, análisis y respuesta ante incidentes en infraestructuras críticas." />
                        </div>
                        
                        <div className="h-quick-stats">
                            <div className="h-stat">
                                <span className="h-stat-num">120H</span>
                                <span className="h-stat-label">CONTENIDO_TOTAL</span>
                            </div>
                            <div className="h-stat">
                                <span className="h-stat-num">12</span>
                                <span className="h-stat-label">MÓDULOS_TÉCNICOS</span>
                            </div>
                            <div className="h-stat">
                                <span className="h-stat-num">REMOTE</span>
                                <span className="h-stat-label">MODALIDAD_VIRTUAL</span>
                            </div>
                        </div>
                    </div>

                    <div className="h-hero-video">
                        <video controls className="h-video-player" /* poster={posterVideo} preload='metadata' */>
                            <source src={`${video1}#t=0.001`} type="video/mp4" />
                            Your browser does not support the video tag.
                        </video>
                        <div className="h-video-decorator" />
                    </div>
                </section>

                {/* --- NODO 02: CORE CONTENT --- */}
                <section className="h-node-content">
                    <div className="h-content-grid">
                        <div className="h-content-main">
                            <span className="h-label-mono">02 // CURRICULUM_OVERVIEW</span>
                            <h2 className="h-section-title Montserrat-900">¿QUÉ VAS A DOMINAR?</h2>
                            <p className="h-p-text">
                                El alumno se sumergirá en un entorno de simulación real, aprendiendo a gestionar SIEM, análisis de tráfico de red, y respuesta forense. La carrera está diseñada para transformar un perfil técnico en un operador de defensa proactivo.
                            </p>
                            
                            <div className="h-cronograma">
                                <h3 className="h-sub Montserrat-900">CRONOGRAMA_DE_ESTUDIO</h3>
                                <p className="h-p-small">
                                    Semana 1-3: Fundamentos de Networking y Seguridad Operativa. <br/>
                                    Semana 4-6: Implementación y Monitoreo con SIEM (Splunk/ELK). <br/>
                                    Semana 7-9: Threat Hunting y Análisis de Malware. <br/>
                                    Semana 10-12: Protocolos de Respuesta ante Incidentes y Reporting Senior.
                                </p>
                            </div>

                            <button onClick={handleDownloadPDF} className="h-pdf-btn">
                                DESCARGAR_PROGRAMA_PDF [↓]
                            </button>
                        </div>
                    </div>
                </section>

                {/* --- NODO 03: CARRER & JOB BOARD --- */}
                <section className="h-node-career">
                    <div className="h-career-card">
                        <div className="h-career-header">
                            <span className="h-label-mono">03 // PROFESSIONAL_OUTLOOK</span>
                            <h2 className="h-section-title Montserrat-900">SALIDA LABORAL</h2>
                        </div>
                        <div className="h-roles-grid">
                            <div className="h-role-item">SOC ANALYST L1/L2</div>
                            <div className="h-role-item">INCIDENT RESPONDER</div>
                            <div className="h-role-item">THREAT HUNTER JUNIOR</div>
                            <div className="h-role-item">SECURITY MONITORING ENGINEER</div>
                        </div>
                    </div>

                    <div className="h-bolsa-trabajo">
                        <div className="h-bolsa-text">
                            <h2 className="Montserrat-900">BOLSA DE TRABAJO <span className="h-accent-text">HIDDEN_NET</span></h2>
                            <p className="h-p-text">
                                Al finalizar el programa, tendrás la posibilidad de adquirir el <strong>Examen Final de Certificación</strong>. Al aprobar, accederás automáticamente a nuestra <strong>Bolsa de Trabajo Exclusiva</strong>. 
                                <br/><br/>
                                Crearás un perfil profesional con skills validadas por Hidden Security, conectándote directamente con empresas líderes en Argentina y Latinoamérica que buscan talento certificado.
                            </p>
                        </div>
                    </div>
                </section>
            </div>
        </main>
    );
};

export default Courses;