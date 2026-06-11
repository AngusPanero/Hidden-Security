import { useState, useEffect, useRef, useCallback } from "react";
import axios from "axios";
import { Document, Page, pdfjs } from "react-pdf";
import videoCurso from "./video-curso.mp4";
import "react-pdf/dist/Page/AnnotationLayer.css";
import "react-pdf/dist/Page/TextLayer.css";
import "./soc1Course.css";
import { UseSession } from "../../../contexts/SessionContext";
import { UseTheme } from "../../../contexts/ThemeContext";

// Worker de PDF.js — apunta al archivo en node_modules
pdfjs.GlobalWorkerOptions.workerSrc = new URL(
  "pdfjs-dist/build/pdf.worker.min.mjs",
  import.meta.url,
).toString();

// ══════════════════════════════════════════════════════════════════════════════
//  ESTRUCTURA DEL CURSO — editá aquí para organizar el contenido definitivo
//  Tipos de step: "intro" | "video" | "pdf" | "quiz"
// ══════════════════════════════════════════════════════════════════════════════
const COURSE_ID = "soc1";

interface QuizQuestion {
  question: string;
  options:  string[];
  answer:   number; // índice de la opción correcta (0-based)
}

interface CourseStep {
  type:        "intro" | "video" | "pdf" | "quiz";
  title:       string;
  description?: string;
  // video
  src?:        string;  // ruta relativa ej: "/videos/soc1/modulo1.mp4"
  // pdf
  pdfSrc?:     string;  // ruta relativa ej: "/pdfs/soc1/modulo1.pdf"
  pages?:      number;  // total de páginas del PDF
  // quiz
  questions?:  QuizQuestion[];
}

