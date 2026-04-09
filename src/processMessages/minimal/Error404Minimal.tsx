import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import "./errorMinimal.css"
import { UseTheme } from "../../contexts/ThemeContext";
import { UseSession } from "../../contexts/SessionContext";
import { UseLanguage } from "../../contexts/LanguageContext";

const Error404Minimal = () => {
    const { theme } = UseTheme()
    const { setError } = UseSession()
    const { texts, language } = UseLanguage()
    const navigate = useNavigate();

    useEffect(() => {
        const timer = setTimeout(() => {
            setError(null)
            navigate("/");
        }, 5000);
        return () => clearTimeout(timer);
    }, [navigate, setError]);

    return (
        <main className={`error-container ${theme}`}>
            <section className="error-wrapper">
                {/* MARCA AGUADA SUTIL AL FONDO */}
                <div className="error-bg-watermark">404</div>

                <div className="error-content-box">
                    <motion.div 
                        initial={{ opacity: 0, y: 30 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 1.2, ease: [0.22, 1, 0.36, 1] }}
                    >
                        <header className="error-brand-header">
                            <img 
                                src="/logos/DeepDevLogo.jpg" 
                                alt="logo" 
                                className="error-logo-img" 
                            />
                            <span className="error-division-line" />
                            <span className="error-system-tag">SYSTEM_RECOVERY</span>
                        </header>

                        <h1 className={`error-main-title ${theme}`}>
                            {texts[language].error404.title}
                        </h1>

                        <div className="error-description-group">
                            <p className={`error-subtext ${theme}`}>
                                {texts[language].error404.errorMessage}
                            </p>
                            
                            {/* EL STROKE APLICADO AL TEXTO DE ABAJO O DECORATIVO */}
                            <h2 className="error-stroke-text">
                                NOT_FOUND
                            </h2>
                        </div>
                    </motion.div>
                </div>

                {/* LINEA DE TIEMPO EDITORIAL */}
                <footer className="error-footer-bar">
                    <div className="error-nav-meta">
                        <span>BACK_TO_HOME</span>
                        <div className="error-progress-wrapper">
                            <motion.div 
                                initial={{ width: 0 }}
                                animate={{ width: "100%" }}
                                transition={{ duration: 5, ease: "linear" }}
                                className="error-progress-fill"
                            />
                        </div>
                    </div>
                </footer>
            </section>
        </main>
    );
};

export default Error404Minimal;