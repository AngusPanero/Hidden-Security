import { useEffect, useState, type ReactNode } from "react";
import axios from "axios";
import { UseSession } from "../contexts/SessionContext.js";
import Error from "../processMessages/Error.js";
import Loader from "../loader/Loader.js";

interface PrivateRouteProps {
    children: ReactNode;
    role: "user" | "admin" | "enterprise" | "partner";
}

const getUserRole = (user: any): "user" | "admin" | "enterprise" | "partner" => {
    if (user?.admin === true) return "admin";
    if (user?.isEnterprise === true) return "enterprise";
    if (user?.partner === true) return "partner";
    return "user";
};

// IMPORTANTE: este guard es solo UX. La seguridad real está en el backend:
// todo endpoint admin/enterprise/partner tiene que validar el rol con el token
// verificado en el servidor (adminMiddleware, etc.). Una respuesta HTTP se puede
// modificar con un proxy (Burp), así que el frontend nunca es una barrera.
const PrivateRoute = ({ children, role }: PrivateRouteProps) => {
    const { user, loading } = UseSession();
    const [status, setStatus] = useState<string>("loading");

    useEffect(() => {
        let cancelled = false;
        setStatus("loading");

        if (loading) return;

        if (!user) {
            setStatus("unauth");
            return;
        }

        const verifyAccess = async () => {
            try {
                // El rol se toma SIEMPRE de lo que devuelve el servidor (/me),
                // nunca del user guardado en el contexto (que viene de /login
                // o /check-auth y pudo haber sido manipulado).
                const response = await axios.get(`${import.meta.env.VITE_API_URL}/me`, {
                    withCredentials: true
                });

                if (cancelled) return;

                const serverUser = response.data?.user;
                if (response.status !== 200 || !serverUser?.uid) {
                    setStatus("unauth");
                    return;
                }

                // Si el uid del servidor no coincide con el del contexto, algo está mal
                if (serverUser.uid !== (user as any)?.uid) {
                    setStatus("unauth");
                    return;
                }

                const serverRole = getUserRole(serverUser);
                if (serverRole !== role) {
                    setStatus(`wrong-role-${serverRole}`);
                    return;
                }

                setStatus("ok");
            } catch (error: any) {
                if (cancelled) return;
                if (error.response?.status === 403) {
                    setStatus("banned");
                } else {
                    setStatus("unauth");
                }
            }
        };

        verifyAccess();

        return () => {
            cancelled = true;
        };
    }, [user, loading, role]);

    if (loading || status === "loading") return <Loader />;
    if (status.startsWith("wrong-role")) return <Error processMessage={"Acceso Restringido: No corresponde a tu tipo de cuenta."} />;
    if (status === "banned") return <Error processMessage={"Usuario Baneado, contactate con DeepDev."} />;
    if (status === "unauth" || !user) return <Error processMessage={"No autorizado, por favor inicia sesión."} />;

    return status === "ok" ? <>{children}</> : null;
};

export default PrivateRoute;