const COURSE_STEPS: CourseStep[] = [
  // ── INTRO ─────────────────────────────────────────────────────────────────
  {
    type:  "intro",
    title: "Bienvenida al curso",
    description: "Introducción al programa SOC Analyst Level 1.",
  },

  // ── MÓDULO 1: Fundamentos ──────────────────────────────────────────────────
  {
    type:        "video",
    title:       "Módulo 1 — ¿Qué es un SOC?",
    description: "Estructura y funciones de un Centro de Operaciones de Seguridad.",
    src: videoCurso
  },
  {
    type:    "pdf",
    title:   "Material de lectura — Fundamentos SOC",
    pdfSrc: "/public/pdf/prueba.pdf",
    pages:   12,
  },
  {
    type:  "quiz",
    title: "Quiz — Módulo 1",
    questions: [
      {
        question: "¿Cuál es la función principal de un SOC?",
        options: ["Desarrollar aplicaciones web", "Monitorear y responder a incidentes de seguridad", "Administrar bases de datos", "Gestionar recursos humanos"],
        answer: 1,
      },
      {
        question: "¿Qué significa el acrónimo SIEM?",
        options: ["Security Information and Event Management", "System Integration and Error Monitoring", "Secure Internet Exchange Module", "Standard Incident and Error Management"],
        answer: 0,
      },
      {
        question: "¿Cuál de los siguientes es un indicador de compromiso (IoC)?",
        options: ["Un parche de seguridad instalado", "Una dirección IP maliciosa conocida", "Una contraseña robusta", "Un firewall activo"],
        answer: 1,
      },
      {
        question: "¿Qué nivel del SOC se encarga del monitoreo y triaje inicial de alertas?",
        options: ["Tier 3", "Tier 2", "Tier 1", "Tier 4"],
        answer: 2,
      },
      {
        question: "¿Cuál es la diferencia entre un IDS y un IPS?",
        options: ["No hay diferencia, son sinónimos", "El IDS detecta y el IPS detecta y bloquea activamente", "El IPS solo registra eventos, el IDS los bloquea", "El IDS opera en la nube y el IPS on-premise"],
        answer: 1,
      },
      {
        question: "¿Qué es un SOC as a Service (SOCaaS)?",
        options: ["Un SOC físico instalado en las oficinas del cliente", "Un modelo donde el servicio de monitoreo se terceriza a un proveedor externo", "Un software de gestión de tickets de seguridad", "Una certificación de seguridad para analistas"],
        answer: 1,
      },
      {
        question: "El marco MITRE ATT&CK se utiliza principalmente para:",
        options: ["Gestionar vulnerabilidades de software", "Describir tácticas, técnicas y procedimientos de atacantes", "Certificar profesionales de seguridad", "Configurar firewalls de red"],
        answer: 1,
      },
      {
        question: "¿Qué es un 'false positive' en el contexto de un SOC?",
        options: ["Una amenaza real que fue correctamente detectada", "Una alerta que indica un ataque cuando en realidad no existe", "Un malware que evade la detección", "Un log que fue eliminado por error"],
        answer: 1,
      },
      {
        question: "¿Cuál de estas herramientas se utiliza como SIEM en entornos empresariales?",
        options: ["Wireshark", "Nmap", "Splunk", "Metasploit"],
        answer: 2,
      },
      {
        question: "La correlación de eventos en un SIEM permite:",
        options: ["Encriptar los logs del sistema", "Relacionar múltiples eventos para detectar patrones de ataque", "Eliminar alertas duplicadas automáticamente", "Hacer backups de la base de datos"],
        answer: 1,
      },
      {
        question: "¿Qué significa el concepto de 'dwell time' en seguridad?",
        options: ["El tiempo que tarda en instalarse un agente de seguridad", "El tiempo que un atacante permanece en la red sin ser detectado", "La duración de un ataque DDoS", "El tiempo de respuesta de un analista Tier 1"],
        answer: 1,
      },
      {
        question: "¿Cuál de los siguientes NO es un rol típico dentro de un SOC?",
        options: ["Analista de seguridad", "Threat Hunter", "Desarrollador de videojuegos", "Incident Responder"],
        answer: 2,
      },
      {
        question: "Un 'runbook' en el contexto del SOC es:",
        options: ["Un registro de todos los incidentes del año", "Un procedimiento paso a paso para responder a un tipo específico de incidente", "Un informe ejecutivo de seguridad mensual", "Una lista de usuarios con privilegios elevados"],
        answer: 1,
      },
      {
        question: "¿Qué tipo de inteligencia se obtiene analizando el comportamiento de un malware en un entorno controlado?",
        options: ["OSINT", "HUMINT", "Threat Intelligence técnica (TTPs)", "Inteligencia estratégica"],
        answer: 2,
      },
      {
        question: "La visibilidad en un SOC se logra principalmente mediante:",
        options: ["Entrevistas al personal de IT", "Recolección y análisis de logs de múltiples fuentes", "Revisiones manuales de código fuente", "Escaneos de red semanales"],
        answer: 1,
      },
      {
        question: "¿Qué es el 'kill chain' de Lockheed Martin?",
        options: ["Un modelo que describe las fases de un ataque cibernético", "Un tipo de firewall de nueva generación", "Un protocolo de comunicación segura", "Un estándar de certificación en ciberseguridad"],
        answer: 0,
      },
      {
        question: "¿Cuál es el objetivo principal de la fase de 'contención' en un incidente?",
        options: ["Eliminar el malware del sistema", "Evitar que el incidente se propague a otros sistemas", "Documentar las acciones realizadas", "Notificar a los medios de comunicación"],
        answer: 1,
      },
      {
        question: "Los logs de tipo 'syslog' son generados principalmente por:",
        options: ["Aplicaciones web", "Dispositivos de red y sistemas Unix/Linux", "Bases de datos relacionales", "Clientes de correo electrónico"],
        answer: 1,
      },
      {
        question: "¿Qué es un 'honeypot' en el contexto de la seguridad defensiva?",
        options: ["Un tipo de cifrado simétrico", "Un sistema trampa diseñado para atraer y estudiar a los atacantes", "Una técnica de phishing ofensivo", "Un protocolo de autenticación multifactor"],
        answer: 1,
      },
      {
        question: "El principio de 'mínimo privilegio' establece que:",
        options: ["Los administradores deben tener acceso total a todos los sistemas", "Los usuarios deben tener solo los permisos necesarios para sus tareas", "Las contraseñas deben tener al menos 8 caracteres", "Los logs deben retenerse por un mínimo de 30 días"],
        answer: 1,
      },
    ],
  },

  // ── MÓDULO 2: Amenazas y Vectores ─────────────────────────────────────────
  {
    type:        "video",
    title:       "Módulo 2 — Tipos de amenazas",
    description: "Malware, phishing, ransomware y vectores de ataque comunes.",
    src: videoCurso
  },
  {
    type:    "pdf",
    title:   "Material de lectura — Vectores de ataque",
    pdfSrc: "/public/pdf/prueba.pdf",
    pages:   18,
  },
  {
    type:  "quiz",
    title: "Quiz — Módulo 2",
    questions: [
      {
        question: "¿Qué tipo de malware cifra los archivos del usuario y pide rescate?",
        options: ["Spyware", "Adware", "Ransomware", "Rootkit"],
        answer: 2,
      },
      {
        question: "El phishing principalmente explota:",
        options: ["Vulnerabilidades de hardware", "La ingeniería social y el factor humano", "Fallas en protocolos de red", "Errores en sistemas operativos"],
        answer: 1,
      },
      {
        question: "¿Cuál es el primer paso del ciclo de vida de un ataque según MITRE ATT&CK?",
        options: ["Explotación", "Reconocimiento", "Movimiento lateral", "Exfiltración"],
        answer: 1,
      },
      {
        question: "Un ataque de tipo 'Man in the Middle' (MitM) consiste en:",
        options: ["Saturar un servidor con tráfico masivo", "Interceptar comunicaciones entre dos partes sin que lo sepan", "Instalar malware mediante un USB", "Adivinar contraseñas por fuerza bruta"],
        answer: 1,
      },
      {
        question: "¿Qué es un ataque de 'spear phishing'?",
        options: ["Un phishing masivo enviado a millones de usuarios", "Un phishing altamente dirigido a una persona u organización específica", "Un ataque que explota vulnerabilidades de red", "Un tipo de ransomware que se propaga por email"],
        answer: 1,
      },
      {
        question: "¿Cuál es la principal característica de un rootkit?",
        options: ["Cifra todos los archivos del sistema", "Se oculta en el sistema operativo para mantener acceso persistente", "Roba credenciales de navegadores web", "Genera clics fraudulentos en publicidad"],
        answer: 1,
      },
      {
        question: "Un ataque DDoS (Distributed Denial of Service) tiene como objetivo:",
        options: ["Robar datos confidenciales del servidor", "Hacer inaccesible un servicio saturando sus recursos", "Instalar backdoors en servidores web", "Interceptar tráfico de red cifrado"],
        answer: 1,
      },
      {
        question: "¿Qué es un 'zero-day exploit'?",
        options: ["Un ataque que ocurre exactamente a medianoche", "Un exploit que aprovecha una vulnerabilidad desconocida o sin parche", "Un malware que se activa el primer día de cada mes", "Una técnica de phishing de nueva generación"],
        answer: 1,
      },
      {
        question: "El malware de tipo 'keylogger' se especializa en:",
        options: ["Cifrar archivos del usuario", "Registrar las pulsaciones del teclado para robar información", "Mostrar publicidad no deseada", "Bloquear el acceso al sistema operativo"],
        answer: 1,
      },
      {
        question: "¿Qué técnica utiliza un atacante para moverse lateralmente dentro de una red comprometida?",
        options: ["SQL Injection", "Pass-the-Hash o robo de credenciales", "Cross-Site Scripting (XSS)", "Buffer Overflow en aplicaciones web"],
        answer: 1,
      },
      {
        question: "Un ataque de 'SQL Injection' apunta principalmente a:",
        options: ["Sistemas de autenticación biométrica", "Bases de datos a través de entradas no sanitizadas", "Protocolos de red como TCP/IP", "Firmware de dispositivos IoT"],
        answer: 1,
      },
      {
        question: "¿Qué es un 'botnet'?",
        options: ["Una red privada virtual segura", "Una red de equipos comprometidos controlados por un atacante", "Un sistema de detección de intrusiones basado en IA", "Un protocolo de comunicación cifrada"],
        answer: 1,
      },
      {
        question: "El vector de ataque más común para la distribución de ransomware es:",
        options: ["Exploits físicos en hardware", "Emails con adjuntos maliciosos o enlaces de phishing", "Ataques de fuerza bruta a SSH", "Vulnerabilidades en protocolos de enrutamiento"],
        answer: 1,
      },
      {
        question: "¿Qué es un ataque de 'watering hole'?",
        options: ["Un ataque que inunda una red con tráfico UDP", "Comprometer un sitio web que visitan frecuentemente las víctimas objetivo", "Un tipo de ataque de fuerza bruta a contraseñas", "Un método de exfiltración de datos por DNS"],
        answer: 1,
      },
      {
        question: "La técnica de 'credential stuffing' consiste en:",
        options: ["Crear contraseñas muy largas y complejas", "Usar credenciales filtradas en una brecha para intentar acceder a otros servicios", "Robar tokens de sesión mediante XSS", "Interceptar hashes de contraseñas en la red"],
        answer: 1,
      },
      {
        question: "¿Cuál es la diferencia entre un virus y un gusano (worm)?",
        options: ["No hay diferencia técnica entre ambos", "El virus necesita un archivo huésped; el gusano se propaga solo por la red", "El gusano cifra archivos; el virus los elimina", "El virus afecta redes; el gusano solo afecta archivos locales"],
        answer: 1,
      },
      {
        question: "Un ataque de 'privilege escalation' busca:",
        options: ["Obtener mayores permisos dentro de un sistema ya comprometido", "Escalar la severidad de una alerta en el SIEM", "Aumentar el tráfico de red para saturar un servidor", "Elevar la prioridad de un ticket de incidente"],
        answer: 0,
      },
      {
        question: "¿Qué es la 'exfiltración de datos' en el contexto de un ataque?",
        options: ["La eliminación permanente de datos del sistema", "La transferencia no autorizada de datos desde la organización hacia el atacante", "El cifrado de datos para evitar su lectura", "La corrupción intencional de bases de datos"],
        answer: 1,
      },
      {
        question: "Los ataques de 'supply chain' comprometen:",
        options: ["La cadena de frío de equipos físicos", "Software o hardware legítimo durante su desarrollo o distribución", "Proveedores de servicios de logística", "Sistemas de control industrial exclusivamente"],
        answer: 1,
      },
      {
        question: "¿Qué caracteriza a un APT (Advanced Persistent Threat)?",
        options: ["Son ataques rápidos y masivos sin un objetivo específico", "Son actores con recursos avanzados que mantienen acceso prolongado y sigiloso", "Son vulnerabilidades zero-day sin explotar", "Son ataques automatizados de baja sofisticación"],
        answer: 1,
      },
    ],
  },

  // ── MÓDULO 3: Herramientas SOC ────────────────────────────────────────────
  {
    type:        "video",
    title:       "Módulo 3 — Herramientas del analista",
    description: "SIEM, IDS/IPS, threat intelligence y plataformas de respuesta.",
    src: videoCurso
  },
  {
    type:    "pdf",
    title:   "Material de lectura — Splunk y análisis de logs",
    pdfSrc: "/public/pdf/prueba.pdf",
    pages:   22,
  },
  {
    type:  "quiz",
    title: "Quiz — Módulo 3",
    questions: [
      {
        question: "¿Para qué se utiliza principalmente Splunk en un SOC?",
        options: ["Escaneo de puertos", "Análisis y correlación de logs", "Gestión de parches", "Creación de VPNs"],
        answer: 1,
      },
      {
        question: "Un IDS (Intrusion Detection System) principalmente:",
        options: ["Bloquea ataques automáticamente", "Detecta y alerta sobre actividad sospechosa", "Encripta el tráfico de red", "Gestiona contraseñas"],
        answer: 1,
      },
      {
        question: "¿Qué es la Threat Intelligence?",
        options: ["Un antivirus avanzado", "Información sobre amenazas para mejorar la defensa", "Un firewall de nueva generación", "Un protocolo de red seguro"],
        answer: 1,
      },
      {
        question: "¿Cuál es la función de Wireshark en un análisis de seguridad?",
        options: ["Gestionar vulnerabilidades conocidas", "Capturar y analizar tráfico de red en tiempo real", "Administrar reglas de firewall", "Generar reportes de cumplimiento"],
        answer: 1,
      },
      {
        question: "En Splunk, una 'search query' se escribe usando:",
        options: ["Python puro", "SPL (Search Processing Language)", "SQL estándar", "PowerShell exclusivamente"],
        answer: 1,
      },
      {
        question: "¿Qué es un SOAR (Security Orchestration, Automation and Response)?",
        options: ["Un tipo de firewall de aplicaciones web", "Una plataforma que automatiza y orquesta respuestas a incidentes", "Un estándar de cifrado para comunicaciones", "Un sistema de gestión de identidades"],
        answer: 1,
      },
      {
        question: "La herramienta Nmap se utiliza principalmente para:",
        options: ["Analizar malware en entornos sandbox", "Descubrir hosts y servicios activos en una red", "Gestionar certificados SSL/TLS", "Monitorear el rendimiento de aplicaciones"],
        answer: 1,
      },
      {
        question: "¿Qué tipo de logs genera un firewall que son útiles para un analista SOC?",
        options: ["Logs de rendimiento de CPU", "Logs de conexiones permitidas y bloqueadas por regla", "Logs de actualizaciones del sistema operativo", "Logs de cambios en archivos de configuración de red"],
        answer: 1,
      },
      {
        question: "Un 'sandbox' en el análisis de malware es:",
        options: ["Un servidor de producción aislado", "Un entorno controlado y aislado para ejecutar código sospechoso sin riesgo", "Un tipo de honeypot activo", "Una red privada virtual segmentada"],
        answer: 1,
      },
      {
        question: "¿Qué significa EDR en el contexto de herramientas de seguridad?",
        options: ["External Defense Router", "Endpoint Detection and Response", "Encrypted Data Repository", "Event Driven Reporting"],
        answer: 1,
      },
      {
        question: "La plataforma TheHive se utiliza en un SOC para:",
        options: ["Análisis de tráfico de red", "Gestión colaborativa de casos e incidentes de seguridad", "Escaneo de vulnerabilidades web", "Administración de identidades y accesos"],
        answer: 1,
      },
      {
        question: "¿Cuál es la diferencia entre un SIEM y un EDR?",
        options: ["Son la misma tecnología con diferente nombre", "El SIEM agrega y correlaciona logs de toda la infraestructura; el EDR monitorea endpoints específicamente", "El EDR trabaja en la nube y el SIEM on-premise", "El SIEM detecta malware; el EDR gestiona parches"],
        answer: 1,
      },
      {
        question: "En el análisis de logs, una anomalía de comportamiento (UEBA) detecta:",
        options: ["Firmas de malware conocido", "Comportamientos inusuales de usuarios o entidades respecto a su línea base", "Vulnerabilidades en código fuente", "Configuraciones inseguras de red"],
        answer: 1,
      },
      {
        question: "¿Qué es un 'feed' de Threat Intelligence?",
        options: ["Un informe ejecutivo de seguridad mensual", "Un flujo continuo de datos sobre indicadores de amenazas actuales", "Un dashboard de métricas del SOC", "Un log de auditoría de accesos"],
        answer: 1,
      },
      {
        question: "La herramienta Volatility se utiliza para:",
        options: ["Análisis de tráfico de red capturado", "Análisis forense de volcados de memoria RAM", "Gestión de reglas de detección en el SIEM", "Monitoreo de disponibilidad de servicios"],
        answer: 1,
      },
      {
        question: "¿Qué protocolo usa syslog por defecto para el transporte de logs?",
        options: ["TCP 443", "UDP 514", "TCP 8080", "UDP 1514"],
        answer: 1,
      },
      {
        question: "En una plataforma SIEM, una 'regla de correlación' sirve para:",
        options: ["Cifrar los logs almacenados", "Definir condiciones que, al cumplirse, generan una alerta de seguridad", "Comprimir los logs para ahorrar espacio", "Enviar logs a un servidor de backup"],
        answer: 1,
      },
      {
        question: "¿Qué es MISP en el ecosistema de herramientas de un SOC?",
        options: ["Un SIEM de código abierto", "Una plataforma open source para compartir y correlacionar indicadores de amenazas", "Un escáner de vulnerabilidades web", "Un sistema de ticketing para incidentes"],
        answer: 1,
      },
      {
        question: "El análisis de 'NetFlow' en un SOC permite:",
        options: ["Leer el contenido de los paquetes de red", "Visualizar patrones de tráfico sin acceder al contenido de los paquetes", "Bloquear tráfico malicioso en tiempo real", "Cifrar comunicaciones entre endpoints"],
        answer: 1,
      },
      {
        question: "¿Cuál es la ventaja principal de integrar un SOAR con un SIEM?",
        options: ["Reducir el costo de licencias de software", "Automatizar respuestas a incidentes repetitivos y reducir el tiempo de respuesta", "Mejorar la compresión de logs almacenados", "Reemplazar al analista Tier 1 completamente"],
        answer: 1,
      },
    ],
  },

  // ── MÓDULO 4: Respuesta a Incidentes ──────────────────────────────────────
  {
    type:        "video",
    title:       "Módulo 4 — Respuesta a incidentes",
    description: "Metodología de triage, contención, erradicación y recuperación.",
    src: videoCurso
  },
  {
    type:    "pdf",
    title:   "Material de lectura — Playbooks de respuesta",
    pdfSrc: "/public/pdf/prueba.pdf",
    pages:   16,
  },
  {
    type:  "quiz",
    title: "Quiz — Módulo 4",
    questions: [
      {
        question: "¿Cuál es la primera fase de la respuesta a incidentes?",
        options: ["Contención", "Erradicación", "Identificación / Triage", "Recuperación"],
        answer: 2,
      },
      {
        question: "Un playbook de seguridad es:",
        options: ["Un manual de instalación de software", "Un procedimiento documentado para responder a tipos específicos de incidentes", "Un informe de auditoría", "Un protocolo de red"],
        answer: 1,
      },
      {
        question: "Durante la fase de 'Lecciones aprendidas' se busca:",
        options: ["Aislar los sistemas comprometidos", "Eliminar el malware", "Documentar el incidente y mejorar procesos", "Restaurar backups"],
        answer: 2,
      },
      {
        question: "¿Cuál es el objetivo de la fase de 'contención' en la respuesta a incidentes?",
        options: ["Eliminar completamente la amenaza del sistema", "Limitar el alcance y propagación del incidente sin perder evidencia", "Restaurar los sistemas a su estado normal", "Notificar a los medios de comunicación"],
        answer: 1,
      },
      {
        question: "La cadena de custodia en un incidente de seguridad se refiere a:",
        options: ["La cadena de mando para escalar incidentes", "El registro documentado de quién accedió a la evidencia digital y cuándo", "El orden cronológico de los eventos del ataque", "El proceso de notificación a clientes afectados"],
        answer: 1,
      },
      {
        question: "¿Qué es un 'post-mortem' de incidente?",
        options: ["El análisis forense del malware utilizado", "Una reunión de análisis posterior al incidente para identificar mejoras", "El proceso de recuperación de sistemas dañados", "La notificación legal a autoridades competentes"],
        answer: 1,
      },
      {
        question: "Durante la fase de 'erradicación', el equipo de respuesta debe:",
        options: ["Aislar los sistemas afectados de la red", "Eliminar la causa raíz del incidente y todos los artefactos maliciosos", "Notificar a los usuarios sobre el incidente", "Documentar el timeline del ataque"],
        answer: 1,
      },
      {
        question: "¿Qué es el 'triage' en el contexto de respuesta a incidentes?",
        options: ["La restauración de sistemas desde backup", "La priorización y evaluación inicial de la severidad y alcance del incidente", "La eliminación de malware de los sistemas", "La comunicación del incidente a la dirección"],
        answer: 1,
      },
      {
        question: "Un 'IOA' (Indicator of Attack) se diferencia de un IOC porque:",
        options: ["El IOA describe artefactos ya comprometidos; el IOC detecta actividad en curso", "El IOA detecta comportamientos que sugieren un ataque en progreso; el IOC son evidencias post-compromiso", "El IOA aplica solo a redes; el IOC solo a endpoints", "No hay diferencia práctica entre ambos"],
        answer: 1,
      },
      {
        question: "¿Cuál de los siguientes es un ejemplo de 'contención a largo plazo'?",
        options: ["Desconectar físicamente un equipo comprometido", "Aplicar parches de seguridad y reforzar controles para prevenir la recurrencia", "Capturar el tráfico de red del atacante", "Cambiar temporalmente las contraseñas de administrador"],
        answer: 1,
      },
      {
        question: "El framework NIST SP 800-61 define el ciclo de vida de respuesta a incidentes con las fases:",
        options: ["Identificar, Proteger, Detectar, Responder, Recuperar", "Preparación, Detección y Análisis, Contención-Erradicación-Recuperación, Actividades post-incidente", "Reconocimiento, Explotación, Post-explotación, Cleanup", "Triage, Investigación, Remediación, Cierre"],
        answer: 1,
      },
      {
        question: "¿Qué es el 'forensic imaging' en una investigación de incidentes?",
        options: ["Tomar capturas de pantalla del sistema comprometido", "Crear una copia bit a bit exacta de un disco o dispositivo de almacenamiento", "Analizar imágenes adjuntas en emails de phishing", "Generar reportes visuales del incidente"],
        answer: 1,
      },
      {
        question: "La volatilidad de la evidencia digital determina:",
        options: ["Cuánto tiempo se tarda en analizar un incidente", "El orden en que se debe recolectar la evidencia, priorizando la más efímera", "La severidad del incidente en el SIEM", "El tipo de herramienta forense a utilizar"],
        answer: 1,
      },
      {
        question: "¿Qué información debe incluir obligatoriamente un reporte de incidente?",
        options: ["Solo el listado de sistemas afectados", "Timeline, sistemas afectados, acciones tomadas, impacto y recomendaciones", "Únicamente las herramientas de ataque identificadas", "Solo la identidad del atacante si es conocida"],
        answer: 1,
      },
      {
        question: "La 'contención en corto plazo' implica típicamente:",
        options: ["Reconstruir completamente los sistemas desde cero", "Aislar sistemas afectados inmediatamente para detener la propagación", "Aplicar todos los parches de seguridad pendientes", "Realizar un análisis forense completo del malware"],
        answer: 1,
      },
      {
        question: "¿Cuándo se considera que un incidente está 'cerrado'?",
        options: ["Cuando el malware fue identificado", "Cuando los sistemas fueron aislados de la red", "Cuando la causa raíz fue eliminada, los sistemas restaurados y el post-mortem documentado", "Cuando el atacante fue identificado públicamente"],
        answer: 2,
      },
      {
        question: "En la fase de recuperación, la prioridad es:",
        options: ["Identificar al responsable del ataque", "Restaurar los sistemas a operación normal verificando que estén libres de amenazas", "Publicar un comunicado de prensa sobre el incidente", "Actualizar las reglas del firewall perimetral"],
        answer: 1,
      },
      {
        question: "¿Qué es el 'escalamiento' en la gestión de incidentes?",
        options: ["Aumentar la gravedad de la alerta en el SIEM", "Transferir el incidente a un nivel superior o especialista cuando excede las capacidades actuales", "Expandir el alcance de la investigación forense", "Notificar al equipo de desarrollo sobre vulnerabilidades encontradas"],
        answer: 1,
      },
      {
        question: "La clasificación de la severidad de un incidente se basa en:",
        options: ["El tipo de malware identificado únicamente", "El impacto potencial al negocio, la cantidad de sistemas afectados y la sensibilidad de los datos", "La hora en que ocurrió el incidente", "La velocidad de respuesta del equipo SOC"],
        answer: 1,
      },
      {
        question: "¿Cuál es el rol del CISO durante un incidente crítico?",
        options: ["Realizar el análisis forense técnico del malware", "Tomar decisiones estratégicas, comunicar a la dirección y coordinar con áreas legales y de comunicación", "Ejecutar los comandos de contención en los sistemas", "Redactar las reglas de detección en el SIEM"],
        answer: 1,
      },
    ],
  },
];

