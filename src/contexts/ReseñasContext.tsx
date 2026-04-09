import { createContext, useContext, useState, useEffect, type ReactNode } from "react";
import axios from "axios";
import { UseSession } from "./SessionContext";

interface ReseñasItem {
    _id?: string;
    reseña: string;
    rating: number;
    productId: string;
    userEmail: string;
    createdAt?: string;
}

interface ReseñasContextType {
    reseñas: ReseñasItem[];
    loading: boolean;
    error: boolean;
    createProductReview: (reseña: string, rating: number, userEmail: string, productId: string) => Promise<void>;
    fetchReseñas: () => Promise<void>;
}

const ReseñasContext = createContext<ReseñasContextType | null>(null);

export const ReseñasProvider = ({ children }: { children: ReactNode }) => {
    const [ reseñas, setReseñas ] = useState<ReseñasItem[]>([]);
    const [ loading, setLoading ] = useState(false);
    const [error, setError] = useState(false);
    const { user } = UseSession();

    useEffect(() => {
        if (user?.email) {
            fetchReseñas();
        } else {
            setReseñas([]);
        }
    }, [user?.email]);

    const fetchReseñas = async () => {
        try {
            setLoading(true);
            const res = await axios.get(`${import.meta.env.VITE_API_URL}/api/product-reviews`, { withCredentials: true });
            
            if (res.data && Array.isArray(res.data.reviews)) {
                setReseñas(res.data.reviews);
                console.log("RESEÑAS: ", res.data.reviews
            );
            } else {
                setReseñas([]);
            }
        } catch (error) {
            console.error("Error cargando reseñas", error);
            setReseñas([]);
        } finally {
            setLoading(false);
        }
    };

    const createProductReview = async (reseña: string, rating: number, userEmail: string, productId: string) => {
        if (!user) {
            return alert("Debes iniciar sesión para dejar tu reseña de producto!");
        }

        if (rating < 1 || rating > 5) {
            return alert("Debes calificar el producto, ¡elige entre 1 y 5 estrellas!");
        }

        if (reseña.trim().length < 1) {
            return alert("¡Debes escribir una reseña para calificar el producto!");
        }

        const confirmReview = confirm("Al escribir una reseña, será visible tu correo junto a la publicación.");
        
        if (!confirmReview) return;

        try {
            setError(false);
            setLoading(true);

            const reviewData = { reseña, rating, userEmail, productId };

            const response = await axios.post(`${import.meta.env.VITE_API_URL}/api/product/rating`, { reviewData }, { withCredentials: true });

            if (response.status === 201) {
                alert("¡Gracias por dejar tu reseña!");
                await fetchReseñas();
            }

        } catch (error) {
            setError(true);
            console.error("ERROR_REVIEW_POST:", error);
            alert("Hubo un problema al enviar tu reseña.");
        } finally {
            setLoading(false);
        }
    };

    return (
        <ReseñasContext.Provider value={{ reseñas, loading, error, createProductReview, fetchReseñas }}>
            {children}
        </ReseñasContext.Provider>
    );
};

export const UseReseñas = () => {
    const context = useContext(ReseñasContext);
    if (!context) throw new Error("UseReseñas debe ser usado dentro de un ReseñasProvider");
    return context;
};