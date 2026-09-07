import React, { useRef } from 'react';
import Card from './Card';
import logoHidden from "/logos/logo-hidden-final.png"; 
import { motion, useScroll, useTransform } from 'framer-motion';
import './floatingCard.css';
import { UseTheme } from '../contexts/ThemeContext';

interface CardData {
  id: number;
  frente: string;
  reverso: {
    titulo: string;
    subtitulo: string;
    desc?: string;
    items: string[];
  };
}

const datosCartas: CardData[] = [
  { 
    id: 1, 
    frente: logoHidden, 
    reverso: { 
      titulo: 'BLUE TEAM', 
      subtitulo: 'Protección y respuesta ante amenazas.',
      desc: "Especializado en la detección, investigación y respuesta frente a incidentes de seguridad para proteger los activos de una organización.",
      items: ["Security Operations", "Threat Hunting", "Incident Response", "Digital Forensics", "Detection Engineering"] 
    } 
  },
  { 
    id: 2, 
    frente: logoHidden, 
    reverso: { 
      titulo: 'RED TEAM', 
      subtitulo: 'Seguridad ofensiva y evaluación',
      desc: "Enfocado en identificar vulnerabilidades y evaluar la postura de seguridad mediante simulaciones de ataque controladas.",
      items: ['Pentesting', 'Red Team Operations', 'Web Security', 'Active Directory Security', "Exploit Development"] 
    } 
  },
  { 
    id: 3, 
    frente: logoHidden, 
    reverso: { 
      titulo: 'THREAT INTELLIGENCE', 
      subtitulo: 'Inteligencia y análisis de amenazas',
      desc: "Orientado al análisis de actores de amenaza, campañas y técnicas utilizadas para anticipar riesgos y fortalecer la defensa.",
      items: ["Cyber Threat Intelligence", "Malware Analysis", "OSINT", "Threat Research", "Threat Profiling"] 
    } 
  },
  { 
    id: 4, 
    frente: logoHidden, 
    reverso: { 
      titulo: 'GOVERNANCE, RISK & COMPLIANCE',
      desc: "Centrado en la gestión del riesgo, el diseño de estrategias de seguridad y el cumplimiento de estándares y regulaciones.", 
      subtitulo: 'Gobierno, riesgo y cumplimiento',
      items: ['Governance', "Risk Management", "Compliance", "Security Awareness", "Auditoría y Marcos de Seguridad"] 
    } 
  },
];

const FloatingCardSection: React.FC = () => {
  const containerRef = useRef(null);
  const { theme } = UseTheme();
  
  const { scrollYProgress } = useScroll({
    target: containerRef,
    offset: ["start start", "end end"]
  });

  // Animaciones para el Título: Se mueve hacia arriba y desaparece
  const titleY = useTransform(scrollYProgress, [0, 0.15], [0, -60]);

  return (
    <div className={`hc-scroll-wrapper ${theme}`} ref={containerRef}>
      <div className="hc-scroll-area">
        <div className="hc-sticky-container">
          
          {/* --- NUEVA SECCIÓN DE TÍTULO --- */}
          <motion.div 
            className="hc-header-content"
            style={{ y: titleY }}
          >
            <motion.span 
              className="hc-pre-title"
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8 }}
            >
              FORMACIÓN PROFESIONAL
            </motion.span>
            <motion.h2 
              className="hc-main-title"
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, delay: 0.2 }}
            >
              Dominios de <span className="hc-accent">Especialización</span>
            </motion.h2>
            <motion.p 
              className="hc-intro-text"
              initial={{ opacity: 0 }}
              whileInView={{ opacity: 1 }}
              transition={{ duration: 1, delay: 0.4 }}
            >
              Descubrí las principales áreas de la ciberseguridad y las habilidades que podrás desarrollar en cada una de ellas.
            </motion.p>
          </motion.div>

          {/* --- CONTENEDOR DE CARTAS --- */}
          <div className="hc-cartas-container">
            {datosCartas.map((carta, index) => (
              <Card 
                key={carta.id} 
                data={carta} 
                index={index} 
                total={datosCartas.length}
                scrollYProgress={scrollYProgress} 
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default FloatingCardSection;