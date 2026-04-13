import React, { useRef } from 'react';
import Card from './Card';
import logoHidden from "/logos/hidden-logo-sf.png"; 
import { motion, useScroll, useTransform } from 'framer-motion';
import './floatingCard.css';
import { UseTheme } from '../contexts/ThemeContext';

interface CardData {
  id: number;
  frente: string;
  reverso: {
    titulo: string;
    subtitulo: string;
    items: string[];
  };
}

const datosCartas: CardData[] = [
  { 
    id: 1, 
    frente: logoHidden, 
    reverso: { 
      titulo: 'HACKING ÉTICO', 
      subtitulo: 'Asegurando infraestructuras críticas mediante ataques controlados.',
      items: ['Pentesting de Redes', 'Explotación Web (OWASP)', 'Escalada de Privilegios', 'Análisis de Vulnerabilidades'] 
    } 
  },
  { 
    id: 2, 
    frente: logoHidden, 
    reverso: { 
      titulo: 'CIBERDEFENSA', 
      subtitulo: 'Monitoreo proactivo y respuesta ante incidentes en tiempo real.',
      items: ['Monitoreo SIEM', 'Detección IDS/IPS', 'Hardening de Sistemas', 'Gestión de Incidentes (IR)'] 
    } 
  },
  { 
    id: 3, 
    frente: logoHidden, 
    reverso: { 
      titulo: 'FORENSE & MALWARE', 
      subtitulo: 'Investigación digital profunda y análisis de código malicioso.',
      items: ['Análisis Forense Digital', 'Ingeniería Inversa', 'Análisis de Malware', 'Recuperación de Evidencias'] 
    } 
  },
  { 
    id: 4, 
    frente: logoHidden, 
    reverso: { 
      titulo: 'GESTIÓN & GRC', 
      subtitulo: 'Cumplimiento normativo y gobernanza de seguridad de la información.',
      items: ['Normativas ISO 27001', 'Análisis de Riesgos IT', 'Políticas de Seguridad', 'Continuidad de Negocio'] 
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
  const titleY = useTransform(scrollYProgress, [0, 0.15], [0, -50]);

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
              Nuestra Área de <span className="hc-accent">Expertise</span>
            </motion.h2>
            <motion.p 
              className="hc-intro-text"
              initial={{ opacity: 0 }}
              whileInView={{ opacity: 1 }}
              transition={{ duration: 1, delay: 0.4 }}
            >
              Explora nuestros trayectos formativos diseñados para dominar el <br />
              panorama actual de la ciberseguridad ofensiva y defensiva.
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