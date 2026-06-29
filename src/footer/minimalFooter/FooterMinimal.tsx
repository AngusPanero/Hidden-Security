import { motion } from 'framer-motion';
import "./footerMinimal.css";
import { UseTheme } from "../../contexts/ThemeContext";
import logo from "/logos/hidden-logo-sf.png"

const FooterMinimal = () => {
    const { theme } = UseTheme();

    return (
        <footer className={`footer-premium-v4 ${theme}`}>
            <div className="footer-container">
                
                {/* SECCIÓN SUPERIOR: EL LLAMADO A LA ACCIÓN */}
                <div className="footer-top-row">
                    <motion.div 
                        initial={{ opacity: 0, y: 40 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        viewport={{ once: true }}
                        transition={{ duration: 0.8 }}
                        className="footer-cta"
                    >
                        <span className="cta-label">¿LISTO PARA ASEGURAR TU FUTURO?</span>
                        <img className='hidden-logo-footer' src={logo} alt="hidden-security-logo" />
                        <a href="mailto:contacto@hidden-security.org" className="cta-email">
                            COMIENZA TU CARRERA
                        </a>
                    </motion.div>
                </div>


                <div className="footer-main-content">
                    {/* COLUMNA 1: BRAND */}
                    <div className="footer-column brand-col">
                        <h2 className="footer-logo-text">HIDDEN SECURITY<span>.</span></h2>
                        <p className="footer-bio">
                            Formación de élite en ciberseguridad. Transformamos entusiastas en profesionales listos para el mercado laboral global con nuestra bolsa de trabajo exclusiva.
                        </p>
                    </div>

                    {/* COLUMNA 2: LINKS */}
                    <div className="footer-column">
                        <h4 className="column-title">ACADEMIA</h4>
                        <nav className="footer-nav">
                            <a href="/cursos">Cursos ONLINE</a>
                            <a href="/bootcamps">Bootcamps</a>
                            <a href="/bolsa-trabajo">Bolsa de Trabajo</a>
                            <a href="/certificaciones">Certificaciones</a>
                        </nav>
                    </div>

                    {/* COLUMNA 3: EXPERTISE */}
                    <div className="footer-column">
                        <h4 className="column-title">ESPECIALIZACIONES</h4>
                        <div className="expertise-grid">
                            <span className="expertise-tag">Ethical Hacking</span>
                            <span className="expertise-tag">Pentesting</span>
                            <span className="expertise-tag">Cyber Defense</span>
                            <span className="expertise-tag">Incident Response</span>
                            <span className="expertise-tag">Cloud Security</span>
                        </div>
                    </div>

                    {/* COLUMNA 4: CONTACTO */}
                    <div className="footer-column">
                        <h4 className="column-title">SOPORTE</h4>
                        <div className="location-item">
                            <span className="city">ADMISIONES</span>
                            <span className="phone">contacto@hidden-security.org</span>
                        </div>
                        <div className="location-item">
                            <span className="city">ALUMNOS</span>
                            <span className="phone">contacto@hidden-security.org</span>
                        </div>
                    </div>
                </div>

                {/* BOTTOM BAR */}
                <div className="footer-legal">
                    <div className="legal-left">
                        <span>© {new Date().getFullYear()} HIDDEN SECURITY</span>
                        <span className="separator">|</span>
                        <span>DEFENDIENDO EL ESPACIO DIGITAL</span>
                        <span className="separator">|</span>
                        <span className="dev-credit">
                            PLATAFORMA DESARROLLADA POR <a href="https://www.deepdev.com.ar" target="_blank" rel="noopener noreferrer">DEEPDEV STUDIO</a>
                        </span>
                    </div>
                    <div className="legal-right">
                        <div className="social-links-minimal">
                            <a href="#">YOUTUBE</a>
                            <a href="#">LINKEDIN</a>
                            <a href="#">INSTAGRAM</a>
                            <a href="#">X</a>
                        </div>
                    </div>
                </div>
            </div>
        </footer>
    );
};

export default FooterMinimal;