import { useEffect, useState } from 'react';

const MP_SDK_URL = 'https://sdk.mercadopago.com/js/v2';

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
    const [mp, setMp] = useState<MercadoPagoInstance | null>(null);

    useEffect(() => {
        const publicKey = import.meta.env.VITE_MP_PUBLIC_KEY;
        if (!publicKey) {
            console.error("❌ VITE_MP_PUBLIC_KEY no está definida");
            return;
        }

        let cancelled = false;

        const init = () => {
            if (cancelled || !window.MercadoPago) return;
            setMp(new window.MercadoPago(publicKey, { locale: 'es-AR' }));
        };

        // El SDK ya está cargado (script del index.html terminó de bajar)
        if (window.MercadoPago) {
            init();
            return () => { cancelled = true; };
        }

        // Todavía no está: se usa el <script> del index.html si existe,
        // si no se inyecta uno. En los dos casos se espera al evento load.
        let script = document.querySelector<HTMLScriptElement>(`script[src="${MP_SDK_URL}"]`);
        if (!script) {
            script = document.createElement('script');
            script.src   = MP_SDK_URL;
            script.async = true;
            document.body.appendChild(script);
        }

        const onError = () => console.error("❌ No se pudo cargar el SDK de Mercado Pago");

        script.addEventListener('load', init);
        script.addEventListener('error', onError);

        return () => {
            cancelled = true;
            script?.removeEventListener('load', init);
            script?.removeEventListener('error', onError);
        };
    }, []);

    return mp;
};

export default useMercadoPago;

/* import { useEffect, useState } from 'react';

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
        if (window.MercadoPago) {
            const mpInstance = new window.MercadoPago(import.meta.env.VITE_MP_PUBLIC_KEY, {
                locale: 'es-AR' 
            });
            setMp(mpInstance);
        }
    }, []);

    return mp;
};

export default useMercadoPago */