const TOTAL_STEPS = COURSE_STEPS.length;
const PASSING_SCORE = 0.70;

// ══════════════════════════════════════════════════════════════════════════════
//  TIPOS
// ══════════════════════════════════════════════════════════════════════════════
interface QuizResult {
  score:         number;
  passed:        boolean;
  attempts:      number;
  lastAttemptAt: string;
}

interface Progress {
  _id:            string;
  currentStep:    number;
  completedSteps: number[];
  quizResults:    Record<string, QuizResult>;
  startedAt:      string;
  completedAt:    string | null;
  isCompleted:    boolean;
}

// ══════════════════════════════════════════════════════════════════════════════
//  SUB-COMPONENTES
// ══════════════════════════════════════════════════════════════════════════════

// ── Barra de progreso ─────────────────────────────────────────────────────────
function ProgressBar({ completed, total }: { completed: number; total: number }) {
  const pct = Math.round((completed / total) * 100);
  return (
    <div className="sc-progress-wrap">
      <div className="sc-progress-bar">
        <div className="sc-progress-fill" style={{ width: `${pct}%` }} />
      </div>
      <span className="sc-progress-label">{pct}% completado · {completed}/{total} etapas</span>
    </div>
  );
}

// ── Sidebar de navegación ─────────────────────────────────────────────────────
function CourseSidebar({
  steps, currentStep, completedSteps, onNavigate,
}: {
  steps: CourseStep[];
  currentStep: number;
  completedSteps: number[];
  onNavigate: (i: number) => void;
}) {
  const icons: Record<CourseStep["type"], string> = {
    intro: "◈", video: "▶", pdf: "📄", quiz: "✎",
  };

  return (
    <aside className="sc-sidebar">
      <p className="sc-sidebar-title">// CONTENIDO</p>
      <ul className="sc-sidebar-list">
        {steps.map((step, i) => {
          const done    = completedSteps.includes(i);
          const active  = i === currentStep;
          const locked  = i > currentStep && !done;
          return (
            <li
              key={i}
              className={`sc-sidebar-item${active ? " active" : ""}${done ? " done" : ""}${locked ? " locked" : ""}`}
              onClick={() => !locked && onNavigate(i)}
              title={locked ? "Completá la etapa anterior para desbloquear" : step.title}
            >
              <span className="sc-sidebar-icon">{done ? "✓" : icons[step.type]}</span>
              <span className="sc-sidebar-label">{step.title}</span>
            </li>
          );
        })}
      </ul>
    </aside>
  );
}

