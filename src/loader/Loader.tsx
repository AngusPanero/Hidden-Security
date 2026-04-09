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
        if (progress < 100) {
            const timer = setTimeout(() => setProgress(prev => prev + 1), 25);
            return () => clearTimeout(timer);
        } else {
            const delay = setTimeout(() => onComplete?.(), 600); 
            return () => clearTimeout(delay);
        }
    }, [progress, onComplete]);

    return (
        <div className={`corporate-loader-overlay ${theme}`}>
            <div className="loader-content">
                <h1 className="loader-logo">
                    Deep<span>Dev</span>
                </h1>
                <div className="loader-track">
                    <div className="loader-bar" style={{ width: `${progress}%` }} />
                </div>
                <div className="loader-info">
                    <span className="loader-status">Cargando experiencia</span>
                    <span className="loader-number">{progress}%</span>
                </div>
            </div>
        </div>
    );
};

export default Loader;