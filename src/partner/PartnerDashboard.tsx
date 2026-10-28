import { useEffect, useRef, useState } from "react";
import axios from "axios";
import { UseSession } from "../contexts/SessionContext";
import { UseTheme } from "../contexts/ThemeContext";
import Loader from "../loader/Loader";
import "./partnerDashboard.css";

// "checking" → esperando al servidor · "ok" → partner real
// "threat"   → el servidor detectó que NO es partner (incidente registrado + ban)
// "denied"   → sin sesión válida o error de red: no se muestra nada
type AccessStatus = "checking" | "ok" | "threat" | "denied";

const PartnerDashboard = () => {
    const { user }  = UseSession();
    const { theme } = UseTheme();

    // ── Verificación de acceso contra el servidor ─────────────────────────────
    // El panel NO se renderiza ni pide datos hasta que el servidor confirme
    // con el token firmado que la cuenta es partner. El user del contexto se
    // puede falsear con un proxy (Burp).
    const [access, setAccess]         = useState<AccessStatus>("checking");
    const [incidentId, setIncidentId] = useState<string | null>(null);
    const verifyStartedRef            = useRef(false);

    useEffect(() => {
        // Evita el doble pedido de React StrictMode en desarrollo
        if (verifyStartedRef.current) return;
        verifyStartedRef.current = true;

        axios.post(
            `${import.meta.env.VITE_API_URL}/security/verify-partner-access`,
            { path: window.location.pathname },
            { withCredentials: true, timeout: 10000 }
        )
            .then((res) => {
                setAccess(res.data?.ok === true ? "ok" : "denied");
            })
            .catch((err) => {
                const data = err.response?.data;
                if (data?.code === "SECURITY_THREAT") {
                    setIncidentId(data.incidentId ?? null);
                    setAccess("threat");
                    return;
                }
                setAccess("denied");
            });
    }, []);

    // Cualquier carga de datos del partner va acá, solo con acceso confirmado
    useEffect(() => {
        if (access !== "ok" || !user?.partner) return;
    }, [access, user]);

    // ── Esperando confirmación del servidor: no se muestra nada del panel ─────
    if (access === "checking") return <Loader />;

    // ── Amenaza detectada: el servidor ya registró el incidente y baneó ───────
    // Reutiliza las clases hs-admin / hs-unauthorized (mismas pantallas que
    // AdminDashboard y EnterpriseDashboard)
    if (access === "threat") return (
        <div className={`hs-admin ${theme}`}>
            <div className="hs-unauthorized">
                <span className="hs-mono">// AMENAZA_DE_SEGURIDAD_DETECTADA</span>
                <h1 className="hs-401">403</h1>
                <p>Se detectó un intento de acceso no autorizado al panel de partners.</p>
                <p>El incidente fue registrado con los datos de tu sesión y tu cuenta fue suspendida.</p>
                {incidentId && <span className="hs-mono">// INCIDENTE_ID: {incidentId}</span>}
            </div>
        </div>
    );

    if (access !== "ok") return (
        <div className={`hs-admin ${theme}`}>
            <div className="hs-unauthorized">
                <span className="hs-mono">// ACCESO_DENEGADO</span>
                <h1 className="hs-401">401</h1>
                <p>No autorizado</p>
            </div>
        </div>
    );

    return (
        <div className="partner-dashboard">
            <h1 className="partner-dashboard__title">Partner Dashboard</h1>
        </div>
    );
}

export default PartnerDashboard;