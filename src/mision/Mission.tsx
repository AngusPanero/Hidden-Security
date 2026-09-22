import React from 'react';
import { motion } from 'framer-motion';
import { UseTheme } from '../contexts/ThemeContext';
import './mission.css';

const steps = [
  {
    tag: "01. EL PROBLEMA",
    title: "Reduciendo la brecha entre talento y oportunidades",
    desc: "En ciberseguridad, las habilidades de una persona no siempre son fáciles de reflejar en un CV. Al mismo tiempo, las empresas necesitan encontrar profesionales con conocimientos y experiencia alineados a sus necesidades.",
  },
  {
    tag: "02. PERFIL PROFESIONAL",
    title: "Más que un CV",
    desc: "Hidden Security permite crear un perfil profesional especializado en ciberseguridad, donde experiencia, conocimientos, herramientas y habilidades forman parte de una misma identidad profesional.",
  },
  {
    tag: "03. VALIDACIÓN DE HABILIDADES",
    title: "Demostrar habilidades, no memorizar conceptos",
    desc: "Quienes quieran validar sus conocimientos pueden hacerlo mediante certificaciones basadas en escenarios prácticos, diseñadas para evaluar análisis, toma de decisiones y capacidades aplicadas a cada rol.",
  },
  {
    tag: "04. CRECIMIENTO PROFESIONAL",
    title: "Aprender, validar y evolucionar",
    desc: "La plataforma también ofrece formación para desarrollar nuevas habilidades y acompañar la evolución profesional dentro de la industria.",
  },
  {
    tag: "05. CONECTANDO TALENTO CON EMPRESAS",
    title: "Habilidades que conectan con oportunidades",
    desc: "Las empresas pueden encontrar profesionales utilizando criterios propios de ciberseguridad, como roles, habilidades, herramientas y experiencia, facilitando búsquedas más específicas según las necesidades de cada equipo.",
  }
];

const Mission: React.FC = () => {
  const { theme } = UseTheme();

  return (
    <section className={`hc-mission-section ${theme}`}>
      <div className="hc-mission-container">
        
        <header className="hc-mission-header">
          <motion.h2 
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="hc-mission-main-title"
          >
            NUESTRA <span className="hc-accent">MISIÓN</span>
          </motion.h2>
          <motion.p 
            className="hc-mission-subtitle"
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            transition={{ delay: 0.3 }}
          >
            Conectando talento, habilidades y oportunidades en ciberseguridad.
          </motion.p>
        </header>

        <div className="hc-timeline-wrapper">
          {/* Línea central */}
          <div className="hc-timeline-line" />

          {steps.map((step, idx) => (
            <motion.div 
              key={idx}
              className="hc-timeline-item"
              initial={{ opacity: 0, x: idx % 2 === 0 ? -50 : 50 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true, margin: "-100px" }}
              transition={{ duration: 0.8, delay: idx * 0.1 }}
            >
              <div className="hc-timeline-dot">
                <div className="hc-dot-inner" />
              </div>

              <div className={`hc-timeline-content ${idx % 2 === 0 ? 'left' : 'right'}`}>
                <span className="hc-step-tag">{step.tag}</span>
                <h3 className="hc-step-title">{step.title}</h3>
                <p className="hc-step-desc">{step.desc}</p>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default Mission;