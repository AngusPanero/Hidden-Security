import React, { useEffect } from 'react';
import { useParams, Navigate } from 'react-router-dom';
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
        link.href = "/pdf/curso-soc.pdf";
        link.download = data.pdfName;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    return (
        <main className={`hidden-courses-root ${theme}`}>
            <div className="h-container">

                {/* ── 01 HERO ── */}
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
                            <source src="https://res.cloudinary.com/dfpomipab/video/upload/v1782857862/video-curso_jqxafe.mp4#t=0.001" type="video/mp4" />
                            Your browser does not support the video tag.
                        </video>
                        <div className="h-video-decorator" />
                    </div>
                </section>

                {/* ── 02 PÚBLICO Y HABILIDADES ── */}
                <section className="h-node-content">
                    <div className="h-content-grid">
                        <div className="h-content-main">
                            <span className="h-label-mono">02 // CURRICULUM_OVERVIEW</span>

                            {/* Público objetivo */}
                            <div className="h-audience-block">
                                <h3 className="h-sub Montserrat-900">PÚBLICO OBJETIVO</h3>
                                <p className="h-p-text">{data.audience}</p>
                            </div>

                            {/* Objetivo general */}
                            <div className="h-audience-block">
                                <h3 className="h-sub Montserrat-900">OBJETIVO GENERAL</h3>
                                <p className="h-p-text">{data.objective}</p>
                            </div>

                            {/* Habilidades */}
                            <h2 className="h-section-title Montserrat-900">{data.skillsTitle}</h2>
                            <p className="h-p-text">{data.skillsDesc}</p>

                            {/* Módulos */}
                            <div className="h-cronograma">
                                <h3 className="h-sub Montserrat-900">CONTENIDO DEL PROGRAMA</h3>
                                <div className="h-modules-list">
                                    {data.modules.map((mod) => (
                                        <div key={mod.number} className="h-module-item">
                                            <span className="h-module-num">{mod.number !== "—" ? `MÓDULO ${mod.number}` : "—"}</span>
                                            <div className="h-module-body">
                                                <span className="h-module-title">{mod.title}</span>
                                                <p className="h-module-desc">{mod.desc}</p>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            <button onClick={handleDownloadPDF} className="h-pdf-btn">
                                DESCARGAR_PROGRAMA_PDF [↓]
                            </button>
                        </div>
                    </div>
                </section>

                {/* ── 03 SALIDA LABORAL ── */}
                <section className="h-node-career">
                    <div className="h-career-card">
                        <div className="h-career-header">
                            <span className="h-label-mono">03 // PROFESSIONAL_OUTLOOK</span>
                            <h2 className="h-section-title Montserrat-900">TU CAMINO PROFESIONAL</h2>
                            <p className="h-p-text">{data.careerIntro}</p>
                            <p className="h-sub Montserrat-900" style={{ marginTop: "2rem" }}>POSIBLES CAMINOS PROFESIONALES</p>
                        </div>
                        <div className="h-roles-grid">
                            {data.roles.map((role, idx) => (
                                <div key={idx} className="h-role-item">{role}</div>
                            ))}
                        </div>
                    </div>

                    <div className="h-bolsa-trabajo">
                        <div className="h-bolsa-text">
                            <h2 className="Montserrat-900">
                                <span className="h-accent-text">{data.certTitle}</span>
                            </h2>
                            <p className="h-p-text">{data.certDesc}</p>
                        </div>
                    </div>
                </section>

            </div>
        </main>
    );
};

export default Courses;