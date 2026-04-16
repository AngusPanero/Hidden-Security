export const COURSES_DATA = {
    "soc-operations-and-defence": {
        title: "SOC",
        subtitle: "ANALYST.",
        label: "01 // TRAINING_PROGRAM",
        intro: "Formación avanzada en operaciones de seguridad. Domina la detección, análisis y respuesta ante incidentes en infraestructuras críticas.",
        stats: { time: "120H", modules: "12", mode: "REMOTE" },
        curriculum: "Semana 1-3: Fundamentos de Networking y Seguridad Operativa. <br/> Semana 4-6: Implementación y Monitoreo con SIEM (Splunk/ELK). <br/> Semana 7-9: Threat Hunting y Análisis de Malware. <br/> Semana 10-12: Protocolos de Respuesta ante Incidentes y Reporting Senior.",
        roles: ["SOC ANALYST L1/L2", "INCIDENT RESPONDER", "THREAT HUNTER JUNIOR", "SECURITY MONITORING ENGINEER"],
        pdfName: "Hidden_Security_SOC_Analyst.pdf"
    },
    "offensive-red-teaming": {
        title: "RED",
        subtitle: "TEAMER.",
        label: "02 // TRAINING_PROGRAM",
        intro: "Especialización en simulación de adversarios y tácticas de intrusión avanzada para evaluar la resiliencia de activos críticos.",
        stats: { time: "150H", modules: "15", mode: "REMOTE" },
        curriculum: "Módulo 1: Reconocimiento y OSINT Avanzado. <br/> Módulo 2: Explotación de Perímetros y Evasión de EDR. <br/> Módulo 3: Movimiento Lateral y Persistencia. <br/> Módulo 4: Exfiltración de Datos y Simulación de Ransomware.",
        roles: ["RED TEAM OPERATOR", "PENETRATION TESTER", "ADVERSARY EMULATOR", "EXPLOIT DEVELOPER"],
        pdfName: "Hidden_Security_Red_Teaming.pdf"
    },
    "forensics-and-ir": {
        title: "DIGITAL",
        subtitle: "FORENSICS.",
        label: "03 // TRAINING_PROGRAM",
        intro: "Domina el arte de la investigación digital y la respuesta ante brechas de seguridad masivas bajo estándares forenses internacionales.",
        stats: { time: "100H", modules: "10", mode: "REMOTE" },
        curriculum: "Fase 1: Adquisición de Memoria y Disco. <br/> Fase 2: Análisis de Artefactos Windows/Linux. <br/> Fase 3: Timeline Analysis y Reconstrucción de Ataques. <br/> Fase 4: Cadena de Custodia y Peritaje Judicial.",
        roles: ["FORENSIC ANALYST", "DFIR SPECIALIST", "CYBER INVESTIGATOR", "LEGAL TECH CONSULTANT"],
        pdfName: "Hidden_Security_Forensics.pdf"
    },
    "cloud-and-devsecops": {
        title: "CLOUD",
        subtitle: "ARCHITECT.",
        label: "04 // TRAINING_PROGRAM",
        intro: "Asegura infraestructuras modernas en AWS, Azure y GCP integrando seguridad automatizada en cada paso del pipeline de desarrollo.",
        stats: { time: "130H", modules: "11", mode: "REMOTE" },
        curriculum: "Parte 1: Infrastructure as Code (Terraform) Seguro. <br/> Parte 2: Seguridad en Contenedores y Kubernetes. <br/> Parte 3: Pipelines DevSecOps y Análisis Estático/Dinámico. <br/> Parte 4: Gestión de Identidades y Secretos en la Nube.",
        roles: ["DEVSECOPS ENGINEER", "CLOUD SECURITY ARCHITECT", "SRE SPECIALIST", "PLATFORM ENGINEER"],
        pdfName: "Hidden_Security_Cloud_DevSecOps.pdf"
    },
    "malware-analysis-and-re": {
        title: "REVERSE",
        subtitle: "ENGINEER.",
        label: "05 // TRAINING_PROGRAM",
        intro: "Desensambla y comprende el comportamiento del software malicioso mediante ingeniería inversa y análisis dinámico avanzado.",
        stats: { time: "160H", modules: "14", mode: "REMOTE" },
        curriculum: "Nivel 1: Arquitectura x86/x64 y Lenguaje Ensamblador. <br/> Nivel 2: Análisis Estático y Desempaquetado de Malware. <br/> Nivel 3: Depuración y Análisis Dinámico. <br/> Nivel 4: De-obfuscation y Análisis de Shellcode.",
        roles: ["MALWARE ANALYST", "REVERSE ENGINEER", "THREAT INTELLIGENCE ANALYST", "VULNERABILITY RESEARCHER"],
        pdfName: "Hidden_Security_Malware_Analysis.pdf"
    },
    "cryptographic-engineering": {
        title: "CRYPTO",
        subtitle: "ENGINEER.",
        label: "06 // TRAINING_PROGRAM",
        intro: "Diseña e implementa sistemas de cifrado robustos y arquitecturas Zero Trust para proteger el activo más valioso: la información.",
        stats: { time: "90H", modules: "8", mode: "REMOTE" },
        curriculum: "Semana 1: Criptografía Simétrica y Asimétrica Aplicada. <br/> Semana 2: Firma Digital e Infraestructura de Clave Pública (PKI). <br/> Semana 3: Criptografía Post-Cuántica y Protocolos Modernos. <br/> Semana 4: Implementación de Modelos Zero Trust.",
        roles: ["CRYPTOGRAPHER", "SECURITY PROTOCOL ENGINEER", "BLOCKCHAIN SECURITY EXPERT", "PRIVACY ENGINEER"],
        pdfName: "Hidden_Security_Cryptographic_Eng.pdf"
    }
};