// ── Viewer de Video ───────────────────────────────────────────────────────────
function VideoViewer({ src, title }: { src: string; title: string }) {
  return (
    <div className="sc-video-wrap">
      <video
        className="sc-video"
        controls
        controlsList="nodownload"
        onContextMenu={(e) => e.preventDefault()}
        preload="metadata"
      >
        <source src={src} type="video/mp4" />
        Tu navegador no soporta reproducción de video.
      </video>
    </div>
  );
}

// ── Viewer de PDF (react-pdf — canvas nativo, sin iframe, sin bloqueos) ───────
function PdfViewer({ src }: { src: string }) {
  const [numPages,  setNumPages]  = useState<number>(0);
  const [page,      setPage]      = useState(1);
  const [loading,   setLoading]   = useState(true);
  const [error,     setError]     = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(700);

  // Ancho responsivo: mide el contenedor y ajusta el canvas
  useEffect(() => {
    if (!wrapRef.current) return;
    const obs = new ResizeObserver(([entry]) => {
      setWidth(Math.floor(entry.contentRect.width));
    });
    obs.observe(wrapRef.current);
    setWidth(wrapRef.current.offsetWidth || 700);
    return () => obs.disconnect();
  }, []);

  const onLoadSuccess = ({ numPages }: { numPages: number }) => {
    setNumPages(numPages);
    setLoading(false);
  };

  const onLoadError = () => {
    setLoading(false);
    setError(true);
  };

  if (error) {
    return (
      <div className="sc-pdf-error">
        <span>No se pudo cargar el PDF.</span>
        <span style={{ fontSize: "0.72rem", opacity: 0.5 }}>
          Verificá que el archivo esté en <code>public/</code>.
        </span>
      </div>
    );
  }

  return (
    <div className="sc-pdf-wrap">
      <div className="sc-pdf-canvas-container" ref={wrapRef}>
        {loading && (
          <div className="sc-pdf-loading">
            <span className="sc-loading-dot" />
            <span className="sc-loading-dot" />
            <span className="sc-loading-dot" />
          </div>
        )}
        <Document
          file={src}
          onLoadSuccess={onLoadSuccess}
          onLoadError={onLoadError}
          loading=""
          // Deshabilitar descarga — react-pdf no expone botón de descarga por defecto
        >
          <Page
            pageNumber={page}
            width={width > 0 ? width : 700}
            renderTextLayer={false}     // sin capa de texto seleccionable
            renderAnnotationLayer={false} // sin links clicables del PDF
          />
        </Document>
      </div>

      {numPages > 0 && (
        <div className="sc-pdf-pagination">
          <button
            className="sc-pdf-page-btn"
            onClick={() => setPage(p => Math.max(1, p - 1))}
            disabled={page === 1}
          >
            ← ANTERIOR
          </button>
          <span className="sc-pdf-page-info">Página {page} / {numPages}</span>
          <button
            className="sc-pdf-page-btn"
            onClick={() => setPage(p => Math.min(numPages, p + 1))}
            disabled={page === numPages}
          >
            SIGUIENTE →
          </button>
        </div>
      )}
    </div>
  );
}

