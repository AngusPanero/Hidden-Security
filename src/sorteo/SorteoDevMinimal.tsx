import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import axios from 'axios';
import './sorteoDevMinimal.css';
import { UseTheme } from '../contexts/ThemeContext';
import LiveTypingText from '../ui/LiveTypingText';
import Error from '../processMessages/Error';
import LoaderMinimal from '../loader/minimal/LoaderMinimal';
import logoHidden from "/logos/hidden-logo-sf.png"

const SorteoDevMinimal: React.FC = () => {
    const { theme } = UseTheme();
    const [status, setStatus] = useState<string>('');
    const [user, setUser] = useState({ fullName: '', email: '', telefono: '', description: '' });
    const [check, setCheck] = useState(false);
    const [timeLeft, setTimeLeft] = useState({ days: 0, hours: 0, minutes: 0, seconds: 0 });
    const [error, setError] = useState<boolean>(false);
    const [loading, setLoading] = useState<boolean>(false);

    useEffect(() => {
        const target = new Date("2026-05-21T00:00:00").getTime();
        const timer = setInterval(() => {
            const distance = target - Date.now();
            if (distance < 0) clearInterval(timer);
            else {
                setTimeLeft({
                    days: Math.floor(distance / (1000 * 60 * 60 * 24)),
                    hours: Math.floor((distance % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60)),
                    minutes: Math.floor((distance % (1000 * 60 * 60)) / (1000 * 60)),
                    seconds: Math.floor((distance % (1000 * 60)) / 1000),
                });
            }
        }, 1000);
        return () => clearInterval(timer);
    }, []);

    const formatNumber = (num: number) => num.toString().padStart(2, '0');

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!check) return;
        try {
            setLoading(true);
            await axios.post(`${import.meta.env.VITE_API_URL}/raffle`, {
                fullName: user.fullName, email: user.email, phone: user.telefono, description: user.description
            });
            setStatus("success");
        } catch (err: any){ 
            console.error("error al imprimir ticket de sorteo", err)
            setError(true); 
        } finally{ 
            setLoading(false); 
        }
    };

    if (error) return <Error processMessage={"ACCESO_DENEGADO: Error en registro."} />;
    if (loading) return <LoaderMinimal />;

return (
        <main className={`hidden-root ${theme}`}>
            <div className="hidden-container">
                
                {/* --- ACTO 01: BRANDING & HERO --- */}
                <header className="k-acto-header">
                    <motion.img 
                        src={logoHidden}
                        className="k-main-logo"
                        initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                    />
                        {/* RELOJ */}
                        <div className="k-header-info">
                            <span className="k-label-mono">01 // SORTEO_EXCLUSIVO</span>
                            <h1 className="k-title Montserrat-900">
                                BECA <span className="k-outline">SOC ANALYST.</span>
                            </h1>

                            <div className="k-counter-main">
                            <div className="k-unit">
                                <span className="k-num">{formatNumber(timeLeft.days)}</span>
                                <span className="k-unit-label">DÍAS</span>
                            </div>
                            <div className="k-sep">:</div>
                            <div className="k-unit">
                                <span className="k-num">{formatNumber(timeLeft.hours)}</span>
                                <span className="k-unit-label">HORAS</span>
                            </div>
                            <div className="k-sep">:</div>
                            <div className="k-unit">
                                <span className="k-num">{formatNumber(timeLeft.minutes)}</span>
                                <span className="k-unit-label">MIN</span>
                            </div>
                            <div className="k-sep">:</div>
                            <div className="k-unit accent">
                                <span className="k-num">{formatNumber(timeLeft.seconds)}</span>
                                <span className="k-unit-label">SEG</span>
                            </div>
                        </div>
                        
                        <div className="k-intro-container">
                            <LiveTypingText text="Participa en el sorteo para ganar una formación de élite. Es momento de iniciar tu carrera en Ciberseguridad Defensiva junto a los expertos de Hidden Security." />
                        </div>
                    </div>
                </header>

                {/* --- ACTO 02: MANIFEST FORM --- */}
                <section className="k-form-manifest">
                    <AnimatePresence mode="wait">
                        {status === '' ? (
                            <form onSubmit={handleSubmit} className="k-manifest">
                                <div className="k-form-header">
                                    <span className="k-label-mono">02 // REGISTRO_DATOS</span>
                                    <div className="k-manifest-typing">
                                        <LiveTypingText text="Introduce tus credenciales para la validación de infraestructura." />
                                    </div>
                                </div>

                                <div className="k-input-stack">
                                    <div className="k-input-group">
                                        <label>NOMBRE COMPLETO</label>
                                        <input required placeholder="NOMBRE COMPLETO" onChange={e => setUser({...user, fullName: e.target.value})} />
                                    </div>
                                    <div className="k-input-group">
                                        <label>EMAIL</label>
                                        <input required type="email" placeholder="EMAIL@SYSTEM.COM" onChange={e => setUser({...user, email: e.target.value})} />
                                    </div>
                                    <div className="k-input-group">
                                        <label>TELÉFONO</label>
                                        <input required type="tel" placeholder="+XX XXXXXXXX" onChange={e => setUser({...user, telefono: e.target.value})} />
                                    </div>
                                    <div className="k-input-group">
                                        <label>DEJÁ TU MENSAJE</label>
                                        <textarea required rows={1} placeholder="TU MENSAJE..." onChange={e => setUser({...user, description: e.target.value})} />
                                    </div>
                                </div>

                                <footer className="k-form-footer">
                                    <label className="k-custom-check">
                                        <input type="checkbox" checked={check} onChange={(e) => setCheck(e.target.checked)} />
                                        <span className="k-box" />
                                        <span className="k-check-text">ACEPTO LOS TÉRMINOS Y CONDICIONES</span>
                                    </label>
                                    <button type="submit" className={`k-huge-btn ${!check ? 'disabled' : ''}`}>
                                        INDEXAR_CANDIDATO →
                                    </button>
                                </footer>
                            </form>
                        ) : (
                            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="k-success-msg">
                                <h2 className="Montserrat-900">ACCESO_COMPLETO</h2>
                                <p>Tus datos han sido procesados por Hidden Security.</p>
                                <button onClick={() => window.location.reload()} className="k-huge-btn">VOLVER_AL_INICIO</button>
                            </motion.div>
                        )}
                    </AnimatePresence>
                </section>
            </div>
        </main>
    );
};

export default SorteoDevMinimal;