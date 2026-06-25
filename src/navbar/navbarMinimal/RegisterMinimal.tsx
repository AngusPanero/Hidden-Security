import { useEffect, useRef, useState } from "react";
import "./registerMinimal.css";
import eyeClose from "/logos/eye-close.svg";
import eyeOpen from "/logos/eye-open.svg";
import { UseLanguage } from "../../contexts/LanguageContext";
import { UseSession } from "../../contexts/SessionContext";
import { UseTheme } from "../../contexts/ThemeContext";
import Loader from "../../loader/Loader";
import Error from "../../processMessages/Error";

const RegisterMinimal = ({ openLogin, closeRegister }: any) => {
    const { language, texts } = UseLanguage();  
    const { handleRegister, loading, error } = UseSession();
    const { theme } = UseTheme();
    const registerRef = useRef<HTMLDivElement>(null);

    const [exit, setExit] = useState(false);
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [password2, setPassword2] = useState("");
    const [passwordError, setPasswordError] = useState<string>("");
    const [showRequirements, setShowRequirements] = useState(false);
    const [visiblePassword, setVisiblePassword] = useState<boolean>(false);

    const handleClose = () => {
        setExit(true);
        setTimeout(closeRegister, 600);
    };

    const passwordRequirements = [
        { label: `${texts[language].register.reqMinChars}`, test: (pass: string) => pass.length >= 10 },
        { label: `${texts[language].register.reqUpper}`, test: (pass: string) => /[A-Z]/.test(pass) },
        { label: `${texts[language].register.reqNumber}`, test: (pass: string) => /\d/.test(pass) },
        { label: `${texts[language].register.reqSpecial}`, test: (pass: string) => /[@$!%*?&]/.test(pass) },
    ];

    const isFormValid = email.includes("@") && password.length >= 10 && password === password2 && !passwordError;
    
    const validatePassword = (pass: string) => {
        const regex = /^(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{10,}$/;
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

    if(loading) return <Loader />
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
                        <div className="k-reg-intro">
                            <h2 className="k-reg-title">NUEVO USUARIO</h2>
                            <p className="k-reg-sub" onClick={openLogin}>{texts[language].register.footerText}</p>
                        </div>

                        <form className="k-reg-form" onSubmit={(e) => {
                            e.preventDefault(); 
                            if (!validatePassword(password)) return; 
                            handleRegister(email, password, openLogin, closeRegister)
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

                            <div className="k-reg-feedback">
                                {(password !== password2 && password2 !== "") && <span className="k-reg-error">Las contraseñas no coinciden!</span>}
                                {passwordError && <span className="k-reg-error">{passwordError}</span>}
                            </div>

                            <button type="submit" className="k-reg-submit" disabled={!isFormValid}>
                                <span className="k-reg-btn-text">REGISTRARSE</span>
                                <span className="k-reg-btn-icon">→</span>
                            </button>
                        </form>
                    </main>
                </div>
            </div>
        </div>
    );
};

export default RegisterMinimal;