import axios from "axios";
import { createContext, useContext, useState, type ReactNode } from "react";

// Resultado de pedir los tickets con clave de firma
export type SignedFetchResult =
    | { ok: true }
    | { ok: false; code?: string; message: string };

interface ShoppingContextType {
    purchased: any;
    allTickets: any[];
    error: boolean | string;
    loading: boolean;
    getPurchased: () => Promise<void>;
    getAllTickets: (pin: string) => Promise<SignedFetchResult>;
    clearAllTickets: () => void;
}

const ShoppingContext = createContext<ShoppingContextType | undefined>(undefined);

interface ProviderProps {
    children: ReactNode;
}

export const ShoppingProvider = ({ children }: ProviderProps) => {
    const [purchased,  setPurchased]  = useState("");
    const [allTickets, setAllTickets] = useState<any[]>([]);
    const [error,      setError]      = useState<boolean>(false);
    const [loading,    setLoading]    = useState<boolean>(false);

    const getPurchased = async () => {
        try {
            setError(false);
            setLoading(true);

            const { data } = await axios.get(
                `${import.meta.env.VITE_API_URL}/tickets`,
                { withCredentials: true }
            );
            setPurchased(data);
        } catch (error) {
            setError(true);
            console.error("Error al conseguir tickets! 🔴", error);
        } finally {
            setLoading(false);
        }
    };

    // Requiere la clave de firma: el backend la valida antes de devolver los pagos
    const getAllTickets = async (pin: string): Promise<SignedFetchResult> => {
        try {
            setError(false);
            setLoading(true);

            const { data } = await axios.post(
                `${import.meta.env.VITE_API_URL}/all-tickets`,
                { pin },
                { withCredentials: true }
            );
            setAllTickets(Array.isArray(data) ? data : []);
            return { ok: true };
        } catch (err: any) {
            const code    = err.response?.data?.code;
            const message = err.response?.data?.message || "Error al conseguir los tickets 🔴";

            // Clave mal o bloqueada no es un error de carga: lo maneja el gate
            if (code !== "CLAVE_INCORRECTA" && code !== "CLAVE_BLOQUEADA") {
                setError(true);
                console.error("Error al conseguir todos los tickets! 🔴", err.response?.data || err);
            }
            return { ok: false, code, message };
        } finally {
            setLoading(false);
        }
    };

    // Para que los datos no queden en memoria al salir del panel
    const clearAllTickets = () => setAllTickets([]);

    return (
        <ShoppingContext.Provider value={{ purchased, allTickets, error, loading, getPurchased, getAllTickets, clearAllTickets }}>
            {children}
        </ShoppingContext.Provider>
    );
};

export const UseShopping = () => {
    const context = useContext(ShoppingContext);
    if (!context) {
        throw new Error("UseShopping debe ser usado dentro de un ShoppingProvider");
    }
    return context;
};