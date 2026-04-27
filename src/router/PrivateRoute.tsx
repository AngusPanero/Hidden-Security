/* import { useEffect, useState, type ReactNode } from "react";
import axios from "axios";
import { UseSession } from "../contexts/SessionContext.js";
import Error from "../processMessages/Error.js";
import Loader from "../loader/Loader.js";


interface PrivateRouteProps {
    children: ReactNode;
    adminOnly?: boolean;
}

const PrivateRoute = ({ children, adminOnly = false  }: PrivateRouteProps) => {
    const { user, loading } = UseSession();
    const [status, setStatus] = useState<string>("loading");

    useEffect(() => {
        if (loading) return;

        if (!user) {
            setStatus("unauth");
            return;
        }

        const verifyAccess = async () => {
            try {
                const isAdmin = !!user.admin;

                if (adminOnly && !isAdmin) {
                    setStatus("no-admin");
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
    }, [user, loading, adminOnly]);

    if (loading || status === "loading") {
        return <Loader />;
    }

    if (status === "no-admin") {
        return <Error errorMessage={"Acceso Restringido: Se requieren permisos de Administrador."} />;
    }

    if (status === "banned") {
        return <Error errorMessage={"Usuario Baneado, contactate con DeepDev."} />;
    }

    if (status === "unauth" || !user) {
        return <Error errorMessage={"No autorizado, por favor inicia sesión."} />;
    }

    // Solo si todo está OK, renderizamos los children (el dashboard o la vista protegida)
    return status === "ok" ? <>{children}</> : null;
};

export default PrivateRoute; */

import { useEffect, useState, type ReactNode } from "react";
import axios from "axios";
import { UseSession } from "../contexts/SessionContext.js";
import Error from "../processMessages/Error.js";
import Loader from "../loader/Loader.js";

interface PrivateRouteProps {
    children: ReactNode;
    adminOnly?: boolean;
    enterpriseOnly?: boolean;
}

const PrivateRoute = ({ children, adminOnly = false, enterpriseOnly = false }: PrivateRouteProps) => {
    const { user, loading } = UseSession();
    const [status, setStatus] = useState<string>("loading");

    useEffect(() => {
        setStatus("loading"); 

        if (loading) return;

        if (!user) {
            setStatus("unauth");
            return;
        }
        /* console.log("ADMIN:", !!user.admin, "| ENTERPRISE:", !!user.isEnterprise, "| enterpriseOnly:", enterpriseOnly); */
        const verifyAccess = async () => {
            try {
                const isAdmin = !!user.admin;
                const isEnterprise = !!user.isEnterprise;

                if (adminOnly && !isAdmin) {
                    setStatus("no-admin");
                    return;
                }

                if (enterpriseOnly && !isEnterprise) {
                    setStatus("no-enterprise");
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
    }, [user, loading, adminOnly, enterpriseOnly]);

    if (loading || status === "loading") return <Loader />;
    if (status === "no-admin") return <Error errorMessage={"Acceso Restringido: Se requieren permisos de Administrador."} />;
    if (status === "no-enterprise") return <Error errorMessage={"Acceso Restringido: Se requiere una cuenta Empresa."} />;
    if (status === "banned") return <Error errorMessage={"Usuario Baneado, contactate con DeepDev."} />;
    if (status === "unauth" || !user) return <Error errorMessage={"No autorizado, por favor inicia sesión."} />;

    return status === "ok" ? <>{children}</> : null;
};

export default PrivateRoute;