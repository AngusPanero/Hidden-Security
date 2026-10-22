// ─── Tipos ────────────────────────────────────────────────────────────────────
export interface CourseModule {
  number: string;
  title: string;
  desc: string;
}

export interface CourseData {
  title: string;
  subtitle: string;
  label: string;
  intro: string;
  stats: { time: string; modules: string; mode: string};
  desarrolladoPor?: string;
  requisitosMinimos?: string;
  // Sección 02
  audience: string;
  objective: string;
  skillsTitle: string;
  skillsDesc: string;
  // Módulos
  modules: CourseModule[];
  // Sección 03
  careerIntro: string;
  roles: string[];
  certTitle: string;
  certDesc: string;
  pdfName: string;
}

// ─── Datos ────────────────────────────────────────────────────────────────────
export const COURSES_DATA: Record<string, CourseData> = {

  "modern-soc-operations": {
    title: "MODERN SOC",
    subtitle: "Operations.",
    label: "01 // TRAINING_PROGRAM",
    intro: "Formación avanzada en operaciones de seguridad. Domina la detección, análisis y respuesta ante incidentes en infraestructuras críticas.",
    stats: { time: "50H", modules: "8", mode: "ASINCRÓNICA" },
    desarrolladoPor: "Desarrollado por Hidden Security",
    requisitosMinimos: "Conocimientos básicos de redes (TCP/IP, DNS, HTTP/S) Manejo básico de Windows y Linux Experiencia o formación equivalente a Analista SOC Nivel 1 Familiaridad con alguna herramienta SIEM o EDR Lectura e interpretación de logs de seguridad Conocimiento básico de MITRE ATT&CK",

    audience: "Personas que buscan iniciar o desarrollar una carrera en un Centro de Operaciones de Seguridad (SOC), adquiriendo las habilidades técnicas, operativas y analíticas que demanda la industria actual.",
    objective: "Formar profesionales capaces de monitorear, investigar y responder a eventos e incidentes de seguridad en un Centro de Operaciones de Seguridad moderno, desarrollando pensamiento analítico, criterio técnico y capacidad de toma de decisiones en escenarios inspirados en situaciones reales.",

    skillsTitle: "¿Qué habilidades vas a desarrollar?",
    skillsDesc: "A lo largo del programa desarrollarás las competencias necesarias para desempeñarte en un Centro de Operaciones de Seguridad moderno. Aprenderás a interpretar alertas, analizar eventos, investigar incidentes, comprender el comportamiento de las amenazas y utilizar las herramientas más utilizadas por los equipos de Blue Team, fortaleciendo el pensamiento analítico y la toma de decisiones frente a escenarios reales.",

    modules: [
      {
        number: "00",
        title: "Introducción",
        desc: "Conocé cómo funciona el programa, la metodología de aprendizaje y el recorrido que realizarás durante toda la formación.",
      },
      {
        number: "01",
        title: "Introducción al Rol SOC",
        desc: "Comprendé cómo funciona un Centro de Operaciones de Seguridad, cuáles son las responsabilidades de un analista y cómo se integra dentro de la estrategia de seguridad de una organización.",
      },
      {
        number: "02",
        title: "Fundamentos de Ciberseguridad",
        desc: "Incorporá los conceptos esenciales sobre amenazas, vulnerabilidades, gestión de riesgos y principios fundamentales de seguridad informática.",
      },
      {
        number: "03",
        title: "Redes y Sistemas",
        desc: "Aprendé el funcionamiento de redes, protocolos y sistemas operativos desde la perspectiva de un analista SOC para interpretar correctamente la actividad observada en los eventos de seguridad.",
      },
      {
        number: "04",
        title: "Malware y TTPs",
        desc: "Analizá el comportamiento de las principales amenazas, comprendiendo cómo operan los atacantes y cómo identificar sus técnicas utilizando marcos como MITRE ATT&CK.",
      },
      {
        number: "05",
        title: "Análisis de Alertas y Eventos",
        desc: "Desarrollá la capacidad de investigar alertas de seguridad, correlacionar eventos, reducir falsos positivos y priorizar incidentes según su criticidad.",
      },
      {
        number: "06",
        title: "Respuesta Inicial a Incidentes",
        desc: "Aprendé las primeras acciones frente a un incidente de seguridad, criterios de escalamiento, documentación y comunicación con otros equipos.",
      },
      {
        number: "07",
        title: "Automatización, Inteligencia Artificial y Herramientas",
        desc: "Comprendé cómo aprovechar herramientas modernas, automatización e inteligencia artificial como apoyo al análisis, aprendiendo también a validar sus resultados mediante criterio técnico.",
      },
      {
        number: "08",
        title: "Soft Skills, Ética y Desarrollo Profesional",
        desc: "Fortalecé habilidades de comunicación, pensamiento crítico, trabajo en equipo y ética profesional, competencias fundamentales para desarrollarte en la industria de la ciberseguridad.",
      },
    ],

    careerIntro: "Al finalizar el programa contarás con una base sólida para desempeñarte en equipos de seguridad y continuar especializándote en distintas áreas de la ciberseguridad.",
    roles: ["SOC ANALYST", "INCIDENT RESPONSE", "THREAT HUNTING", "THREAT INTELLIGENCE", "SECURITY MONITORING", "DIGITAL FORENSICS"],

    certTitle: "Certificación y Empleabilidad",
    certDesc: "Al finalizar el curso podrás optar por rendir la Certificación SOC Analyst, diseñada para validar tus habilidades mediante escenarios prácticos inspirados en situaciones reales. Quienes obtengan la certificación podrán formar parte de la bolsa de talento de Hidden Security, donde las empresas podrán identificar perfiles validados para sus procesos de selección.",

    pdfName: "Hidden_Security_SOC_Analyst.pdf",
  },

  // ─── EN DESARROLLO ────────────────────────────────────────────────────────

  "threat-hunting": {
    title: "THREAT",
    subtitle: "Hunting.",
    label: "02 // TRAINING_PROGRAM",
    intro: "Especialización en búsqueda proactiva de amenazas que logran evadir los mecanismos tradicionales de seguridad.",
    stats: { time: "—", modules: "—", mode: "ASINCRÓNICA" },
    audience: "Curso en desarrollo. Próximamente disponible.",
    objective: "Próximamente.",
    skillsTitle: "¿Qué habilidades vas a desarrollar?",
    skillsDesc: "Próximamente.",
    modules: [
      { number: "—", title: "Contenido en desarrollo", desc: "Este programa se encuentra actualmente en producción. Pronto estará disponible." },
    ],
    careerIntro: "Próximamente.",
    roles: ["THREAT HUNTER", "SOC ANALYST L2/L3", "DETECTION ENGINEER", "SECURITY RESEARCHER"],
    certTitle: "Certificación y Empleabilidad",
    certDesc: "Al finalizar el curso podrás optar por rendir la certificación correspondiente y acceder a la bolsa de talento de Hidden Security.",
    pdfName: "Hidden_Security_Threat_Hunting.pdf",
  },

  "incident-response": {
    title: "INCIDENT",
    subtitle: "Response.",
    label: "03 // TRAINING_PROGRAM",
    intro: "Domina el ciclo completo de respuesta ante incidentes de seguridad en entornos corporativos reales.",
    stats: { time: "—", modules: "—", mode: "ASINCRÓNICA" },
    audience: "Curso en desarrollo. Próximamente disponible.",
    objective: "Próximamente.",
    skillsTitle: "¿Qué habilidades vas a desarrollar?",
    skillsDesc: "Próximamente.",
    modules: [
      { number: "—", title: "Contenido en desarrollo", desc: "Este programa se encuentra actualmente en producción. Pronto estará disponible." },
    ],
    careerIntro: "Próximamente.",
    roles: ["INCIDENT RESPONDER", "DFIR SPECIALIST", "FORENSIC ANALYST", "CYBER INVESTIGATOR"],
    certTitle: "Certificación y Empleabilidad",
    certDesc: "Al finalizar el curso podrás optar por rendir la certificación correspondiente y acceder a la bolsa de talento de Hidden Security.",
    pdfName: "Hidden_Security_Incident_Response.pdf",
  },

  "threat-intelligence": {
    title: "THREAT",
    subtitle: "Intelligence.",
    label: "04 // TRAINING_PROGRAM",
    intro: "Analizá actores de amenazas, campañas y TTPs para transformar información en inteligencia accionable.",
    stats: { time: "—", modules: "—", mode: "ASINCRÓNICA" },
    audience: "Curso en desarrollo. Próximamente disponible.",
    objective: "Próximamente.",
    skillsTitle: "¿Qué habilidades vas a desarrollar?",
    skillsDesc: "Próximamente.",
    modules: [
      { number: "—", title: "Contenido en desarrollo", desc: "Este programa se encuentra actualmente en producción. Pronto estará disponible." },
    ],
    careerIntro: "Próximamente.",
    roles: ["THREAT INTELLIGENCE ANALYST", "CTI SPECIALIST", "MALWARE ANALYST", "THREAT RESEARCHER"],
    certTitle: "Certificación y Empleabilidad",
    certDesc: "Al finalizar el curso podrás optar por rendir la certificación correspondiente y acceder a la bolsa de talento de Hidden Security.",
    pdfName: "Hidden_Security_Threat_Intelligence.pdf",
  },

  "pentesting": {
    title: "ETHICAL",
    subtitle: "Pentesting.",
    label: "05 // TRAINING_PROGRAM",
    intro: "Comprendé cómo piensan y trabajan los atacantes mediante pruebas de penetración controladas.",
    stats: { time: "—", modules: "—", mode: "ASINCRÓNICA" },
    audience: "Curso en desarrollo. Próximamente disponible.",
    objective: "Próximamente.",
    skillsTitle: "¿Qué habilidades vas a desarrollar?",
    skillsDesc: "Próximamente.",
    modules: [
      { number: "—", title: "Contenido en desarrollo", desc: "Este programa se encuentra actualmente en producción. Pronto estará disponible." },
    ],
    careerIntro: "Próximamente.",
    roles: ["PENETRATION TESTER", "RED TEAM OPERATOR", "VULNERABILITY RESEARCHER", "WEB SECURITY ANALYST"],
    certTitle: "Certificación y Empleabilidad",
    certDesc: "Al finalizar el curso podrás optar por rendir la certificación correspondiente y acceder a la bolsa de talento de Hidden Security.",
    pdfName: "Hidden_Security_Pentesting.pdf",
  },

  "grc": {
    title: "GOVERNANCE RISK",
    subtitle: "& Compliance.",
    label: "06 // TRAINING_PROGRAM",
    intro: "Desarrollá una visión estratégica de la ciberseguridad gestionando riesgos, controles y marcos normativos.",
    stats: { time: "—", modules: "—", mode: "ASINCRÓNICA" },
    audience: "Curso en desarrollo. Próximamente disponible.",
    objective: "Próximamente.",
    skillsTitle: "¿Qué habilidades vas a desarrollar?",
    skillsDesc: "Próximamente.",
    modules: [
      { number: "—", title: "Contenido en desarrollo", desc: "Este programa se encuentra actualmente en producción. Pronto estará disponible." },
    ],
    careerIntro: "Próximamente.",
    roles: ["GRC ANALYST", "RISK MANAGER", "COMPLIANCE OFFICER", "SECURITY AUDITOR"],
    certTitle: "Certificación y Empleabilidad",
    certDesc: "Al finalizar el curso podrás optar por rendir la certificación correspondiente y acceder a la bolsa de talento de Hidden Security.",
    pdfName: "Hidden_Security_GRC.pdf",
  },
};