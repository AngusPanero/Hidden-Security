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

const PrivateRoute = ({ children, role }: PrivateRouteProps) => {
    const { user, loading } = UseSession();
    const [status, setStatus] = useState<string>("loading");

    useEffect(() => {
        setStatus("loading");

        if (loading) return;

        if (!user) {
            setStatus("unauth");
            return;
        }

        const verifyAccess = async () => {
            try {
                const actualRole = getUserRole(user);

                if (actualRole !== role) {
                    setStatus(`wrong-role-${actualRole}`);
                    return;
                }

                const response = await axios.get(`${import.meta.env.VITE_API_URL}/me`, {
                    withCredentials: true
                });

                if (response.status === 200) {
                    setStatus("ok");
                }
            } catch (error: any) {
                if (error.response?.status === 403) {
                    setStatus("banned");
                } else {
                    setStatus("unauth");
                }
            }
        };

        verifyAccess();
    }, [user, loading, role]);

    if (loading || status === "loading") return <Loader />;
    if (status.startsWith("wrong-role")) return <Error processMessage={"Acceso Restringido: No corresponde a tu tipo de cuenta."} />;
    if (status === "banned") return <Error processMessage={"Usuario Baneado, contactate con DeepDev."} />;
    if (status === "unauth" || !user) return <Error processMessage={"No autorizado, por favor inicia sesión."} />;

    return status === "ok" ? <>{children}</> : null;
};

export default PrivateRoute;