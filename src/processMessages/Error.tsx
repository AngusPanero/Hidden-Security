import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import "./error.css";
import { UseTheme } from "../contexts/ThemeContext";

interface ProcessOkProps {
    processMessage: string;
}

const ProcessOk = ({ processMessage }: ProcessOkProps) => {
    const { theme } = UseTheme();
    const navigate = useNavigate();

    useEffect(() => {
        const timer = setTimeout(() => {
            navigate("/");
        }, 6000); 
        return () => clearTimeout(timer);
    }, [navigate]);

    return (
        <main className={`success-overlay ${theme}`}>
            <div className="success-grid-bg"></div>
            
            <motion.div 
                className="success-container"
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
            >
                <header className="success-header">
                    <span className="protocol-status">// PROTOCOLO_COMPLETADO</span>
                    <span className="session-id">SID_{Math.random().toString(36).substr(2, 9).toUpperCase()}</span>
                </header>

                {/* <div className="success-visual">
                    <div className="hex-icon">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                            <polyline points="20 6 9 17 4 12"></polyline>
                        </svg>
                    </div>
                    <div className="pulse-ring"></div>
                </div> */}

                <div className="success-body">
                    <h1 className="Montserrat-900 success-title">
                        {processMessage || "Error Desconocido"}
                    </h1>
                    <p className="success-subtitle Montserrat-700">
                        LAS CREDENCIALES HAN SIDO VALIDADAS POR EL NODO CENTRAL.
                    </p>
                </div>

                <div className="success-footer">
                    <div className="redirect-bar">
                        <div className="redirect-fill"></div>
                    </div>
                    <span className="redirect-text">REDIRECCIONANDO_AL_DASHBOARD...</span>
                </div>

                <div className="studio-tag">
                    <p>SYSTEM_BY <span>DEEPDEV STUDIO</span></p>
                </div>
            </motion.div>

            {/* Elementos decorativos HUD */}
            <div className="hs-bracket top-l"></div>
            <div className="hs-bracket bottom-r"></div>
        </main>
    );
};

export default ProcessOk;