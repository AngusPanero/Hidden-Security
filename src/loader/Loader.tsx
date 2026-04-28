import { useState, useEffect } from "react";
import "./loader.css"; 
import { UseTheme } from "../contexts/ThemeContext";

interface LoaderProps {
  onComplete?: () => void
};

const Loader = ({ onComplete }: LoaderProps) => {
    const { theme } = UseTheme();
    const [progress, setProgress] = useState(0);

    useEffect(() => {
        // Velocidad variable para que se sienta más "orgánico/técnico"
        if (progress < 99) {
            const increment = progress > 80 ? 1 : 2;
            const speed = progress > 90 ? 80 : 30;
            const timer = setTimeout(() => setProgress(prev => prev + increment), speed);
            return () => clearTimeout(timer);
        } else {
            const delay = setTimeout(() => onComplete?.(), 800); 
            return () => clearTimeout(delay);
        }
    }, [progress, onComplete]);

    return (
        <div className={`hs-loader-overlay ${theme}`}>
            <div className="loader-bg-grid"></div>
            
            <div className="loader-content">
                <div className="loader-header">
                    <span className="tech-tag">SISTEMA_ACTIVO</span>
                    <span className="terminal-prompt">ID_SESSION: HS-2026</span>
                </div>

                <h1 className="loader-logo Montserrat-900">
                    HIDDEN<span>SECURITY</span>
                </h1>

                <div className="loader-main-track">
                    <div className="loader-progress-fill" style={{ width: `${progress}%` }}>
                        <div className="fill-scanner"></div>
                    </div>
                </div>

                <div className="loader-footer-info">
                    <div className="status-group">
                        <span className="blink-dot"></span>
                        <span className="loader-status Montserrat-800">
                            {progress < 100 ? "DESCRIPTANDO_DATOS..." : "ACCESO_LISTO"}
                        </span>
                    </div>
                    <span className="loader-number Montserrat-900">{progress}%</span>
                </div>

                <div className="studio-branding">
                    <p className="Montserrat-700">POWERED BY <span>DEEPDEV STUDIO</span></p>
                </div>
            </div>

            <div className="loader-corner-decor top-left"></div>
            <div className="loader-corner-decor bottom-right"></div>
        </div>
    );
};

export default Loader;