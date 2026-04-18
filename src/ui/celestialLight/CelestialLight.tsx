import React from 'react';
import { motion } from 'framer-motion';
import './celestialCursorLight.css';
import { UseTheme } from '../../contexts/ThemeContext';

const CelestialCursorLight: React.FC = () => {
    const { theme } = UseTheme();   

    // Creamos un array de rayos para generar las "ondas"
    const rays = Array.from({ length: 9 });

    return (
        <div className={`k-celestial-container ${theme}`}>
            {/* Rayos de luz tipo escáner */}
            {rays.map((_, i) => (
                <motion.div
                    key={i}
                    className={`k-celestial-ray ray-${i}`}
                    initial={{ rotate: -30 }}
                    animate={{ 
                        rotate: [ -35, 35, -35 ],
                        opacity: [ 0.1, 0.4, 0.1 ] 
                    }}
                    transition={{
                        duration: 7 + i, // Cada rayo tiene una velocidad distinta
                        repeat: Infinity,
                        ease: "easeInOut",
                        delay: i * 0.5 // Desfase para crear el efecto de onda
                    }}
                    style={{ originX: "50%", originY: "0%" }}
                />
            ))}

            {/* Pulso de onda expansiva (opcional, para dar profundidad) */}
            <motion.div 
                className="k-celestial-pulse"
                animate={{ 
                    scale: [1, 1.5],
                    opacity: [0.3, 0] 
                }}
                transition={{
                    duration: 4,
                    repeat: Infinity,
                    ease: "easeOut"
                }}
            />

            <div className="k-celestial-noise"></div>
        </div>
    );
};

export default CelestialCursorLight;