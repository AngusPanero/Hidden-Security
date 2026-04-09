import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import "./loaderCube.css"; 
import { UseTheme } from "../../contexts/ThemeContext";

interface LoaderProps {
  onComplete?: () => void;
}

const LoaderCube = ({ onComplete }: LoaderProps) => {
    const { theme } = UseTheme();
    const [progress, setProgress] = useState(0);
    const [isVisible, setIsVisible] = useState(true);

    // Mensajes técnicos dinámicos
    const loadingSteps = [
        "Inicializando núcleos...",
        "Cargando módulos de red...",
        "Sincronizando interfaz...",
        "Optimizando recursos...",
        "Acceso concedido"
    ];

    const currentStep = Math.min(
        Math.floor((progress / 100) * loadingSteps.length),
        loadingSteps.length - 1
    );

    useEffect(() => {
        if (progress < 100) {
            // Velocidad de carga (puedes ajustarla aquí)
            const timer = setTimeout(() => setProgress(prev => prev + 1), 30);
            return () => clearTimeout(timer);
        } else {
            // Pequeña espera al llegar al 100% para impacto visual
            const delay = setTimeout(() => {
                setIsVisible(false);
                setTimeout(() => onComplete?.(), 30); // Sincronizado con la salida de Framer
            }, 50);
            return () => clearTimeout(delay);
        }
    }, [progress, onComplete]);

    return (
        <AnimatePresence>
            {isVisible && (
                <motion.div 
                    className={`corporate-loader-overlay ${theme}`}
                    initial={{ opacity: 1 }}
                    exit={{ opacity: 0, scale: 1.05 }}
                    transition={{ duration: 0.5, ease: "easeInOut" }}
                >
                    <div className="loader-content">
                        {/* Esquinas decorativas animadas */}
                        <motion.div 
                            className="loader-corner tl"
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                        />
                        <motion.div 
                            className="loader-corner br"
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                        />

                        <header className="loader-header">
                            <h1 className="loader-logo">
                                Deep<span>Dev</span>
                            </h1>
                        </header>

                        <div className="loader-main-container">
                            <div className="loader-track">
                                <motion.div 
                                    className="loader-bar" 
                                    style={{ width: `${progress}%` }}
                                    transition={{ type: "spring", stiffness: 50 }}
                                />
                            </div>

                            <div className="loader-info">
                                <span className="loader-status">
                                    <span className="blink-dot">{">"}</span> {loadingSteps[currentStep]}
                                </span>
                                <span className="loader-number">
                                    {progress.toString().padStart(3, '0')}%
                                </span>
                            </div>
                        </div>
                        
                    </div>
                </motion.div>
            )}
        </AnimatePresence>
    );
};

export default LoaderCube;