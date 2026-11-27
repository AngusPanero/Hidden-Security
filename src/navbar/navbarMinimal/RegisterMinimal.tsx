import { useEffect, useRef, useState } from "react";
import "./registerMinimal.css";
import eyeClose from "/logos/eye-close.svg";
import eyeOpen from "/logos/eye-open.svg";
import { UseLanguage } from "../../contexts/LanguageContext";
import { UseSession } from "../../contexts/SessionContext";
import { UseTheme } from "../../contexts/ThemeContext";
import Loader from "../../loader/Loader";
import Error from "../../processMessages/Error";

// Rutas de las páginas legales (ajustar si en el router tienen otro path)
const LEGAL_LINKS = {
    cookies: "/policy-cookie",
    privacy: "/policy-privacity",
    terms: "/terms-and-conditions",
};

// Cloudflare Turnstile (anti-bot del registro). La site key es pública por
// diseño; el secreto vive solo en el backend (TURNSTILE_SECRET).
// Sin VITE_TURNSTILE_SITE_KEY (local) el widget no se muestra.
const TURNSTILE_SITE_KEY = import.meta.env.VITE_TURNSTILE_SITE_KEY as string | undefined;
const TURNSTILE_SRC = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";

const RegisterMinimal = ({ openLogin, closeRegister }: any) => {
    const { language, texts } = UseLanguage();  
    const { handleRegister, loading, error } = UseSession();
    const { theme } = UseTheme();
    const registerRef = useRef<HTMLDivElement>(null);

    const [exit, setExit] = useState(false);
    const [registered, setRegistered] = useState(false);
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [password2, setPassword2] = useState("");
    const [passwordError, setPasswordError] = useState<string>("");
    const [showRequirements, setShowRequirements] = useState(false);
    const [visiblePassword, setVisiblePassword] = useState<boolean>(false);
    const [acceptedLegal, setAcceptedLegal] = useState<boolean>(false);
    const [turnstileToken, setTurnstileToken] = useState<string>("");
    const turnstileRef = useRef<HTMLDivElement>(null);

    const handleClose = () => {
        setExit(true);
        setTimeout(closeRegister, 600);
    };

    const passwordRequirements = [
        { label: `${texts[language].register.reqMinChars}`, test: (pass: string) => pass.length >= 10 },
        { label: `${texts[language].register.reqUpper}`, test: (pass: string) => /[A-Z]/.test(pass) },
        { label: `${texts[language].register.reqNumber}`, test: (pass: string) => /\d/.test(pass) },
        { label: `${texts[language].register.reqSpecial}`, test: (pass: string) => /[!@#$%^&*()_+=[\]{};':"\\|,.<>/?`~-]/.test(pass) },
    ];

    const isFormValid =
        email.includes("@") &&
        password.length >= 10 &&
        password === password2 &&
        !passwordError &&
        acceptedLegal &&
        (!TURNSTILE_SITE_KEY || !!turnstileToken);
    
    const validatePassword = (pass: string) => {
        const regex = /^(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*()_+=[\]{};':"\\|,.<>/?`~-]).{10,}$/;
        if (!regex.test(pass)) {
            setPasswordError(`${texts[language].register.passError}`);
            return false;
        }
        setPasswordError("");
        return true;
    };

    useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            if (registerRef.current && !registerRef.current.contains(e.target as Node)) {
                handleClose();
            }
        };
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    // ── Widget de Turnstile: carga el script una sola vez y lo monta en el form.
    // Se vuelve a montar si el form reaparece después del loader.
    useEffect(() => {
        if (!TURNSTILE_SITE_KEY || registered || loading) return;

        let widgetId: string | undefined;
        let cancelled = false;

        const renderWidget = () => {
            const ts = (window as any).turnstile;
            if (cancelled || !ts || !turnstileRef.current || widgetId) return;
            widgetId = ts.render(turnstileRef.current, {
                sitekey: TURNSTILE_SITE_KEY,
                theme: theme === "light" ? "light" : "dark",
                callback: (token: string) => setTurnstileToken(token),
                "expired-callback": () => setTurnstileToken(""),
                "error-callback": () => setTurnstileToken(""),
            });
        };

        let script = document.querySelector<HTMLScriptElement>(`script[src="${TURNSTILE_SRC}"]`);
        if ((window as any).turnstile) {
            renderWidget();
        } else {
            if (!script) {
                script = document.createElement("script");
                script.src = TURNSTILE_SRC;
                script.async = true;
                script.defer = true;
                document.head.appendChild(script);
            }
            script.addEventListener("load", renderWidget);
        }

        return () => {
            cancelled = true;
            script?.removeEventListener("load", renderWidget);
            if (widgetId) {
                try { (window as any).turnstile?.remove(widgetId); } catch { /* el nodo ya no existe */ }
            }
            setTurnstileToken("");
        };
    }, [registered, loading, theme]);

    if(loading) return <Loader />
    // Mensajes concretos del context (límite de intentos, captcha) o el genérico
    if(typeof error === "string" && error) return <Error processMessage={error} />
    if(error) return <Error processMessage={`${texts[language].register.errorRegister}`} />

    return (
        <div className={`k-reg-overlay ${exit ? "k-reg-fade-out" : ""}`}>
            <div 
                ref={registerRef} 
                className={`k-reg-panel ${theme} ${exit ? "k-reg-panel-exit" : ""}`}
            >
                {/* LÍNEA DE ESTADO SUPERIOR */}
                <div className="k-reg-top-bar"></div>

                <div className="k-reg-wrapper">
                    <header className="k-reg-header">
                        <div className="k-reg-meta">
                            <span className="k-reg-tag">CORE // PROVISIONING</span>
                            <div className="k-reg-path">
                                <span className="path-muted">ID</span> / <span className="path-bold">NUEVO_ALUMNO</span>
                            </div>
                        </div>
                        <button className="k-reg-close" onClick={handleClose}>
                            <div className="close-line l1"></div>
                            <div className="close-line l2"></div>
                        </button>
                    </header>

                    <main className="k-reg-main">
                        {registered ? (
                            <div className="k-reg-success">
                                <h2 className="k-reg-title">¡CUENTA CREADA!</h2>
                                <p className="k-reg-success-text">
                                    Te enviamos un email a <strong>{email}</strong> con los pasos para continuar.
                                    Hacé click en el link que te llegue para activar tu cuenta.
                                </p>
                                <p className="k-reg-success-spam">
                                    Si no lo ves en unos minutos, revisá también tu carpeta de SPAM o correo no deseado.
                                </p>
                                <button
                                    type="button"
                                    className="k-reg-submit"
                                    onClick={() => { openLogin(); closeRegister(); }}
                                >
                                    <span className="k-reg-btn-text">IR A INICIAR SESIÓN</span>
                                    <span className="k-reg-btn-icon">→</span>
                                </button>
                            </div>
                        ) : (
                            <>
                                <div className="k-reg-intro">
                                    <h2 className="k-reg-title">NUEVO USUARIO</h2>
                                    <p className="k-reg-sub" onClick={openLogin}>{texts[language].register.footerText}</p>
                                </div>

                                <form className="k-reg-form" onSubmit={(e) => {
                                    e.preventDefault(); 
                                    if (!acceptedLegal) return;
                                    if (!validatePassword(password)) return;
                                    if (TURNSTILE_SITE_KEY && !turnstileToken) return;
                                    handleRegister(
                                        email,
                                        password,
                                        () => setRegistered(true),
                                        () => setRegistered(true),
                                        acceptedLegal,
                                        turnstileToken || undefined
                                    );
                                }}>
                                    
                                    <div className="k-reg-group">
                                        <div className="k-reg-label-row">
                                            <label>EMAIL:</label>
                                            <span className="row-id">01</span>
                                        </div>
                                        <div className="k-reg-input-box">
                                            <input 
                                                type="email" 
                                                value={email} 
                                                onChange={(e) => setEmail(e.target.value)} 
                                                placeholder="email@hidden.com" 
                                                required 
                                                className="auth-input"
                                            />
                                            <div className="box-focus"></div>
                                        </div>
                                    </div>

                                    <div className="k-reg-group">
                                        <div className="k-reg-label-row">
                                            <label>CONTRASEÑA:</label>
                                            <span className="row-id">02</span>
                                        </div>
                                        <div className="k-reg-input-box">
                                            <input 
                                                type={visiblePassword ? "text" : "password"} 
                                                value={password} 
                                                onChange={(e) => setPassword(e.target.value)} 
                                                onFocus={() => setShowRequirements(true)} 
                                                onBlur={() => setShowRequirements(false)} 
                                                placeholder="••••••••"
                                                required 
                                                className="auth-input"
                                            />
                                            <button 
                                                type="button" 
                                                className="k-reg-eye" 
                                                onClick={() => setVisiblePassword(!visiblePassword)}
                                            >
                                                <img src={visiblePassword ? eyeClose : eyeOpen} alt="eye"  width={"20px"}/>
                                            </button>
                                            <div className="box-focus"></div>
                                        </div>
                                        
                                        <div className={`k-reg-req-grid ${showRequirements ? 'active' : ''}`}>
                                            {passwordRequirements.map((req, index) => {
                                                const isMet = req.test(password);
                                                return (
                                                    <div key={index} className={`k-reg-req-item ${isMet ? 'met' : ''}`}>
                                                        <span className="req-icon">{isMet ? "✦" : "✧"}</span>
                                                        <span className="req-text">{req.label}</span>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </div>

                                    <div className="k-reg-group">
                                        <div className="k-reg-label-row">
                                            <label>VERIFICAR CONTRASEÑA:</label>
                                            <span className="row-id">03</span>
                                        </div>
                                        <div className="k-reg-input-box">
                                            <input 
                                                type={visiblePassword ? "text" : "password"} 
                                                value={password2} 
                                                onChange={(e) => setPassword2(e.target.value)} 
                                                placeholder="••••••••"
                                                required 
                                                className="auth-input"
                                            />
                                            <div className="box-focus"></div>
                                        </div>
                                    </div>

                                    {/* ACEPTACIÓN LEGAL */}
                                    <label className="k-reg-legal">
                                        <input
                                            type="checkbox"
                                            className="k-reg-legal-input"
                                            checked={acceptedLegal}
                                            onChange={(e) => setAcceptedLegal(e.target.checked)}
                                            required
                                        />
                                        <span className="k-reg-legal-box" aria-hidden="true">
                                            <svg viewBox="0 0 16 16" width="12" height="12">
                                                <path d="M3 8.5L6.5 12L13 4.5" fill="none" strokeWidth="2.2" strokeLinecap="square" />
                                            </svg>
                                        </span>
                                        <span className="k-reg-legal-text">
                                            Al registrarme acepto la{" "}
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

                                    {/* ANTI-BOT (Cloudflare Turnstile) */}
                                    {TURNSTILE_SITE_KEY && (
                                        <div ref={turnstileRef} className="k-reg-turnstile" />
                                    )}

                                    <div className="k-reg-feedback">
                                        {(password !== password2 && password2 !== "") && <span className="k-reg-error">Las contraseñas no coinciden!</span>}
                                        {passwordError && <span className="k-reg-error">{passwordError}</span>}
                                    </div>

                                    <button type="submit" className="k-reg-submit" disabled={!isFormValid}>
                                        <span className="k-reg-btn-text">REGISTRARSE</span>
                                        <span className="k-reg-btn-icon">→</span>
                                    </button>
                                </form>
                            </>
                        )}
                    </main>
                </div>
            </div>
        </div>
    );
};

export default RegisterMinimal;