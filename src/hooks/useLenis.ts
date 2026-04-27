/* import { useEffect } from "react";
import Lenis from "@studio-freight/lenis";

const useLenis = () => {
    useEffect(() => {
        const lenis = new Lenis({
            duration: 1.2,        // cuán suave es el scroll
            lerp: 0.1,            // interpolación (0 a 1)
            wheelMultiplier: 1,   // velocidad del scroll del mouse
            touchMultiplier: 1.5, // velocidad del scroll táctil
            infinite: false,      // loop infinito opcional
        });

        const raf = (time: number) => {
            lenis.raf(time);
            requestAnimationFrame(raf);
        }

        requestAnimationFrame(raf);

        return () => {
            // cleanup opcional
            lenis.destroy();
        };
    }, []);
}

export default useLenis;        */