// ── Quiz ──────────────────────────────────────────────────────────────────────
function QuizViewer({
  questions, stepIndex, existingResult, onSubmit,
}: {
  questions:      QuizQuestion[];
  stepIndex:      number;
  existingResult: QuizResult | null;
  onSubmit:       (score: number, passed: boolean) => Promise<void>;
}) {
  const [answers,    setAnswers]    = useState<Record<number, number>>({});
  const [submitted,  setSubmitted]  = useState(false);
  const [score,      setScore]      = useState<number | null>(null);
  const [attempts,   setAttempts]   = useState(existingResult?.attempts ?? 0);
  const [saving,     setSaving]     = useState(false);

  // Si ya tiene resultado previo aprobado, mostrar resultado
  const [showPrior,  setShowPrior]  = useState(!!existingResult?.passed);

  const handleSelect = (qIdx: number, aIdx: number) => {
    if (submitted) return;
    setAnswers(prev => ({ ...prev, [qIdx]: aIdx }));
  };

  const handleSubmit = async () => {
    if (Object.keys(answers).length < questions.length) return;

    let correct = 0;
    questions.forEach((q, i) => { if (answers[i] === q.answer) correct++; });
    const sc     = correct / questions.length;
    const passed = sc >= PASSING_SCORE;

    setScore(sc);
    setSubmitted(true);
    setAttempts(prev => prev + 1);
    setSaving(true);
    await onSubmit(sc, passed);
    setSaving(false);
  };

  const handleRetry = () => {
    setAnswers({});
    setSubmitted(false);
    setScore(null);
    setShowPrior(false);
  };

  if (showPrior && existingResult) {
    return (
      <div className="sc-quiz-result sc-quiz-result--passed">
        <span className="sc-quiz-result-icon">✓</span>
        <p className="sc-quiz-result-score">
          Aprobado con {Math.round(existingResult.score * 100)}%
        </p>
        <p className="sc-quiz-result-sub">
          Intentos: {existingResult.attempts} · Podés continuar al siguiente módulo.
        </p>
        <button className="sc-btn sc-btn--ghost" onClick={handleRetry}>
          Reintentar de todas formas
        </button>
      </div>
    );
  }

  if (submitted && score !== null) {
    const passed = score >= PASSING_SCORE;
    return (
      <div className={`sc-quiz-result${passed ? " sc-quiz-result--passed" : " sc-quiz-result--failed"}`}>
        <span className="sc-quiz-result-icon">{passed ? "✓" : "✗"}</span>
        <p className="sc-quiz-result-score">
          {Math.round(score * 100)}% — {passed ? "APROBADO" : "NO APROBADO"}
        </p>
        <p className="sc-quiz-result-sub">
          {passed
            ? "¡Excelente! Podés continuar al siguiente módulo."
            : `Necesitás al menos ${Math.round(PASSING_SCORE * 100)}% para aprobar. Intentá de nuevo.`
          }
        </p>
        <p className="sc-quiz-attempts">Intento #{attempts}</p>
        {/* Revisión de respuestas */}
        <div className="sc-quiz-review">
          {questions.map((q, i) => {
            const userAns    = answers[i];
            const isCorrect  = userAns === q.answer;
            return (
              <div key={i} className={`sc-quiz-review-item${isCorrect ? " correct" : " wrong"}`}>
                <p className="sc-quiz-review-q">{i + 1}. {q.question}</p>
                <p className="sc-quiz-review-a">
                  Tu respuesta: <strong>{q.options[userAns] ?? "—"}</strong>
                  {!isCorrect && <span className="sc-quiz-review-correct"> · Correcta: {q.options[q.answer]}</span>}
                </p>
              </div>
            );
          })}
        </div>
        {!passed && (
          <button className="sc-btn sc-btn--accent" onClick={handleRetry}>
            REINTENTAR
          </button>
        )}
        {saving && <p className="sc-quiz-saving">Guardando resultado...</p>}
      </div>
    );
  }

  return (
    <div className="sc-quiz-wrap">
      <p className="sc-quiz-subtitle">
        Respondé todas las preguntas para aprobar. Mínimo {Math.round(PASSING_SCORE * 100)}%.
        {attempts > 0 && <span className="sc-quiz-attempts"> · Intentos anteriores: {attempts}</span>}
      </p>
      {questions.map((q, qIdx) => (
        <div key={qIdx} className="sc-quiz-question">
          <p className="sc-quiz-q-text">{qIdx + 1}. {q.question}</p>
          <div className="sc-quiz-options">
            {q.options.map((opt, aIdx) => (
              <button
                key={aIdx}
                className={`sc-quiz-option${answers[qIdx] === aIdx ? " selected" : ""}`}
                onClick={() => handleSelect(qIdx, aIdx)}
              >
                <span className="sc-quiz-option-letter">
                  {String.fromCharCode(65 + aIdx)}
                </span>
                {opt}
              </button>
            ))}
          </div>
        </div>
      ))}
      <button
        className="sc-btn sc-btn--accent"
        onClick={handleSubmit}
        disabled={Object.keys(answers).length < questions.length}
      >
        ENVIAR RESPUESTAS
      </button>
    </div>
  );
}

