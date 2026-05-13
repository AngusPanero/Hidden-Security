import { motion } from "framer-motion";
import { UseTheme } from "../contexts/ThemeContext";
import LiveTypingText from "../ui/LiveTypingText";
import "./contact.css";
import CelestialCursorLight from "../ui/celestialLight/CelestialLight";
import { useState } from "react";
import axios from "axios";
import Loader from "../loader/Loader";
import ProcessOk from "../processMessages/Error";

const Contact = () => {
    const { theme } = UseTheme();
    const [ contact, setContact ] = useState({name: "", surname: "", email: "", tel: "", text:""})
    const [ loading, setLoading ] = useState(false)
    const [ error, setError ] = useState(false)
    const [ process, setProcess ] = useState("")

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(false);
        setLoading(true);

        try {
            const response = await axios.post(`${import.meta.env.VITE_API_URL}/contact`, contact);
            
            if (response.status === 201 || response.status === 200) {
                setProcess("ok");
                setLoading(false);
            }
        } catch (error) {
            setLoading(false);
            setError(true);
            console.error("Error en la operación:", error);
        }
    }

    if(loading) return <Loader />
    if(process === "ok") return <ProcessOk processMessage={"Contacto Enviado Exitosamente."} />

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
                                <input type="text" placeholder="Entry name..." name="name" onChange={(e) => setContact({...contact, name: e.target.value})} required />
                            </div>
                            <div className="input-group">
                                <label className="h-label-mono">APELLIDO:</label>
                                <input type="text" placeholder="Entry surname..." name="surname" onChange={(e) => setContact({...contact, surname: e.target.value})} required />
                            </div>
                        </div>

                        <div className="input-group">
                            <label className="h-label-mono">EMAIL:</label>
                            <input type="email" placeholder="user@domain.com" name="email" onChange={(e) => setContact({...contact, email: e.target.value})} required />
                        </div>

                        <div className="input-group">
                            <label className="h-label-mono">TELÉFONO:</label>
                            <input type="tel" placeholder="+54 9..." name="tel" onChange={(e) => setContact({...contact, tel: e.target.value})}/>
                        </div>

                        <div className="input-group">
                            <label className="h-label-mono">DEJÁ TU MENSAJE:</label>
                            <textarea rows={4} placeholder="Escribe tu consulta técnica aquí..." name="text" onChange={(e) => setContact({...contact, text: e.target.value})}></textarea>
                        </div>

                        <motion.button 
                            whileHover={{ scale: 1.02 }}
                            whileTap={{ scale: 0.98 }}
                            className="h-submit-btn"
                        >
                            {error === true ? "Error al enviar consulta" : "ENVIAR_CONSULTA"}
                        </motion.button>
                    </motion.form>
                </section>
            </div>
        </main>
        </>
    );
};

export default Contact;