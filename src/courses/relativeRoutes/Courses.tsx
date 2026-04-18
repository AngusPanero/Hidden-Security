import React, { useEffect } from 'react';
import { useParams, Navigate } from 'react-router-dom';
import video1 from "../../assets/video-curso.mp4";
import './courses.css';
import { UseTheme } from '../../contexts/ThemeContext';
import LiveTypingText from '../../ui/LiveTypingText';
import { COURSES_DATA } from './CoursesData';

const Courses: React.FC = () => {
    const { theme } = UseTheme();
    const { courseSlug } = useParams();
    
    const data = COURSES_DATA[courseSlug as keyof typeof COURSES_DATA];

    useEffect(() => {
        window.scrollTo(0, 0);
    }, []);

    if (!data) return <Navigate to="/courses-info" />;

    const handleDownloadPDF = () => {
        const link = document.createElement('a');
        link.href = "/pdf/prueba.pdf"; 
        link.download = data.pdfName;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    return (
        <main className={`hidden-courses-root ${theme}`}>
            <div className="h-container">
                <section className="h-node-hero">
                    <div className="h-hero-text">
                        <span className="h-label-mono">{data.label}</span>
                        <h1 className="h-massive-title Montserrat-900">
                            {data.title} <span className="h-outline">{data.subtitle}</span>
                        </h1>
                        <div className="h-intro-box">
                            <LiveTypingText text={data.intro} />
                        </div>
                        
                        <div className="h-quick-stats">
                            <div className="h-stat">
                                <span className="h-stat-num">{data.stats.time}</span>
                                <span className="h-stat-label">CONTENIDO_TOTAL</span>
                            </div>
                            <div className="h-stat">
                                <span className="h-stat-num">{data.stats.modules}</span>
                                <span className="h-stat-label">MÓDULOS_TÉCNICOS</span>
                            </div>
                            <div className="h-stat">
                                <span className="h-stat-num">{data.stats.mode}</span>
                                <span className="h-stat-label">MODALIDAD_VIRTUAL</span>
                            </div>
                        </div>
                    </div>

                    <div className="h-hero-video">
                        <video controls className="h-video-player">
                            <source src={`${video1}#t=0.001`} type="video/mp4" />
                            Your browser does not support the video tag.
                        </video>
                        <div className="h-video-decorator" />
                    </div>
                </section>

                <section className="h-node-content">
                    <div className="h-content-grid">
                        <div className="h-content-main">
                            <span className="h-label-mono">02 // CURRICULUM_OVERVIEW</span>
                            <h2 className="h-section-title Montserrat-900">¿QUÉ VAS A DOMINAR?</h2>
                            <p className="h-p-text">
                                El alumno se sumergirá en un entorno de simulación real, aprendiendo a gestionar SIEM, análisis de tráfico de red, y respuesta forense. La carrera está diseñada para transformar un perfil técnico en un operador de defensa proactivo.
                            </p>
                            
                            <div className="h-cronograma">
                                <h3 className="h-sub Montserrat-900">CRONOGRAMA DE ESTUDIO</h3>
                                <p className="h-p-small" dangerouslySetInnerHTML={{ __html: data.curriculum }} />
                            </div>

                            <button onClick={handleDownloadPDF} className="h-pdf-btn">
                                DESCARGAR_PROGRAMA_PDF [↓]
                            </button>
                        </div>
                    </div>
                </section>

                <section className="h-node-career">
                    <div className="h-career-card">
                        <div className="h-career-header">
                            <span className="h-label-mono">03 // PROFESSIONAL_OUTLOOK</span>
                            <h2 className="h-section-title Montserrat-900">SALIDA LABORAL</h2>
                        </div>
                        <div className="h-roles-grid">
                            {data.roles.map((role, idx) => (
                                <div key={idx} className="h-role-item">{role}</div>
                            ))}
                        </div>
                    </div>

                    <div className="h-bolsa-trabajo">
                        <div className="h-bolsa-text">
                            <h2 className="Montserrat-900">BOLSA DE TRABAJO <span className="h-accent-text">HIDDEN_NETWORK</span></h2>
                            <p className="h-p-text">
                                Al finalizar el programa, tendrás la posibilidad de adquirir el <strong>Examen Final de Certificación</strong>. Al aprobar, accederás automáticamente a nuestra <strong>Bolsa de Trabajo Exclusiva</strong>.
                            </p>
                        </div>
                    </div>
                </section>
            </div>
        </main>
    );
};

export default Courses;