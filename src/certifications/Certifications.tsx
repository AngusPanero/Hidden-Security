import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { UseTheme } from "../contexts/ThemeContext";
import "./certifications.css";
import insigniaIR from "../../public/insignias/Insignia HS IR.png";
import insigniPEN from "../../public/insignias/Insignia HS PEN.png";
import insigniaSOC from "../../public/insignias/Insignia HS SOC.png";
import insigniaTH from "../../public/insignias/Insignia HS TH.png";
import insigniaTI from "../../public/insignias/Insignia HS TI.png";


// ─── Tipos ────────────────────────────────────────────────────────────────────
export interface CertificationData {
  slug:        string;
  name:        string;
  subtitle:    string;
  img:         string;
  difficulty:  number; // 1-5
  timeLimit:   string; // ej: "90 MIN"
  modules:     number;
  questions:   number;
  active:      boolean;
}

// ─── Datos ────────────────────────────────────────────────────────────────────
export const CERTIFICATIONS: CertificationData[] = [
  {
    slug:       "soc-analyst",
    name:       "SOC ANALYST CERTIFICATION",
    subtitle:   "Validación de habilidades para el SOC moderno",
    img: insigniaSOC,
    difficulty: 3,
    timeLimit:  "90 MIN",
    modules:    8,
    questions:  60,
    active:     true,
  },
  {
    slug:       "threat-hunting",
    name:       "THREAT HUNTING CERTIFICATION",
    subtitle:   "Evaluación de capacidades de búsqueda proactiva de amenazas.",
    img: insigniaTH,
    difficulty: 4,
    timeLimit:  "120 MIN",
    modules:    6,
    questions:  50,
    active:     false,
  },
  {
    slug:       "incident-response",
    name:       "INCIDENT RESPONSE CERTIFICATION",
    subtitle:   "Validación de competencias para la gestión técnica de incidentes de seguridad.",
    img: insigniaIR,
    difficulty: 4,
    timeLimit:  "120 MIN",
    modules:    7,
    questions:  55,
    active:     false,
  },
  {
    slug:       "threat-intelligence",
    name:       "THREAT INTELLIGENCE CERTIFICATION",
    subtitle:   "Evaluación del análisis de inteligencia, actores de amenaza y generación de inteligencia accionable.",
    img: insigniaTI,
    difficulty: 3,
    timeLimit:  "90 MIN",
    modules:    5,
    questions:  45,
    active:     false,
  },
  {
    slug:       "pentesting",
    name:       "PENTESTING CERTIFICATION",
    subtitle:   "Validación de habilidades en evaluación ofensiva de la seguridad.",
    img: insigniPEN,
    difficulty: 5,
    timeLimit:  "150 MIN",
    modules:    9,
    questions:  70,
    active:     false,
  },
];

// ─── DifficultyDots ───────────────────────────────────────────────────────────
function DifficultyDots({ level }: { level: number }) {
  return (
    <div className="cert-difficulty">
      <span className="cert-difficulty-label">DIFICULTAD</span>
      <div className="cert-dots">
        {[1, 2, 3, 4, 5].map((n) => (
          <span
            key={n}
            className={`cert-dot ${n <= level ? "cert-dot--filled" : ""}`}
          />
        ))}
      </div>
    </div>
  );
}

// ─── Certifications ───────────────────────────────────────────────────────────
const Certifications = () => {
  const { theme } = UseTheme();
  const navigate  = useNavigate();

  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  return (
    <main className={`cert-root ${theme}`}>
      <header className="cert-header">
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.8 }}
        >
          <span className="cert-label-mono">// VALIDACIÓN_PROFESIONAL</span>
          <h1 className="cert-massive-title">
            CERTIFICACIONES <br /><span className="cert-outline">HIDDEN SECURITY</span>
          </h1>
          <p className="cert-intro">
            Validá tus habilidades mediante evaluaciones prácticas diseñadas sobre escenarios reales.
            Cada certificación está desarrollada en colaboración con profesionales de la industria.
          </p>
        </motion.div>
      </header>

      <div className="cert-grid">
        {CERTIFICATIONS.map((cert, i) => (
          <motion.div
            key={cert.slug}
            className={`cert-card ${!cert.active ? "cert-card--inactive" : ""}`}
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: i * 0.08 }}
          >
            {/* Imagen */}
            <div className="cert-card-img-wrap">
              <img src={cert.img} alt={cert.name} className="cert-card-img" />
              <div className="cert-card-img-overlay" />
              {!cert.active && (
                <span className="cert-card-badge">PRÓXIMAMENTE</span>
              )}
            </div>

            {/* Body */}
            <div className="cert-card-body">
              <span className="cert-label-mono cert-label-mono--sm">
                // HIDDEN_CERTIFICATION
              </span>
              <h2 className="cert-card-title">{cert.name}</h2>
              <p className="cert-card-subtitle">{cert.subtitle}</p>

              <DifficultyDots level={cert.difficulty} />

              {/* Stats */}
              <div className="cert-stats">
                <div className="cert-stat">
                  <span className="cert-stat-value">{cert.timeLimit}</span>
                  <span className="cert-stat-label">LÍMITE_TIEMPO</span>
                </div>
                <div className="cert-stat">
                  <span className="cert-stat-value">{cert.modules}</span>
                  <span className="cert-stat-label">MÓDULOS</span>
                </div>
                <div className="cert-stat">
                  <span className="cert-stat-value">{cert.questions}</span>
                  <span className="cert-stat-label">PREGUNTAS</span>
                </div>
              </div>

              {/* Botones */}
              <div className="cert-card-actions">
                <button
                  className="cert-btn cert-btn--primary"
                  disabled={!cert.active}
                  onClick={() => cert.active && navigate("/checkout/voucher")}
                >
                  ADQUIRIR_VOUCHER [+]
                </button>
                <button
                  className="cert-btn cert-btn--secondary"
                  disabled={!cert.active}
                  onClick={() => cert.active && navigate(`/certifications/${cert.slug}`)}
                >
                  VER_DETALLE →
                </button>
              </div>
            </div>
          </motion.div>
        ))}
      </div>
    </main>
  );
};

export default Certifications;