// ── Pantalla de finalización ──────────────────────────────────────────────────
function CompletionScreen({ startedAt, completedAt }: { startedAt: string; completedAt: string }) {
  const start    = new Date(startedAt);
  const end      = new Date(completedAt);
  const msTotal  = end.getTime() - start.getTime();
  const days     = Math.floor(msTotal / (1000 * 60 * 60 * 24));
  const hours    = Math.floor((msTotal % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));

  const fmt = (d: Date) => d.toLocaleDateString("es-AR", { day: "2-digit", month: "long", year: "numeric" });

  return (
    <div className="sc-completion">
      <div className="sc-completion-badge">✓</div>
      <h2 className="sc-completion-title">¡CURSADA COMPLETADA!</h2>
      <p className="sc-completion-sub">
        Completaste el programa <strong>SOC Analyst Level 1</strong> de Hidden Security.
      </p>
      <div className="sc-completion-dates">
        <div className="sc-completion-date-item">
          <span className="sc-completion-date-label">// INICIO</span>
          <span className="sc-completion-date-value">{fmt(start)}</span>
        </div>
        <div className="sc-completion-date-sep">→</div>
        <div className="sc-completion-date-item">
          <span className="sc-completion-date-label">// FINALIZACIÓN</span>
          <span className="sc-completion-date-value">{fmt(end)}</span>
        </div>
      </div>
      <p className="sc-completion-duration">
        Duración total: <strong>{days > 0 ? `${days} días` : ""}{days > 0 && hours > 0 ? " y " : ""}{hours > 0 ? `${hours} horas` : days === 0 ? "menos de 1 hora" : ""}</strong>
      </p>
      <div className="sc-completion-msg">
        <p>
          Ya estás apto/a para rendir la <strong>Certificación Hidden Security SOC Analyst</strong>.
          Este es el primer paso de tu carrera profesional como analista de seguridad.
        </p>
        <p>
          Accedé a la bolsa de trabajo y empezá a construir tu camino en ciberseguridad.
        </p>
      </div>
      <a href="/dashboard?tab=bolsa" className="sc-btn sc-btn--accent sc-btn--lg">
        VER BOLSA DE TRABAJO →
      </a>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
//  COMPONENTE PRINCIPAL
// ══════════════════════════════════════════════════════════════════════════════
export default function Soc1Course() {
  const { user }  = UseSession();
  const { theme } = UseTheme();

  const [progress,    setProgress]    = useState<Progress | null>(null);
  const [loading,     setLoading]     = useState(true);
  const [blocked,     setBlocked]     = useState(false);
  const [blockMsg,    setBlockMsg]    = useState("");
  const [saving,      setSaving]      = useState(false);
  const [activeStep,  setActiveStep]  = useState(0);
  const [showIntro,   setShowIntro]   = useState(true);

  const contentRef = useRef<HTMLDivElement>(null);

  // ── Cargar progreso desde backend (también valida membresía) ─────────────
  const fetchProgress = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const { data } = await axios.get(
        `${import.meta.env.VITE_API_URL}/api/course/${COURSE_ID}/progress`,
        { withCredentials: true }
      );
      setProgress(data.data);
      setActiveStep(data.data.currentStep ?? 0);
      setBlocked(false);
    } catch (err: any) {
      if (err.response?.status === 403) {
        setBlocked(true);
        setBlockMsg(err.response.data?.detail ?? "Necesitás una membresía activa.");
      }
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => { fetchProgress(); }, [fetchProgress]);

  // ── Scroll al top del contenido al cambiar step ──────────────────────────
  useEffect(() => {
    contentRef.current?.scrollTo({ top: 0, behavior: "smooth" });
  }, [activeStep]);

  // ── Avanzar step (video / pdf / intro) ───────────────────────────────────
  const handleNext = async () => {
    if (!progress || saving) return;
    setSaving(true);
    try {
      const { data } = await axios.patch(
        `${import.meta.env.VITE_API_URL}/api/course/${COURSE_ID}/progress/step`,
        { stepIndex: activeStep, totalSteps: TOTAL_STEPS },
        { withCredentials: true }
      );
      setProgress(data.data);
      const nextStep = Math.min(activeStep + 1, TOTAL_STEPS - 1);
      setActiveStep(nextStep);
    } catch (err) {
      console.error("Error guardando step:", err);
    } finally {
      setSaving(false);
    }
  };

  // ── Guardar resultado del quiz ────────────────────────────────────────────
  const handleQuizSubmit = async (score: number, passed: boolean) => {
    if (!progress) return;
    try {
      const { data } = await axios.patch(
        `${import.meta.env.VITE_API_URL}/api/course/${COURSE_ID}/progress/quiz`,
        {
          stepIndex: activeStep,
          score,
          attempts: (progress.quizResults?.[String(activeStep)]?.attempts ?? 0) + 1,
        },
        { withCredentials: true }
      );
      setProgress(data.data);
    } catch (err) {
      console.error("Error guardando quiz:", err);
    }
  };

  // ── ¿El botón "Siguiente" está disponible? ────────────────────────────────
  const canAdvance = useCallback(() => {
    if (!progress) return false;
    const step = COURSE_STEPS[activeStep];
    if (!step) return false;

    // Si es quiz, solo puede avanzar si está aprobado
    if (step.type === "quiz") {
      const result = progress.quizResults?.[String(activeStep)];
      return !!result?.passed;
    }

    // Para video / pdf / intro siempre puede avanzar (el usuario controla)
    return true;
  }, [progress, activeStep]);

  const isLastStep = activeStep === TOTAL_STEPS - 1;
  const step       = COURSE_STEPS[activeStep];

  // ─────────────────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className={`sc-wrap ${theme}`}>
        <div className="sc-loading">
          <span className="sc-loading-dot" />
          <span className="sc-loading-dot" />
          <span className="sc-loading-dot" />
        </div>
      </div>
    );
  }

  // ── Sin membresía ─────────────────────────────────────────────────────────
  if (blocked) {
    return (
      <div className={`sc-wrap ${theme}`}>
        <div className="sc-blocked">
          <span className="sc-blocked-icon">🔒</span>
          <span className="sc-blocked-eyebrow">// ACCESO_RESTRINGIDO</span>
          <h2 className="sc-blocked-title">Membresía requerida</h2>
          <p className="sc-blocked-msg">{blockMsg}</p>
          <a href="/pricing" className="sc-btn sc-btn--accent sc-btn--lg">
            COMPRAR MEMBRESÍA
          </a>
        </div>
      </div>
    );
  }

  // ── Curso completado ──────────────────────────────────────────────────────
  if (progress?.isCompleted) {
    return (
      <div className={`sc-wrap ${theme}`}>
        <CompletionScreen
          startedAt={progress.startedAt}
          completedAt={progress.completedAt!}
        />
      </div>
    );
  }

  // ── Pantalla introductoria (antes de empezar) ─────────────────────────────
  if (showIntro && progress && progress.currentStep === 0 && progress.completedSteps.length === 0) {
    return (
      <div className={`sc-wrap ${theme}`}>
        <div className="sc-intro-page">
          <span className="sc-eyebrow">// SOC_ANALYST_LEVEL_1</span>
          <h1 className="sc-intro-title">
            Convertite en<br /><span>SOC Analyst</span>
          </h1>

          <div className="sc-intro-grid">
            <div className="sc-intro-card">
              <span className="sc-intro-card-icon">🛡️</span>
              <h3>¿Qué es un SOC Analyst?</h3>
              <p>Un analista de Centros de Operaciones de Seguridad (SOC) es el profesional encargado de monitorear, detectar y responder a incidentes de ciberseguridad en tiempo real. Es la primera línea de defensa de una organización contra amenazas digitales.</p>
            </div>
            <div className="sc-intro-card">
              <span className="sc-intro-card-icon">🔍</span>
              <h3>¿A qué se dedica?</h3>
              <p>Analiza alertas de seguridad, investiga anomalías en sistemas y redes, correlaciona eventos en plataformas SIEM, ejecuta playbooks de respuesta a incidentes y documenta hallazgos para mejorar la postura de seguridad.</p>
            </div>
            <div className="sc-intro-card">
              <span className="sc-intro-card-icon">🎯</span>
              <h3>¿Por qué cursarlo?</h3>
              <p>La demanda de analistas SOC creció más del 300% en los últimos 5 años. Es una de las posiciones más buscadas en ciberseguridad, con salarios competitivos y posibilidades reales de crecimiento hacia roles de pentesting, threat hunting e IR.</p>
            </div>
            <div className="sc-intro-card">
              <span className="sc-intro-card-icon">🚀</span>
              <h3>Salidas laborales</h3>
              <p>SOC Analyst Tier 1/2/3, Incident Responder, Threat Hunter, Security Engineer, CISO. Empleadores: bancos, telecomunicaciones, empresas tecnológicas, gobierno, consultoras de ciberseguridad y proveedores MSSPs.</p>
            </div>
          </div>

          <div className="sc-intro-details">
            <div className="sc-intro-detail-item">
              <span className="sc-intro-detail-label">// MÓDULOS</span>
              <span className="sc-intro-detail-value">4</span>
            </div>
            <div className="sc-intro-detail-item">
              <span className="sc-intro-detail-label">// VIDEOS</span>
              <span className="sc-intro-detail-value">{COURSE_STEPS.filter(s => s.type === "video").length}</span>
            </div>
            <div className="sc-intro-detail-item">
              <span className="sc-intro-detail-label">// PDFs</span>
              <span className="sc-intro-detail-value">{COURSE_STEPS.filter(s => s.type === "pdf").length}</span>
            </div>
            <div className="sc-intro-detail-item">
              <span className="sc-intro-detail-label">// QUIZZES</span>
              <span className="sc-intro-detail-value">{COURSE_STEPS.filter(s => s.type === "quiz").length}</span>
            </div>
            <div className="sc-intro-detail-item">
              <span className="sc-intro-detail-label">// APROBACIÓN</span>
              <span className="sc-intro-detail-value">70%</span>
            </div>
          </div>

          <button
            className="sc-btn sc-btn--accent sc-btn--lg"
            onClick={() => setShowIntro(false)}
          >
            COMENZAR CURSO →
          </button>
        </div>
      </div>
    );
  }

  // ── Vista principal del curso ─────────────────────────────────────────────
  return (
    <div className={`sc-wrap ${theme}`}>

      {/* Header */}
      <div className="sc-header">
        <div>
          <span className="sc-eyebrow">// SOC_ANALYST_LEVEL_1</span>
          <h2 className="sc-header-title">{step?.title}</h2>
        </div>
        <ProgressBar
          completed={progress?.completedSteps.length ?? 0}
          total={TOTAL_STEPS}
        />
      </div>

      <div className="sc-layout">
        {/* Sidebar */}
        <CourseSidebar
          steps={COURSE_STEPS}
          currentStep={activeStep}
          completedSteps={progress?.completedSteps ?? []}
          onNavigate={setActiveStep}
        />

        {/* Contenido */}
        <div className="sc-content" ref={contentRef}>
          {step?.description && step.type !== "quiz" && (
            <p className="sc-step-description">{step.description}</p>
          )}

          {/* Intro step */}
          {step?.type === "intro" && (
            <div className="sc-step-intro">
              <p>Bienvenido/a al curso SOC Analyst Level 1. Avanzá por cada módulo a tu ritmo — tu progreso se guarda automáticamente.</p>
            </div>
          )}

          {/* Video */}
          {step?.type === "video" && step.src && (
            <VideoViewer src={step.src} title={step.title} />
          )}

          {/* PDF */}
          {step?.type === "pdf" && step.pdfSrc && (
            <PdfViewer src={step.pdfSrc} />
          )}

          {/* Quiz */}
          {step?.type === "quiz" && step.questions && (
            <QuizViewer
              questions={step.questions}
              stepIndex={activeStep}
              existingResult={progress?.quizResults?.[String(activeStep)] ?? null}
              onSubmit={handleQuizSubmit}
            />
          )}

          {/* Botón siguiente */}
          {step?.type !== "quiz" && (
            <div className="sc-nav">
              {activeStep > 0 && (
                <button
                  className="sc-btn sc-btn--ghost"
                  onClick={() => setActiveStep(prev => Math.max(0, prev - 1))}
                >
                  ← ANTERIOR
                </button>
              )}
              {!isLastStep && (
                <button
                  className="sc-btn sc-btn--accent"
                  onClick={handleNext}
                  disabled={!canAdvance() || saving}
                >
                  {saving ? "GUARDANDO..." : "SIGUIENTE →"}
                </button>
              )}
              {isLastStep && canAdvance() && (
                <button
                  className="sc-btn sc-btn--accent sc-btn--lg"
                  onClick={handleNext}
                  disabled={saving}
                >
                  {saving ? "GUARDANDO..." : "FINALIZAR CURSO ✓"}
                </button>
              )}
            </div>
          )}

          {/* En quiz, el botón siguiente aparece solo si aprobó */}
          {step?.type === "quiz" && canAdvance() && !isLastStep && (
            <div className="sc-nav">
              <button
                className="sc-btn sc-btn--accent"
                onClick={handleNext}
                disabled={saving}
              >
                {saving ? "GUARDANDO..." : "SIGUIENTE →"}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}