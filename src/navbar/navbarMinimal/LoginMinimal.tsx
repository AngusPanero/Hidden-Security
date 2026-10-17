import { useEffect, useRef, useState } from "react";
import "./loginMinimal.css";
import eyeClose from "/logos/eye-close.svg";
import eyeOpen from "/logos/eye-open.svg";
import Loader from "../../loader/Loader";
import { UseTheme } from "../../contexts/ThemeContext";
import { UseSession } from "../../contexts/SessionContext";

interface LoginProps {
  openRegister: () => void;
  closeLogin: () => void;
}

// Rutas de las páginas legales (ajustar si en el router tienen otro path)
const LEGAL_LINKS = {
    cookies: "/policy-cookie",
    privacy: "/policy-privacity",
    terms: "/terms-and-conditions",
};

const LoginMinimal = ({ closeLogin, openRegister }: LoginProps) => {
    const { theme } = UseTheme();
    const {
        handleLogin,
        loading,
        error,
        handleResetPassword,
        emailNotVerified,
        resendVerificationEmail,
        legalRequired,
    } = UseSession();
    const loginRef = useRef<HTMLDivElement>(null);

    const [exit,             setExit]             = useState(false);
    const [email,            setEmail]            = useState("");
    const [password,         setPassword]         = useState("");
    const [visiblePassword,  setVisiblePassword]  = useState<boolean>(false);
    const [resendLoading,    setResendLoading]    = useState(false);
    const [resendSuccess,    setResendSuccess]    = useState(false);
    const [acceptedLegal,    setAcceptedLegal]    = useState(false);

    const handleClose = () => {
        setExit(true);
        setTimeout(() => { closeLogin(); }, 600);
    };

    useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            if (loginRef.current && !loginRef.current.contains(e.target as Node)) {
                handleClose();
            }
        };
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    const loginSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (legalRequired && !acceptedLegal) return;
        const response = await handleLogin(email, password, legalRequired ? acceptedLegal : undefined); 
        if (response) { closeLogin(); }
    };

    const handleResend = async () => {
        if (!email) return;
        setResendLoading(true);
        setResendSuccess(false);
        try {
            await resendVerificationEmail(email);
            setResendSuccess(true);
        } catch {
            // el error ya lo maneja el context
        } finally {
            setResendLoading(false);
        }
    };

    if (loading) return <Loader />;

    return (
        <div className={`kaleida-auth-overlay ${exit ? "overlay-exit" : ""}`}>
            <div 
                ref={loginRef} 
                className={`kaleida-auth-panel ${theme} ${exit ? "panel-exit" : ""}`}
            >
                <div className="auth-edge-line"></div>

                <div className="auth-internal-padding">
                    <header className="auth-header">
                        <div className="auth-brand-meta">
                            <span className="auth-code">HIDDEN_SYSTEM // AUTH</span>
                            <div className="auth-breadcrumb">
                                <span>INDEX</span>
                                <span className="separator">/</span>
                                <span className="active">LOGIN</span>
                            </div>
                        </div>
                        <button className="auth-close-trigger" onClick={handleClose} aria-label="Close">
                            <span className={`close-icon-line ${theme}`}></span>
                            <span className={`close-icon-line ${theme}`}></span>
                        </button>
                    </header>

                    <main className="auth-main">
                        <div className="auth-intro">
                            <h2 className="auth-title">Bienvenido de nuevo</h2>
                            <p className="auth-subtitle">INGRESA TUS CREDENCIALES PARA ACCEDER A TU CUENTA</p>
                        </div>

                        <form className="auth-form" onSubmit={loginSubmit}>
                            <div className="auth-field">
                                <div className="field-label-group">
                                    <label className="auth-label">EMAIL:</label>
                                    <span className="field-index">01</span>
                                </div>
                                <div className="auth-input-wrapper">
                                    <input 
                                        type="email" 
                                        className="auth-input"
                                        placeholder="user@hidden.com"
                                        value={email} 
                                        onChange={(e) => setEmail(e.target.value)} 
                                        required 
                                    />
                                    <div className="input-focus-border"></div>
                                </div>
                            </div>

                            <div className="auth-field">
                                <div className="field-label-group">
                                    <label className="auth-label">CONTRASEÑA:</label>
                                    <span className="field-index">02</span>
                                </div>
                                <div className="auth-input-wrapper">
                                    <input 
                                        type={visiblePassword ? "text" : "password"} 
                                        className="auth-input"
                                        placeholder="••••••••"
                                        value={password} 
                                        onChange={(e) => setPassword(e.target.value)} 
                                        required 
                                    />
                                    <button 
                                        type="button"
                                        className="auth-eye-toggle"
                                        onClick={() => setVisiblePassword(!visiblePassword)}
                                    >
                                        <img src={visiblePassword ? eyeClose : eyeOpen} alt="toggle" width={"20px"}/>
                                    </button>
                                    <div className="input-focus-border"></div>
                                </div>
                                <button 
                                    type="button" 
                                    className={`auth-forgot-link ${theme}`}
                                    onClick={() => handleResetPassword(email)}
                                >
                                    ¿OLVIDASTE TU CONTRASEÑA?
                                </button>
                            </div>

                            {/* ── Aceptación legal (solo si el backend la pide) ── */}
                            {legalRequired && (
                                <div className="auth-legal-block">
                                    <p className="auth-legal-notice">
                                        Actualizamos nuestras condiciones. Para ingresar necesitamos que las aceptes.
                                    </p>
                                    <label className="auth-legal">
                                        <input
                                            type="checkbox"
                                            className="auth-legal-input"
                                            checked={acceptedLegal}
                                            onChange={(e) => setAcceptedLegal(e.target.checked)}
                                        />
                                        <span className="auth-legal-box" aria-hidden="true">
                                            <svg viewBox="0 0 16 16" width="12" height="12">
                                                <path d="M3 8.5L6.5 12L13 4.5" fill="none" strokeWidth="2.2" strokeLinecap="square" />
                                            </svg>
                                        </span>
                                        <span className="auth-legal-text">
                                            Acepto la{" "}
                                            <a
                                                href={LEGAL_LINKS.cookies}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                onClick={(e) => e.stopPropagation()}
                                            >
                                                Política de Cookies
                                            </a>
                                            , la{" "}
                                            <a
                                                href={LEGAL_LINKS.privacy}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                onClick={(e) => e.stopPropagation()}
                                            >
                                                Política de Privacidad
                                            </a>
                                            {" "}y los{" "}
                                            <a
                                                href={LEGAL_LINKS.terms}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                onClick={(e) => e.stopPropagation()}
                                            >
                                                Términos y Condiciones
                                            </a>
                                            {" "}de Hidden Security.
                                        </span>
                                    </label>
                                </div>
                            )}

                            {/* ── Error genérico ── */}
                            {error && !emailNotVerified && (
                                <div className="auth-error-msg">{error}</div>
                            )}

                            {/* ── Banner email no verificado ── */}
                            {emailNotVerified && (
                                <div className="auth-verification-banner">
                                    <span className="auth-verification-icon">✉</span>
                                    <div className="auth-verification-body">
                                        <p className="auth-verification-title">
                                            EMAIL_NO_VERIFICADO
                                        </p>
                                        <p className="auth-verification-text">
                                            Revisá tu casilla de correo y hacé click en el link de activación que te enviamos al registrarte.
                                        </p>
                                        {resendSuccess ? (
                                            <p className="auth-verification-success">
                                                ✓ Email reenviado correctamente.
                                            </p>
                                        ) : (
                                            <button
                                                type="button"
                                                className="auth-resend-btn"
                                                onClick={handleResend}
                                                disabled={resendLoading || !email}
                                            >
                                                {resendLoading ? "ENVIANDO..." : "REENVIAR EMAIL DE VERIFICACIÓN →"}
                                            </button>
                                        )}
                                    </div>
                                </div>
                            )}

                            <button
                                type="submit"
                                className="auth-primary-btn"
                                disabled={legalRequired && !acceptedLegal}
                            >
                                <span className="btn-label">
                                    {legalRequired ? "ACEPTAR E INGRESAR" : "INGRESAR"}
                                </span>
                                <span className="btn-arrow">→</span>
                                <div className="btn-fill"></div>
                            </button>
                        </form>
                    </main>

                    <footer className="auth-footer">
                        <div className="footer-content">
                            <span className="footer-hint">¿ERES NUEVO EN HIDDEN?</span>
                            <button className="auth-secondary-btn" onClick={openRegister}>
                                <span>CREÁ UNA CUENTA</span>
                                <div className="btn-underline"></div>
                            </button>
                        </div>
                    </footer>
                </div>
            </div>
        </div>
    );
};

export default LoginMinimal;