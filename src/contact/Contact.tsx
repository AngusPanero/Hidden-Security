import { motion } from "framer-motion";
import { UseTheme } from "../contexts/ThemeContext";
import LiveTypingText from "../ui/LiveTypingText";
import "./contact.css";
import CelestialCursorLight from "../ui/celestialLight/CelestialLight";

const Contact = () => {
    const { theme } = UseTheme();

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        // Lógica para enviar el formulario aquí
        console.log("Consulta enviada");
    };

    return (
        <>
        <CelestialCursorLight />
        <main className={`contact-root ${theme}`}>
            <div className="contact-container">
                {/* LADO IZQUIERDO: Información */}
                <section className="contact-info">
                    <motion.div 
                        initial={{ opacity: 0, x: -30 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ duration: 0.8 }}
                    >
                        <img className='contact-logo' src="/logos/hidden-logo-sf.png" alt="hidden-logo" />
                        <span className="h-label-mono">// CANAL OFICIAL</span>
                        
                        <h1 className="h-massive-title Montserrat-900">
                            CONTACTO <span className="h-outline">DIRECTO HIDDEN</span>
                        </h1>

                       {/*  <a href="https://wa.me/tu_numero_aqui" target="_blank" rel="noopener noreferrer" className="contact-whatsapp-link">
                            <svg 
                                viewBox="0 0 24 24" 
                                fill="none" 
                                stroke="currentColor" 
                                strokeWidth="1.5" 
                                strokeLinecap="round" 
                                strokeLinejoin="round" 
                                className="whatsapp-icon-svg"
                            >
                                <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 1 1-7.6-11.7 8.38 8.38 0 0 1 3.8.9L21 3l-1.5 4.5Z" />
                                <path d="M15.5 13.8c-.5 0-2.5-1.1-2.9-1.3-.4-.2-.7-.3-.9 0-.2.3-.9 1.1-1.1 1.3-.2.2-.4.2-.9 0a5.1 5.1 0 0 1-1.9-1.2 5.6 5.6 0 0 1-1.3-1.6c-.3-.4 0-.4.2-.6l.4-.5c.2-.2.2-.3.3-.5s0-.4-.1-.6c-.1-.2-.9-2.1-1.2-2.8-.3-.7-.6-.6-.9-.6H8.1c-.3 0-.7.1-1 .4a3.1 3.1 0 0 0-1 2.3c0 1.5.7 3 1.7 4.3a9.1 9.1 0 0 0 3.9 3.5c.7.3 1.3.5 1.8.6.7.2 1.4.2 1.9.1.6-.1 1.7-.7 2-1.4.3-.7.3-1.3.2-1.4-.1-.2-.3-.3-.6-.4Z" />
                            </svg>
                            <span className="h-label-mono">WHATSAPP_LINE</span>
                        </a> */}
                        
                        <div className="contact-description">
                            <LiveTypingText text="Establece un enlace seguro con nuestro equipo técnico. Despeja dudas sobre capacitaciones, despliegues corporativos o auditorías de red. Tiempo de respuesta estimado: < 24hs." />
                        </div>

                        <div className="contact-meta-grid">
                            <div className="meta-item">
                                <span className="meta-label">EMAIL_NODE</span>
                                <span className="meta-value">contacto@hidden-security.org</span>
                            </div>
                            <div className="meta-item">
                                <span className="meta-label">LOCATION_IP</span>
                                <span className="meta-value">Remote / Global Node</span>
                            </div>
                            <div className="meta-item">
                                <span className="meta-label">SUPPORT_LEVEL</span>
                                <span className="meta-value">Tier 3 - Advanced</span>
                            </div>
                        </div>

                        
                    </motion.div>
                </section>

                {/* LADO DERECHO: Formulario */}
                <section className="contact-form-wrapper">
                    <motion.form 
                        onSubmit={handleSubmit}
                        className="contact-form"
                        initial={{ opacity: 0, y: 30 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.8, delay: 0.2 }}
                    >
                        <div className="form-grid">
                            <div className="input-group">
                                <label className="h-label-mono">NOMBRE:</label>
                                <input type="text" placeholder="Entry name..." required />
                            </div>
                            <div className="input-group">
                                <label className="h-label-mono">APELLIDO:</label>
                                <input type="text" placeholder="Entry surname..." required />
                            </div>
                        </div>

                        <div className="input-group">
                            <label className="h-label-mono">EMAIL:</label>
                            <input type="email" placeholder="user@domain.com" required />
                        </div>

                        <div className="input-group">
                            <label className="h-label-mono">TELÉFONO:</label>
                            <input type="tel" placeholder="+54 9..." />
                        </div>

                        <div className="input-group">
                            <label className="h-label-mono">DEJÁ TU MENSAJE:</label>
                            <textarea rows={4} placeholder="Escribe tu consulta técnica aquí..."></textarea>
                        </div>

                        <motion.button 
                            whileHover={{ scale: 1.02 }}
                            whileTap={{ scale: 0.98 }}
                            className="h-submit-btn"
                        >
                            ENVIAR_CONSULTA
                        </motion.button>
                    </motion.form>
                </section>
            </div>
        </main>
        </>
    );
};

export default Contact;