import { createContext, useContext, useState, useEffect, useMemo, type ReactNode } from "react";
import axios from "axios";
import { UseSession } from "./SessionContext";

interface Coupon {
    code: string;
    discount: number; 
    type: 'single_use' | 'date_limited';
    expiryDate?: Date;
    appliedAt?: Date;
    allowedPlans?: string[];
}

interface CartItem {
    id: string; 
    productId: string;
    nombre: string;
    precio: number;
    imagen: string;
    cantidad: number;
    stockMax: number;
    cuotas_sin_interes?: number
}

interface CartContextType {
    cart: CartItem[];
    addToCart: (item: CartItem) => void;
    removeFromCart: (id: string) => void;
    updateQuantity: (id: string, qty: number) => void;
    clearCart: () => void;
    totalAmount: number;    
    finalAmount: number;    
    totalItems: number;
    isLocked: boolean;
    setLock: (status: boolean) => void;
    appliedCoupon: Coupon | null;
    applyCoupon: (code: string, planId: string) => Promise<string>; 
    handlePaymentSuccess: () => Promise<void>;
    priceAlert: string | null;
    setPriceAlert: (msg: string | null) => void;
    refreshCartPrices: (currentItems: CartItem[]) => Promise<CartItem[]>;
    isInitialized: boolean;
}

const CartContext = createContext<CartContextType | null>(null);

