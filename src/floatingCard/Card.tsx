import React, { useState, useEffect } from 'react';
import { motion, MotionValue, useTransform } from 'framer-motion';

interface CardProps {
  data: {
    frente: string;
    reverso: {
      titulo: string;
      subtitulo: string;
      items: string[];
    };
  };
  index: number;
  total: number;
  scrollYProgress: MotionValue<number>;
}

const Card: React.FC<CardProps> = ({ data, index, total, scrollYProgress }) => {
  const [isHovered, setIsHovered] = useState(false);
  const [isFlipped, setIsFlipped] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 768);
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

 // Definimos los puntos clave del scroll (0% -> 10% -> 80% -> 100%)
  const scrollRange = [0, 0.1, 0.8, 1];

    const xRange = [
      `${index * 180 + 100}%`, // 0: Mucho más cerca del borde derecho
      `${index * 180 + 100}%`, // 0.1: Mantienen posición
      `${index * 180 - 600}%`, // 0.8: Ya cruzaron a la izquierda (Gap constante 180)
      `${index * 180 - 800}%`  // 1: Se alejan del todo para dejar paso a la siguiente sección
    ];

  const mobileX = useTransform(scrollYProgress, scrollRange, xRange);

  const gap = 400; 
  const initialX = (index - (total - 1) / 2) * gap;

  const containerStyle: React.CSSProperties = isMobile 
    ? {
        position: 'absolute', // Cambiamos a absolute para que se encimen y usemos transform
        width: '260px', 
        height: '380px', 
        perspective: '1500px',
        zIndex: isHovered ? 100 : 1,
        left: '50%', // Centramos la base
        marginLeft: '-130px', // Mitad del ancho para centrar
        top: '150px' // Ajuste de distancia con el título
      }
    : {
        position: 'absolute',
        left: '50%',
        top: '50%',
        width: '300px',
        height: '420px',
        marginLeft: `${initialX - 150}px`,
        marginTop: '-210px',
        zIndex: isHovered ? 100 : total - index,
        perspective: '1500px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      };

  return (
    <motion.div 
      className="hc-card-hitbox"
      onMouseEnter={() => !isMobile && setIsHovered(true)}
      onMouseLeave={() => !isMobile && setIsHovered(false)}
      onClick={() => isMobile && setIsHovered(!isHovered)} 
      style={{
        ...containerStyle,
        x: isMobile ? mobileX : 0 // Solo aplica transformación X en móvil vinculada al scroll
      }}
    >
      <motion.div 
        className="hc-carta-wrap"
        style={{ 
          width: '100%',
          height: '100%',
          transformStyle: "preserve-3d",
          cursor: 'pointer',
        }}
        animate={{ 
          rotateY: isHovered ? -180 : 0,
          y: isHovered ? 10 : [0, 15, 0] // Reducimos levemente el floating para móvil
        }}
        onUpdate={(latest: any) => {
          if (latest.rotateY <= -90 && !isFlipped) setIsFlipped(true);
          if (latest.rotateY > -90 && isFlipped) setIsFlipped(false);
        }}
        transition={{ 
          rotateY: { type: "spring", stiffness: 60, damping: 12 },
          y: { duration: 4, repeat: Infinity, ease: "easeInOut" }
        }}
      >
        <div className="hc-carta-inner-content" style={{ position: 'relative', width: '100%', height: '100%', transformStyle: 'preserve-3d' }}>
          <div className="hc-face hc-carta-frente" style={{ backfaceVisibility: 'hidden', position: 'absolute', inset: 0, WebkitBackfaceVisibility: 'hidden' }}>
            <img src={data.frente} alt="Logo" className="hc-logo-card" />

            { isMobile && <h2 className='hc-touch'>Toca Para Descubrir</h2> }
          </div>
          <div className="hc-face hc-carta-reverso" style={{ transform: "rotateY(180deg)", backfaceVisibility: 'hidden', WebkitBackfaceVisibility: 'hidden', position: 'absolute', inset: 0 }}>
             {/* Reverso */}
             <div className="hc-reverso-layout">
                <motion.span className="hc-tag" animate={{ opacity: isFlipped ? 1 : 0 }}>MÓDULO 0{index + 1}</motion.span>
                <motion.h3 className="hc-titulo-reverso" animate={{ y: isFlipped ? 0 : 20, opacity: isFlipped ? 1 : 0 }}>{data.reverso.titulo}</motion.h3>
                <motion.p className="hc-subtitulo-reverso" animate={{ opacity: isFlipped ? 0.7 : 0 }}>{data.reverso.subtitulo}</motion.p>
                <ul className="hc-lista-cursos">
                  {data.reverso.items.map((item, i) => (
                    <motion.li key={i} animate={isFlipped ? { x: 0, opacity: 1 } : { x: -10, opacity: 0 }} transition={{ delay: 0.2 + i * 0.05 }}>
                      <span className="hc-bullet"></span> {item}
                    </motion.li>
                  ))}
                </ul>
             </div>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
};

export default Card;