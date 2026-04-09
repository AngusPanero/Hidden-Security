import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion"; // Opcional para suavidad
import "./cookiesCube.css"
import { UseTheme } from "../contexts/ThemeContext";

const CookiesCube = () => {
    const [ visible, setVisible ] = useState(false);
    const { theme } = UseTheme();

    useEffect(() => {
        const accepted = localStorage.getItem("cookiesAccepted");
        if (!accepted) {
            const timer = setTimeout(() => setVisible(true), 3000);
            return () => clearTimeout(timer);
        }
    }, []);

    const acceptCookies = () => {
        localStorage.setItem("cookiesAccepted", "true");
        setVisible(false);
    };

    return (
        <AnimatePresence>
            {visible && (
                <div className={`cookie-full-overlay ${theme}`}>
                    <motion.div 
                        initial={{ opacity: 0, scale: 0.9, y: 20 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.9 }}
                        className="cookie-banner-central"
                    >
                        <div className="cookie-content">
                            <span className="cookie-icon">🍪</span>
                            <div className="cookie-text-wrapper">
                                <span className="cookie-tag">DATA_CONSENT</span>
                                <p>
                                    Usamos cookies para que tu experiencia en <strong>Deep Dev</strong> sea de alto nivel.
                                    <Link to="/policy">Ver protocolo</Link>
                                </p>
                            </div>
                        </div>
                        <button className="cookie-btn" onClick={acceptCookies}>
                            ACEPTAR_TODO
                        </button>
                    </motion.div>
                </div>
            )}
        </AnimatePresence>
    );
};

export default CookiesCube;