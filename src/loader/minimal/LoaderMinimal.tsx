import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import "./loaderMinimal.css"; 
import { UseTheme } from "../../contexts/ThemeContext";

interface LoaderProps {
  onComplete?: () => void
};

const LoaderMinimal = ({ onComplete }: LoaderProps) => {
    const { theme } = UseTheme();
    const [progress, setProgress] = useState(0);

    useEffect(() => {
        if (progress < 100) {
            const timer = setTimeout(() => setProgress(prev => prev + 1), 25);
            return () => clearTimeout(timer);
        } else {
            const delay = setTimeout(() => onComplete?.(), 800); 
            return () => clearTimeout(delay);
        }
    }, [progress, onComplete]);

    return (
        <div className={`k-curated-loader ${theme}`}>
            <div className="k-loader-center">
                {/* TÍTULO CON MÁSCARA DE REVELACIÓN */}
                <div className="k-title-box">
                    <motion.h1 
                        initial={{ y: "110%" }}
                        animate={{ y: 0 }}
                        transition={{ duration: 1.5, ease: [0.19, 1, 0.22, 1] }}
                        className="k-brand-main"
                    >
                        DEEP<span className="k-brand-stroke">DEV</span>
                    </motion.h1>
                </div>

                {/* CONTADOR ULTRA MINIMALISTA */}
                <div className="k-progress-wrapper">
                    <div className="k-progress-label">SYSTEM_READY</div>
                    <div className="k-progress-numeric">
                        <span>{progress}</span>
                        <span className="k-percent">%</span>
                    </div>
                </div>
            </div>

            {/* LÍNEA DE CARGA INVISIBLE (Solo un detalle de 1px) */}
            <div className="k-loader-horizon">
                <div 
                    className="k-horizon-fill" 
                    style={{ width: `${progress}%` }} 
                />
            </div>
        </div>
    );
};

export default LoaderMinimal;