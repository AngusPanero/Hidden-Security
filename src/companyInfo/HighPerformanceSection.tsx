import { motion } from "framer-motion";

const HighPerformanceSection = ({ label, text1, text1span, description }:{ label: string, text1: string, text1span: string, description: string }) => {
    return (
        <section className="k-warp-section">
            {/* Bloques de fondo que se expanden */}
            <div className="k-warp-container">
                {[...Array(8)].map((_, i) => (
                    <motion.div
                        key={i}
                        className="k-warp-block"
                        initial={{ scaleX: 1 }}
                        whileInView={{ scaleX: 0 }}
                        viewport={{ once: false, amount: 0.2 }}
                        transition={{ 
                            duration: 0.4, 
                            delay: i * 0.1, 
                            ease: [0.85, 0, 0.15, 1] // Ease de aceleración extrema
                        }}
                    />
                ))}
            </div>

            {/* Contenido que queda al descubierto */}
            <div className="k-warp-content">
                <motion.div 
                    className="k-warp-text-box"
                    initial={{ opacity: 0, letterSpacing: "20px" }}
                    whileInView={{ opacity: 1, letterSpacing: "-2px" }}
                    transition={{ duration: 1.5, ease: "easeOut" }}
                >
                    <span className="k-label">{label}</span>
                    <h2 className="k-warp-title">
                        {text1} <br /> 
                        <span>{text1span}</span>
                    </h2>
                    <p className="k-warp-description">
                        {description}
                    </p>
                </motion.div>
            </div>
        </section>
    );
};

export default HighPerformanceSection;