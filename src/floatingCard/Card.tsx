import React, { useState, useEffect } from 'react';
import { motion, MotionValue, useTransform } from 'framer-motion';

interface CardProps {
  data: {
    frente: string;
    reverso: {
      titulo: string;
      subtitulo: string;
      desc?: string;
      items: string[];
    };
  };
  index: number;
  total: number;
  scrollYProgress: MotionValue<number>;
}

const Card: React.FC<CardProps> = ({ data, index, total, scrollYProgress }) => {
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 768);
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  const scrollRange = [0, 0.1, 0.8, 1];

  const xRange = [
    `${index * 180 + 100}%`,
    `${index * 180 + 100}%`,
    `${index * 180 - 600}%`,
    `${index * 180 - 800}%`
  ];

  const mobileX = useTransform(scrollYProgress, scrollRange, xRange);

  const gap = 400;
  const initialX = (index - (total - 1) / 2) * gap;

  const containerStyle: React.CSSProperties = isMobile
    ? {
        position: 'absolute',
        width: '260px',
        height: '380px',
        perspective: '1500px',
        zIndex: 1,
        left: '50%',
        marginLeft: '-130px',
        top: '150px'
      }
    : {
        position: 'absolute',
        left: '50%',
        top: '50%',
        width: '300px',
        height: '420px',
        marginLeft: `${initialX - 150}px`,
        marginTop: '-210px',
        zIndex: total - index,
        perspective: '200px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      };

  return (
    <motion.div
      className="hc-card-hitbox"
      style={{
        ...containerStyle,
        x: isMobile ? mobileX : 0
      }}
    >
      <motion.div
        className="hc-carta-wrap"
        style={{
          width: '100%',
          height: '100%',
          transformStyle: "preserve-3d",
          cursor: 'default',
          // Siempre del lado reverso — rotateY fijo en -180
          rotateY: -180,
        }}
        animate={{
          y: [0, 15, 0]
        }}
        transition={{
          y: { duration: 4, repeat: Infinity, ease: "easeInOut" }
        }}
      >
        <div className="hc-carta-inner-content" style={{ position: 'relative', width: '100%', height: '100%', transformStyle: 'preserve-3d' }}>

          {/* Frente — oculto, backfaceVisibility lo esconde */}
          <div className="hc-face hc-carta-frente" style={{ backfaceVisibility: 'hidden', position: 'absolute', inset: 0, WebkitBackfaceVisibility: 'hidden' }}>
            <img src={data.frente} alt="Logo" className="hc-logo-card" />
          </div>

          {/* Reverso — siempre visible */}
          <div className="hc-face hc-carta-reverso" style={{ transform: "rotateY(180deg)", backfaceVisibility: 'hidden', WebkitBackfaceVisibility: 'hidden', position: 'absolute', inset: 0 }}>
            <div className="hc-reverso-layout">
              {/* <span className="hc-tag">MÓDULO 0{index + 1}</span> */}
              <h3 className="hc-titulo-reverso">{data.reverso.titulo}</h3>
              <p className="hc-subtitulo-reverso">{data.reverso.subtitulo}</p>
              {data.reverso.desc && (
                <p className="hc-desc-reverso">{data.reverso.desc}</p>
              )}
              <ul className="hc-lista-cursos">
                {data.reverso.items.map((item, i) => (
                  <li key={i}>
                    <span className="hc-bullet"></span> {item}
                  </li>
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