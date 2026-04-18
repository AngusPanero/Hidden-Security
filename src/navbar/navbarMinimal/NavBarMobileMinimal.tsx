import { forwardRef } from "react";
import moon from "/logos/moon2.svg";
import sun from "/logos/sun.svg";
import { UseSession } from "../../contexts/SessionContext";
import "./navBarMobileMinimal.css";

const NavBarMobileMinimal = forwardRef(({ closeMenu, /* texts, language, */ theme, handleTheme, /* handleLanguage, */ openLogin }: any, ref: any) => {
    const { user, handleLogout } = UseSession();

    // Lógica para Round Morph
    const toggleThemeWithAnimation = (e: React.MouseEvent<HTMLButtonElement>) => {
        const x = e.clientX;
        const y = e.clientY;
        
        document.documentElement.style.setProperty('--x', `${x}px`);
        document.documentElement.style.setProperty('--y', `${y}px`);

        if (!document.startViewTransition) {
            handleTheme();
            return;
        }

        document.startViewTransition(() => {
            handleTheme();
        });
    };

    return (
        <div className={`kaleida-mobile-overlay ${theme}`} ref={ref}>
            <div className="kaleida-mobile-header">
                <div className="header-meta">
                    <span className="meta-tag">NAVIGATION</span>
                </div>
                <button className="kaleida-close-trigger" onClick={closeMenu} aria-label="Close menu">
                    <span className="close-line"></span>
                    <span className="close-line"></span>
                </button>
            </div>

            <nav className="kaleida-mobile-nav">
                {[
                    { label: "Inicio", href: "/", index: "01" },
                    { label: "Cursos", href: "/courses-info", index: "02" },
                    { label: "Empresa", href: "/company", index: "03" },
                    { label: "Precios", href: "/pricing", index: "04" },
                    /* { label: "Sorteos", href: "/raffles", index: "04" }, */
                    { label: "Contacto", href: "/contact", index: "05" }
                ].map((item, idx) => (
                    <a key={idx} href={item.href} className="kaleida-mobile-item" onClick={closeMenu}>
                        <span className="item-index">{item.index}</span>
                        <span className="item-label">{item.label}</span>
                    </a>
                ))}
                
                {user && (
                    <a href="/dashboard" onClick={closeMenu} className="kaleida-mobile-item special">
                        <span className="item-index">06</span>
                        <span className="item-label">DASHBOARD</span>
                    </a>
                )}
            </nav>

            <div className="kaleida-mobile-footer">
                <div className="footer-controls">
                    {/* <div className="kaleida-lang-wrap">
                        <select value={language} onChange={(e) => handleLanguage(e.target.value)}>
                            <option value="es">ES</option> 
                            <option value="en">EN</option>
                        </select>
                    </div> */}
                    
                    <button className="kaleida-theme-toggle" onClick={toggleThemeWithAnimation}>
                        <img src={theme === "dark" ? sun : moon} alt="theme icon" />
                    </button>
                </div>

                <div className="kaleida-auth-box">
                    {user ? (
                        <button onClick={() => { handleLogout(); closeMenu(); }} className="btn-mobile-auth">
                            LOGOUT
                        </button>
                    ) : (
                        <button onClick={() => { openLogin(); closeMenu(); }} className="btn-mobile-auth primary">
                            Iniciar Sesión
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
});

export default NavBarMobileMinimal;