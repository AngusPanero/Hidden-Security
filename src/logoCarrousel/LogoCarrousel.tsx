import React, { useRef } from 'react';
import { motion, useScroll, useSpring, useTransform, useMotionValue, useVelocity, useAnimationFrame } from 'framer-motion';
import { wrap } from '@motionone/utils';
import './logoCarrousel.css';
import { UseTheme } from '../contexts/ThemeContext';
interface MarqueeProps {
  logos: string[];
  baseVelocity: number;
}

const MarqueeRow: React.FC<MarqueeProps> = ({ logos, baseVelocity = 100 }) => {
    const { theme } = UseTheme()
    const baseX = useMotionValue(0);
    const { scrollY } = useScroll();
    const scrollVelocity = useVelocity(scrollY);
    const smoothVelocity = useSpring(scrollVelocity, { stiffness: 400, damping: 50 });
    const velocityFactor = useTransform(smoothVelocity, [0, 1000], [0, 5], { clamp: false });

    // Esto hace que el movimiento sea infinito
    const x = useTransform(baseX, (v) => `${wrap(-20, -45, v)}%`);

    const directionFactor = useRef<number>(1);
    
    useAnimationFrame((_, delta) => {
        let moveBy = directionFactor.current * baseVelocity * (delta / 1000);

        // Cambiar dirección según el scroll
        if (velocityFactor.get() < 0) {
        directionFactor.current = -1; // Hacia la izquierda si subo
        } else if (velocityFactor.get() > 0) {
        directionFactor.current = 1;  // Hacia la derecha si bajo
        }

        moveBy += directionFactor.current * moveBy * velocityFactor.get();
        baseX.set(baseX.get() + moveBy);
    });

    return (
        <div className={`hc-marquee-overflow`}>
        <motion.div className="hc-marquee-inner" style={{ x }}>
            {/* Duplicamos los logos varias veces para que no haya huecos */}
            {[...Array(4)].map((_, i) => (
            <div key={i} className={`hc-marquee-set ${theme}`}>
                {logos.map((logo, idx) => (
                <img key={idx} src={logo} alt="brand" className="hc-brand-logo" />
                ))}
            </div>
            ))}
        </motion.div>
        </div>
    );
    };

    const LogoCarrousel: React.FC = () => {
        const { theme } = UseTheme()
        const logos = [
            "/logos/android.svg", "/logos/apple.svg", "/logos/microsoft.svg", 
            "/logos/openai.svg", "/logos/postman.svg", "/logos/premiere.svg", "/logos/react.svg", "/logos/safari.svg", "/logos/python.svg", 
            "/logos/playstore.svg", "/logos/illustrator.svg", "/logos/chrome.svg", "/logos/css.svg", "/logos/firefox.svg", "/logos/aws.svg", 
            "/logos/azure.svg", "/logos/aftereffects.svg", "/logos/appstore.svg","/logos/android.svg", "/logos/apple.svg", "/logos/microsoft.svg", 
            "/logos/openai.svg", "/logos/postman.svg", "/logos/premiere.svg", "/logos/react.svg", "/logos/safari.svg", "/logos/python.svg", 
            "/logos/playstore.svg", "/logos/illustrator.svg", "/logos/chrome.svg", "/logos/css.svg", "/logos/firefox.svg", "/logos/aws.svg", 
            "/logos/azure.svg", "/logos/aftereffects.svg", "/logos/appstore.svg","/logos/android.svg", "/logos/apple.svg", "/logos/microsoft.svg", 
            "/logos/openai.svg", "/logos/postman.svg", "/logos/premiere.svg", "/logos/react.svg", "/logos/safari.svg", "/logos/python.svg", 
            "/logos/playstore.svg", "/logos/illustrator.svg", "/logos/chrome.svg", "/logos/css.svg", "/logos/firefox.svg", "/logos/aws.svg", 
            "/logos/azure.svg", "/logos/aftereffects.svg", "/logos/appstore.svg",
        ];

        return (
            <section className={`hc-logo-section ${theme}`}>
                <motion.div 
                    className="hc-logos-header"
                    initial={{ opacity: 0, y: 30 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true, margin: "-100px" }}
                    transition={{ duration: 0.8, ease: "easeOut" }}
                >
                    <span className="hc-logos-subtitle">PARTNERSHIPS</span>
                    <h2 className="hc-logos-title">
                        Empresas que confían en <span className="hc-logos-accent">nuestra misión</span>
                    </h2>
                    <div className="hc-logos-divider" />
                </motion.div>

                <MarqueeRow logos={logos} baseVelocity={0.2} />
                <MarqueeRow logos={logos} baseVelocity={0.3} />
                <MarqueeRow logos={logos} baseVelocity={0.2} />
            </section>
        );
};

export default LogoCarrousel;