export const CartProvider = ({ children }: { children: ReactNode }) => {
    const { user } = UseSession();
    const [cart, setCart] = useState<CartItem[]>([]);
    const [isLocked, setIsLocked] = useState<boolean>(false);
    const [appliedCoupon, setAppliedCoupon] = useState<Coupon | null>(null);
    const [priceAlert, setPriceAlert] = useState<string | null>(null);
    const [isInitialized, setIsInitialized] = useState(false);

    useEffect(() => {
        const syncAndLoad = async () => {
            let itemsToProcess: CartItem[] = [];
            const localData = localStorage.getItem("terminal_cart");
            const localItems = localData ? JSON.parse(localData) : [];
            itemsToProcess = localItems;

            if (user) {
                try {
                    const res = await axios.post(`${import.meta.env.VITE_API_URL}/api/cart/sync`, 
                        { email: user.email, items: localItems, merge: true }, 
                        { withCredentials: true }
                    );
                    itemsToProcess = res.data.items || [];
                    if (res.data.appliedCoupon) setAppliedCoupon(res.data.appliedCoupon);
                    localStorage.removeItem("terminal_cart");
                } catch (e) { console.error(e); }
            }

            const finalItems = await refreshCartPrices(itemsToProcess);
            setCart(finalItems);
            setIsInitialized(true);
        };
        syncAndLoad();
    }, [user]);

    useEffect(() => {
        if (!isInitialized || isLocked) return;
        const persistData = async () => {
            if (user) {
                await axios.post(`${import.meta.env.VITE_API_URL}/api/cart/sync`, { 
                    email: user.email, items: cart, appliedCoupon, merge: false 
                }, { withCredentials: true });
            } else {
                localStorage.setItem("terminal_cart", JSON.stringify(cart));
            }
        };
        const timeoutId = setTimeout(persistData, 1000);
        return () => clearTimeout(timeoutId);
    }, [cart, user, isInitialized]);

    const addToCart = (newItem: CartItem) => {
        if(isLocked) return;
        setCart((prev) => {
            const exist = prev.find((i) => i.id === newItem.id);
            const qtyToAdd = newItem.cantidad > 0 ? newItem.cantidad : 1;
            if(exist){
                return prev.map((i) => i.id === newItem.id 
                    ? { ...i, cantidad: Math.min(i.cantidad + qtyToAdd, i.stockMax)} 
                    : i
                );
            }
            return [...prev, { ...newItem, cantidad: qtyToAdd }];
        });
    };

    const updateQuantity = (id: string, qty: number) => {
        if(isLocked) return;
        setCart(prev => prev.map(i => {
            if (i.id !== id) return i;
            const newQty = Math.max(1, Math.min(qty, i.stockMax));
            return { ...i, cantidad: newQty };
        }));
    };

    const removeFromCart = (id: string) => {
        if(isLocked) return;
        setCart(prev => prev.filter(i => i.id !== id));
    };

    const clearCart = () => {
        setCart([]);
        setAppliedCoupon(null);
        localStorage.removeItem("terminal_cart");
    };

    const applyCoupon = async (code: string, planIds: string[]) => {
        if (!user) return "Debes iniciar sesión para aplicar cupones 🔴";

        try {
            const response = await axios.post(
                `${import.meta.env.VITE_API_URL}/api/coupons/validate`,
                {
                    code,
                    email:  user.email,
                    planId: planIds,  // back acepta string o array
                },
                { withCredentials: true }
            );

            if (response.status === 200) {
                const couponData = {
                    code:         response.data.coupon.code,
                    discount:     response.data.coupon.discount,
                    type:         response.data.coupon.type,
                    scope:        response.data.coupon.scope,
                    allowedPlans: response.data.coupon.allowedPlans,
                    appliedAt:    new Date()
                };
                setAppliedCoupon(couponData);
                return response.data.message;
            }

            return "Error inesperado";

        } catch (error: any) {
            setAppliedCoupon(null);
            return error.response?.data?.message || "Error al validar cupón 🔴";
        }
    };

    const totalAmount = useMemo(() => cart.reduce((acc, i) => acc + (i.precio * i.cantidad), 0), [cart]);
    const finalAmount = useMemo(() => {
        if (!appliedCoupon) return totalAmount;
        return totalAmount * (1 - appliedCoupon.discount / 100);
    }, [totalAmount, appliedCoupon]);
    const totalItems = useMemo(() => cart.reduce((acc, i) => acc + i.cantidad, 0), [cart]);

    const handlePaymentSuccess = async () => {
        try {
            await axios.post(`${import.meta.env.VITE_API_URL}/api/checkout/success`, { email: user.email, couponCode: appliedCoupon?.code || null, items: cart }, { withCredentials: true });
            clearCart(); 
        } catch(error: any){ 
            console.error("Error al registrar pago exitoso", error); 
        }
    };

    // VALIDAR PRECIO PRODUCTOS
    const refreshCartPrices = async (currentItems: CartItem[]) => {
        if (!currentItems || currentItems.length === 0) return [];
        try {
            const productIds = currentItems.map(item => item.id); 
            
            const response = await axios.post(`${import.meta.env.VITE_API_URL}/api/products/validate-prices`, { 
                productIds 
            });

            const dbData = response.data; 
            let hasChanges = false;

            const validatedCart = currentItems.map(item => {
                const dbProduct = dbData.find((p: any) => p.productId === item.id);
                if (!dbProduct) return item;

                const priceInDB = dbProduct.precio;
                const stockInDB = dbProduct.stockMax;
                const cuotasInDB = dbProduct.cuotas_sin_interes;
                const safeQty = Math.max(1, Math.min(item.cantidad, stockInDB));

                if (priceInDB !== item.precio || stockInDB !== item.stockMax || safeQty !== item.cantidad || cuotasInDB !== item.cuotas_sin_interes) {
                    hasChanges = true;
                    
                    return { ...item, precio: priceInDB, stockMax: stockInDB, cantidad: safeQty, cuotas_sin_interes: cuotasInDB };
                }
                return item;
            });

            if (hasChanges) {
                setPriceAlert("Actualizamos precios y stock según disponibilidad de variantes. ⚠️");
                setCart(validatedCart);
            }
            return validatedCart;
        } catch (error) {
            console.error("Error al validar productos", error)
            return currentItems;
        }
    };

    return (
        <CartContext.Provider value={{ cart, addToCart, removeFromCart, updateQuantity, refreshCartPrices, priceAlert, setPriceAlert, clearCart, totalAmount, finalAmount, totalItems, isLocked, setLock: setIsLocked, appliedCoupon, applyCoupon, handlePaymentSuccess, isInitialized }}>
            {children}
        </CartContext.Provider>
    );
};

export const UseCart = () => {
    const context = useContext(CartContext);
    if (!context) throw new Error("UseCart debe usarse dentro de CartProvider");
    return context;
};