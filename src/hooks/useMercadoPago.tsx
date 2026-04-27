import { useEffect, useState } from 'react';

interface MercadoPagoInstance {
    checkout: (options: any) => any;
    bricks: () => any;
    createCardToken: (data: any) => Promise<any>;
    getPaymentMethods: (data: any) => Promise<any>;
    getIssuers: (data: any) => Promise<any>;
}
declare global {
    interface Window {
        MercadoPago: any;
    }
}

const useMercadoPago = () => {
    const [ mp, setMp ] = useState<MercadoPagoInstance|null>(null);

    useEffect(() => {
        // Accedemos al objeto que cargaste en el index.html
        if (window.MercadoPago) {
            const mpInstance = new window.MercadoPago(import.meta.env.VITE_MP_PUBLIC_KEY, {
                locale: 'es-AR' // Según tu país
            });
            setMp(mpInstance);
        }
    }, []);

    return mp;
};

export default useMercadoPago