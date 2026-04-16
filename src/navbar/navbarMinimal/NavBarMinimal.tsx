import { useState, useEffect, useRef } from "react";
import "./navBarMinimal.css";
import moon from "/logos/moon2.svg";
import sun from "/logos/sun.svg";
import { UseSession } from "../../contexts/SessionContext";
/* import { UseLanguage } from "../../contexts/LanguageContext"; */
import { UseTheme } from "../../contexts/ThemeContext";
import LoginMinimal from "./LoginMinimal";
import RegisterMinimal from "./RegisterMinimal";
import NavBarMobileMinimal from "./NavBarMobileMinimal";


const NavBarMinimal = () => {
    const [openRegister, setOpenRegister] = useState<boolean>(false);
    const [loginOpen, setLoginOpen] = useState(false);    
    const [showPromo, setShowPromo] = useState(true);
    const [menuOpen, setMenuOpen] = useState(false);

    const lastScrollY = useRef(0);
    const menuRef = useRef<HTMLDivElement>(null);
    const { user, handleLogout } = UseSession();

    /* const { language, handleLanguage, texts } = UseLanguage(); */
    const { theme, handleTheme } = UseTheme();

    // --- LÓGICA ROUND MORPH PROPIA DE ESCRITORIO ---
    const toggleThemeWithAnimation = (e: React.MouseEvent<HTMLButtonElement>) => {
        const x = e.clientX;
        const y = e.clientY;
        
        // Seteamos las variables en el documento para que el CSS las tome
        document.documentElement.style.setProperty('--x', `${x}px`);
        document.documentElement.style.setProperty('--y', `${y}px`);

        if (!document.startViewTransition) {
            handleTheme(theme === "dark" ? "light" : "dark");
            return;
        }

        document.startViewTransition(() => {
            handleTheme(theme === "dark" ? "light" : "dark");
        });
    };

    const openRegisterFromLogin = () => {
        setLoginOpen(false);
        setOpenRegister(true);
    };

    const openLoginFromRegister = () => {
        setLoginOpen(true);
        setOpenRegister(false);
    };

    useEffect(() => {
        const handleClickOutside = (e: any) => {
            if (menuOpen && menuRef.current && !menuRef.current.contains(e.target) && !e.target.closest('.kaleida-hamburger')) {
                setMenuOpen(false);
            }
        };
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, [menuOpen]);

    useEffect(() => {
        const handleScroll = () => {
            const currentScroll = window.scrollY;
            if (currentScroll > lastScrollY.current && currentScroll > 20) {
                setShowPromo(false);
            } else {
                setShowPromo(true); 
            }
            lastScrollY.current = currentScroll;
        };
        window.addEventListener("scroll", handleScroll, { passive: true });
        return () => window.removeEventListener("scroll", handleScroll);
    }, []);

    return (
        <>
        <section className={`kaleida-nav-wrapper ${theme} ${showPromo ? "promo-on" : "promo-off"}`}>
            
            <div className="kaleida-promo-strip">
                <div className="promo-inner">
                    <span className="promo-accent"></span>
                    <p className="promo-text">HIDDEN SECURITY // SECURE INTERFACE</p>
                </div>
            </div>

            <header className="kaleida-header">
                <div className="kaleida-container">
                    
                    <div className="nav-left">
                        <a href="/"><h2 className={`logo-title ${theme}`}>Hidden Security.</h2></a>
                    </div>

                    <nav className="nav-main-desktop">
                        <ul className="nav-list">
                            <li><a href="/courses"><span className="index">01</span> Cursos</a></li>
                            <li><a href="/company"><span className="index">02</span> Empresa</a></li>
                            <li><a href="/raffles"><span className="index">03</span> Sorteos</a></li>
                            <li><a href="/contact"><span className="index">04</span> Contacto</a></li>
                            {user && (
                                <li>
                                    <a href="/dashboard" className="nav-link-special">
                                        <span className="index">05</span> DASHBOARD
                                    </a>
                                </li>
                            )}
                        </ul>   
                    </nav>

                    <div className="nav-right">
                        <div className="interface-controls">
                            
                            {/* Theme Toggle con animación round morph */}
                            <button 
                                className="control-btn theme-toggle" 
                                onClick={toggleThemeWithAnimation}
                                title="Switch Theme"
                            >
                                <img src={theme === "dark" ? sun : moon} alt="theme icon" />
                            </button>
                                
                            {/* <div className="lang-selector-wrap">
                                <select 
                                    className="lang-select-minimal" 
                                    value={language} 
                                    onChange={(e) => handleLanguage(e.target.value)}
                                >
                                    <option value="es">ES</option>
                                    <option value="en">EN</option>
                                </select>
                                <span className="select-arrow"></span>
                            </div> */}

                            <div className="auth-wrap">
                                {user ? (
                                    <button onClick={() => handleLogout()} className="btn-kaleida logout">
                                        Cerar
                                    </button>
                                ) : (
                                    <button onClick={() => setLoginOpen(true)} className="btn-kaleida login">
                                        Iniciar Sesión
                                    </button>
                                )}
                            </div>
                        </div>

                        <button 
                            className={`kaleida-hamburger ${menuOpen ? "open" : ""}`} 
                            onClick={() => setMenuOpen(!menuOpen)}
                            aria-label="Menu"
                        >
                            <div className="hamburger-box">
                                <span className="h-line line-1"></span>
                                <span className="h-line line-2"></span>
                            </div>
                        </button>
                    </div>

                </div>
            </header>

            {menuOpen && (
                <NavBarMobileMinimal
                    ref={menuRef}
                    closeMenu={() => setMenuOpen(false)}
                    /* texts={texts}
                    language={language} */
                    theme={theme}
                    handleTheme={() => handleTheme(theme === "dark" ? "light" : "dark")}
                    /* handleLanguage={handleLanguage} */
                    openLogin={() => setLoginOpen(true)}
                />
            )}
        </section>

        { loginOpen && <LoginMinimal openRegister={openRegisterFromLogin} closeLogin={() => setLoginOpen(false)} /> }
        { openRegister && <RegisterMinimal openLogin={openLoginFromRegister} closeRegister={() => setOpenRegister(false)} /> }   
        </>
    );
}

export default NavBarMinimal;