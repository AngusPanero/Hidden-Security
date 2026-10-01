import { createContext, useContext, useEffect, useRef, useState, useCallback, type ReactNode } from "react";
import { auth } from "../firebase/firebase.ts"
import { sendPasswordResetEmail } from "firebase/auth";
import axios from "axios";
import { useNavigate } from "react-router-dom";
import { UseLanguage } from "./LanguageContext.tsx";

const SessionContext = createContext<SessionContextType | null>(null);

interface ProviderProps {
  children: ReactNode;
}

interface SessionContextType {
    handleRegister: (email: string, password: string, loginOpen: any, registerOpen: any) => Promise<void>;
    handleLogin: (email: string, password: string) => Promise<boolean | undefined>;
    handleLogout: () => Promise<void>;
    handleResetPassword: (email: string) => Promise<void>;
    resendVerificationEmail: (email: string) => Promise<void>;
    error: string | boolean | null | number;
    setError: React.Dispatch<React.SetStateAction<string | boolean | null | number>>;
    loading: string | boolean | null | number;
    setLoading: React.Dispatch<React.SetStateAction<string | boolean | null | number>>;
    user: any;
    isAdmin: boolean | null;
    setUser: React.Dispatch<React.SetStateAction<any>>;
    handleUnbanUser: (uid: any) => Promise<void>
    handleBanUser: (email: any) => Promise<void>
    verifyIsAdmin: () => void
    // ── Nuevo estado para email no verificado ─────────────────────────────────
    emailNotVerified: boolean;
    setEmailNotVerified: React.Dispatch<React.SetStateAction<boolean>>;
        // Refresca las custom claims sin cerrar sesión
    refreshClaims: (opts?: { force?: boolean }) => Promise<void>;
}

// Mínimo entre refrescos automáticos — no es un intervalo, no hay polling
const REFRESH_MIN_INTERVAL = 30_000;

