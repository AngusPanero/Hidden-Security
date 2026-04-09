import { createContext, useContext, useState, useEffect, type ReactNode } from "react";
import axios from "axios";
import { UseSession } from "./SessionContext";

interface FavoriteItem {
    _id: string;
    nombre: string;
    userEmail: string;
    productId: string; 
}

interface FavoritesContextType {
    favorites: FavoriteItem[];
    isFavorite: (productId: string) => boolean;
    toggleFavorite: (productId: string, nombre: string) => Promise<void>;
    loadingFavs: boolean;
}

const FavoritesContext = createContext<FavoritesContextType | null>(null);

export const FavoritesProvider = ({ children }: { children: ReactNode }) => {
    const [favorites, setFavorites] = useState<FavoriteItem[]>([]);
    const [loadingFavs, setLoadingFavs] = useState(false);
    const { user } = UseSession(); 

    useEffect(() => {
        if (user?.email) {
            fetchFavorites();
        } else {
            setFavorites([]);
        }
    }, [user?.email]);

    const fetchFavorites = async () => {
        try {
            setLoadingFavs(true);
            const res = await axios.get(`${import.meta.env.VITE_API_URL}/api/product/fav/${user.email}`, { withCredentials: true });
            
            if (Array.isArray(res.data)) {
                setFavorites(res.data);
            } else {
                setFavorites([]);
            }
        } catch (error) {
            console.error("Error cargando favoritos", error);
            setFavorites([]);
        } finally {
            setLoadingFavs(false);
        }
    };

    const isFavorite = (productId: string) => 
        favorites.some(fav => fav.productId === productId);


    const toggleFavorite = async (productId: string, nombre: string) => {
        if (!user?.email) return alert("Debes iniciar sesión para guardar favoritos");

        const currentlyFavorite = isFavorite(productId);
        const nextState = !currentlyFavorite; 

        try {
            if (nextState) {
                const tempFav: any = { productId, nombre, _id: Date.now().toString() };
                setFavorites(prev => [...prev, tempFav]);
            } else {
                setFavorites(prev => prev.filter(f => f.productId !== productId));
            }

            await axios.post(`${import.meta.env.VITE_API_URL}/api/product/toggle-fav`, 
                { nombre, userEmail: user.email, productId, isFavorite: nextState }, 
                { withCredentials: true }
            );
        } catch (error) {
            console.error("Error al togglear favorito", error);
            fetchFavorites(); 
        }
    };

    return (
        <FavoritesContext.Provider value={{ favorites, isFavorite, toggleFavorite, loadingFavs }}>
            {children}
        </FavoritesContext.Provider>
    );
};

export const UseFavorites = () => {
    const context = useContext(FavoritesContext);
    if (!context) throw new Error("UseFavorites debe ser usado dentro de un FavoritesProvider");
    return context;
};