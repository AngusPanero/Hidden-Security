import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import "./processOk.css";
import { UseTheme } from "../contexts/ThemeContext";

interface ProcessProps {
  processMessage: string;
}

const ProcessOk = ({ processMessage }: ProcessProps) => {
    const { theme }  = UseTheme();
    const navigate   = useNavigate();
    const [count, setCount] = useState(5);

    useEffect(() => {
        if (count <= 0) { navigate("/"); return; }
        const timer = setTimeout(() => setCount(c => c - 1), 1000);
        return () => clearTimeout(timer);
    }, [count, navigate]);

    return (
        <div className={`hs-loader-overlay ${theme}`}>
            <div className="loader-bg-grid" />

            <div className="loader-content">
                <div className="loader-header">
                    <span className="tech-tag">TRANSACCIÓN_COMPLETA</span>
                    <span className="terminal-prompt">STATUS: APPROVED</span>
                </div>

                <h1 className="loader-logo Montserrat-900">
                    {processMessage}
                </h1>

                {/* barra 100% fija */}
                <div className="loader-main-track">
                    <div className="loader-progress-fill" style={{ width: "100%" }}>
                        <div className="fill-scanner" />
                    </div>
                </div>

                <div className="loader-footer-info">
                    <div className="status-group">
                        <span className="blink-dot" />
                    
                    </div>
                    <span className="loader-number Montserrat-900">{count}s</span>
                </div>

                {/* mensaje redirect */}
                <p className="processok-redirect">
                    // REDIRIGIENDO_AL_INICIO EN {count} SEGUNDOS
                </p>

                <div className="studio-branding">
                    <p className="Montserrat-700">POWERED BY <span>DEEPDEV STUDIO</span></p>
                </div>
            </div>

            <div className="loader-corner-decor top-left" />
            <div className="loader-corner-decor bottom-right" />
        </div>
    );
};

export default ProcessOk;