export const SessionProvider = ({ children }: ProviderProps) => {
    const navigate = useNavigate()
    const timeRef = useRef<any>(null);
    const { texts, language } = UseLanguage()

    const [ error,            setError ]            = useState<string | boolean | null | number>(false)
    const [ loading,          setLoading ]          = useState<string | boolean | null | number>(false)
    const [ user,             setUser ]             = useState<unknown>(null)
    const [ isAdmin,          setIsAdmin ]          = useState<boolean | null>(null)
    const [ emailNotVerified, setEmailNotVerified ] = useState(false)
        // Refresh de claims — un solo pedido en vuelo + mínimo entre refrescos
    const refreshInFlight = useRef<Promise<void> | null>(null);
    const lastRefreshAt   = useRef(0);
    const userUid: string | null = (user as any)?.uid ?? null;

    // Auto Logout
    useEffect(() => {
        if (!user) return;
        const timeout = 15 * 60 * 1000;
        const resetTimer = () => {
            if (timeRef.current) clearTimeout(timeRef.current);
            timeRef.current = setTimeout(async () => {
                handleLogout()
                setUser(null);
                navigate("/");
            }, timeout);
        };
        resetTimer();
        const events = ["mousemove", "mousedown", "keydown", "scroll", "touchstart"];
        events.forEach((event) => window.addEventListener(event, resetTimer));
        return () => {
            events.forEach((event) => window.removeEventListener(event, resetTimer));
            if (timeRef.current) clearTimeout(timeRef.current);
        };
    }, [user, navigate]);

    // Register
    const handleRegister = async (email: string, password: string, loginOpen: React.Dispatch<React.SetStateAction<boolean>>, registerOpen: React.Dispatch<React.SetStateAction<boolean>>) => {
        try {
            setError(null)
            setLoading(true)
            const response = await axios.post(`${import.meta.env.VITE_API_URL}/register`, { email, password })
            if(response.status === 201){
                setLoading(false)
                registerOpen(false)
                loginOpen(true)
            }
        } catch (error: any) {
            setLoading(false)
            if(error.response?.status === 409){
                setError("EMAIL_YA_REGISTRADO") 
                return
            }
            setError(true)
        }
    }

    // Login
    const handleLogin = async (email: string, password: string) => {
        try {
            setLoading(true);
            setError(null);
            setEmailNotVerified(false);

            const response = await axios.post(
                `${import.meta.env.VITE_API_URL}/login`, 
                { email, password }, 
                { withCredentials: true }
            );

            if (response.status === 200) {
                const { user, isAdmin, isEnterprise, partner } = response.data;
                const mergedUser = { ...user, isEnterprise, admin: isAdmin, partner };
                setUser(mergedUser);

                setLoading(false);

                if (isAdmin) {
                    navigate("/admin");
                } else if (isEnterprise === true) { 
                    navigate("/enterprise");                 
                } else if (partner === true) {
                    navigate("/partner");
                } else {
                    navigate("/dashboard");
                }
                return true;
            }

        } catch (error: any) {
            console.log("LOGIN ERROR FAILED", error);
            
            const serverData = error.response?.data;
            const serverCode = serverData?.code;
            const attempts   = serverData?.attempts;

            // ── Email no verificado ────────────────────────────────────────────
            if (serverCode === "auth/email-not-verified") {
                setEmailNotVerified(true);
                setError("Verificá tu email antes de ingresar. Revisá tu casilla de correo.");
                return;
            }

            // ── Email no registrado ────────────────────────────────────────────
            if (serverCode === "auth/user-not-found" || error.response?.status === 404) {
                setError("No existe ninguna cuenta registrada con ese email.");
                return;
            }

            if (serverCode === "auth/too-many-attempts" || serverData?.banned) {
                setError(texts[language].sessionErrors.loginTooManyAttempts);
                return;
            }

            if (serverCode === "auth/user-banned") {
                setError(texts[language].sessionErrors.loginBanned);
                return;
            }

            if (serverCode === "auth/invalid-credential" || error.response?.status === 401) {
                if (attempts && attempts < 5) {
                    setError(`${texts[language].sessionErrors.loginAttemptsLeft} ${5 - attempts} ${texts[language].sessionErrors.loginAttemptsLeftAfter}`);
                } else {
                    setError(texts[language].sessionErrors.loginInvalidCredentials);
                }
                return;
            }

            console.error("LOG_CRITICAL // Login failure:", error);
            setError(texts[language].sessionErrors.loginGeneralError);
            
        } finally {
            setLoading(false);
        }
    };

    // ── Reenviar email de verificación ────────────────────────────────────────
    const resendVerificationEmail = async (email: string) => {
        try {
            setLoading(true);
            setError(null);
            await axios.post(`${import.meta.env.VITE_API_URL}/resend-verification`, { email });
            setEmailNotVerified(false);
            alert("Email de verificación reenviado. Revisá tu casilla.");
        } catch (err: any) {
            const msg = err.response?.data?.message || "Error al reenviar el email.";
            setError(msg);
        } finally {
            setLoading(false);
        }
    };
    
    // Logout
    const handleLogout = async () => {
        try {
            setError(false)
            setLoading(true);
            const response = await axios.post(`${import.meta.env.VITE_API_URL}/logout`, { }, { withCredentials: true });
            if (response.status === 200) {
                await auth.signOut()
                setUser(null)
                navigate("/");
            }
        } catch (error: any) {
            setError(texts[language].sessionErrors.logoutError);
            console.error("Error logging out session 🔴", error);
        } finally {
            setLoading(false)
        }
    }

    // Reset Password
    const handleResetPassword = async (email: string) => {
        try {
            if(!email){
                alert(texts[language].sessionErrors.resetEmailRequired);
                return;
            } else {
                await sendPasswordResetEmail(auth, email);
                alert(texts[language].sessionErrors.resetEmailSent);
            }
        } catch (error: any) {
            console.error("Error al enviar el email:", error.code);
            switch (error.code) {
                case "auth/user-not-found":
                    alert(texts[language].sessionErrors.resetUserNotFound);
                    break;
                case "auth/invalid-email":
                    alert(texts[language].sessionErrors.resetInvalidEmail);
                    break;
                case "auth/too-many-requests":
                    alert(texts[language].sessionErrors.resetTooManyRequests);
                    break;
                default:
                    alert("Default Error.");
            }
        }
    }

    const handleBanUser = async (email: string) => {
        const confirmUnban = confirm("¿Estás seguro de que quieres bannear este usuario?");
        if(confirmUnban){
            try {
                setError(false)
                setLoading(true)
                const response = await axios.post(`${import.meta.env.VITE_API_URL}/admin/ban-user`, { email }, { withCredentials: true })
                if(response.status === 200){ navigate("/admin") }
            } catch (error: any) {
                setError(true)
                console.error("Error al bannear usuario! 🔴", error)
            } finally{
                setLoading(false)
            }
        }
    }

    const handleUnbanUser = async (uid: any) => {
        const confirmUnban = confirm("¿Estás seguro de que quieres desbannear este usuario?");
        if(confirmUnban){
            try {
                setError(false)
                setLoading(true)
                const response = await axios.post(`${import.meta.env.VITE_API_URL}/unban-user`, { uid }, { withCredentials: true })
                if(response.status === 200){ navigate("/admin") }
            } catch (error: any) {
                setError(true)
                console.error("Error al desbannear usuario! 🔴", error)
            } finally{
                setLoading(false)
            }
        }
    }

    const verifyIsAdmin = async () => {
        const customClaims = await auth.currentUser?.getIdTokenResult();
        const isAdmin = !!customClaims?.claims.admin;
        if(isAdmin){ setIsAdmin(true) } else { setIsAdmin(false) }
    }

        // ── Carga la sesión desde la cookie (/check-auth) ─────────────────────────
    // silent = true → sin spinner global y, si falla la red, mantiene el usuario.
    // expectedUid → si mientras tanto cambió el usuario, la respuesta se descarta.
    const loadSession = useCallback(async (silent = false, expectedUid: string | null = null) => {
        try {
            if (!silent) setLoading(true);
            const { data } = await axios.get(`${import.meta.env.VITE_API_URL}/check-auth`, { withCredentials: true });
            if (data.authenticated) {
                const freshUser = { ...data.user, isEnterprise: data.isEnterprise, admin: data.isAdmin, partner: data.partner };
                setUser((prev: any) => {
                    if (expectedUid && prev?.uid !== expectedUid) return prev;
                    return freshUser;
                });
            } else {
                setUser(null);
            }
        } catch (error) {
            if (!silent) setUser(null);
            console.error("Error checking session 🔴", error);
        } finally {
            if (!silent) setLoading(false);
        }
    }, []);

    // ── Refresca las claims sin cerrar sesión ─────────────────────────────────
    const refreshClaims = useCallback(async ({ force = false }: { force?: boolean } = {}) => {
        if (!userUid) return;
        if (refreshInFlight.current) return refreshInFlight.current;
        if (!force && Date.now() - lastRefreshAt.current < REFRESH_MIN_INTERVAL) return;

        const uidAtStart = userUid;

        refreshInFlight.current = (async () => {
            try {
                const { data } = await axios.get(
                    `${import.meta.env.VITE_API_URL}/api/refresh-claims`,
                    { withCredentials: true, timeout: 8000 }
                );
                lastRefreshAt.current = Date.now();
                if (data?.ok && data.sessionRefreshed) {
                    await loadSession(true, uidAtStart);
                }
            } catch (err: any) {
                // 401 = sesión vencida o cuenta baneada → se cierra la sesión local
                if (err?.response?.status === 401) setUser(null);
                // Otros errores (red, timeout, 500): se mantiene la sesión actual
            } finally {
                refreshInFlight.current = null;
            }
        })();

        return refreshInFlight.current;
    }, [userUid, loadSession]);

    // Refresh — carga inicial de la sesión al abrir / recargar la página
    useEffect(() => {
        loadSession(false);
    }, [loadSession]);

    // Refresh de claims: al haber sesión y cada vez que se vuelve a la pestaña
    useEffect(() => {
        if (!userUid) return;
        refreshClaims();
        const onVisible = () => {
            if (document.visibilityState === "visible") refreshClaims();
        };
        document.addEventListener("visibilitychange", onVisible);
        return () => document.removeEventListener("visibilitychange", onVisible);
    }, [userUid]); // eslint-disable-line

    return(
        <SessionContext.Provider value={{
            handleRegister, handleLogin, handleLogout, handleResetPassword,
            resendVerificationEmail,
            error, setError, loading, setLoading,
            user, setUser,
            handleUnbanUser, verifyIsAdmin, isAdmin, handleBanUser,
            emailNotVerified, setEmailNotVerified, refreshClaims,
        }}>
            { children }
        </SessionContext.Provider>
    )
}

export const UseSession = () => {
  const context = useContext(SessionContext);
  if (!context) throw new Error("useSession debe ser usado dentro de un SessionProvider");
  return context; 
};