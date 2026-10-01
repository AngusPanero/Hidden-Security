import { useState } from "react";
import { createPortal } from "react-dom";
import { Link } from "react-router-dom";
import { UseTheme } from "../contexts/ThemeContext"; 
import { UseSession } from "../contexts/SessionContext";
import ModernSocCertification from "./ModernSocCertification";
import "./certificationCatalog.css";

interface CatalogEntry {
  id:          string; // debe coincidir EXACTO con el certId del backend
  title:       string;
  subtitle:    string;
  // Card del catálogo (grilla) — mismo formato que CourseMeta en CourseCatalog
  description: string;
  tags:        string[];
  level:       string;
  duration:    string;
  status:      "available" | "soon";
  comingSoon?: string;
  component?:  React.ComponentType;
  intro: {
    icon?:        string;
    heading:     string;
    description: string;
    highlights: { icon?: string; title: string; text: string }[];
    details: { label: string; value: string }[];
  };
}

const CATALOG: CatalogEntry[] = [
  {
    id:          "modernsoc-cert",
    title:       "Modern SOC Operations",
    subtitle:    "Certificación oficial · Analista SOC",
    description: "Examen controlado y cronometrado que valida tus conocimientos reales como analista SOC — fundamentos, operaciones, detección y respuesta a incidentes.",
    tags:        ["SIEM", "Incident Response", "Threat Intel", "SOC"],
    level:       "Avanzado",
    duration:    "5 módulos",
    status:      "available",
    component: ModernSocCertification,
    intro: {
      /* icon:    "🛡️", */
      heading: "Certificación Modern SOC Operations",
      description:
        "Un examen controlado y cronometrado que valida tus conocimientos reales como analista SOC — fundamentos, operaciones, detección, respuesta a incidentes y threat intelligence. A diferencia del curso, esta certificación queda registrada con fecha, resultado y bitácora de auditoría.",
      highlights: [
        {
          /* icon: "⏱️", */
          title: "Tiempo limitado",
          text: "El examen tiene un tiempo máximo para completarse. Una vez iniciado, no se puede pausar.",
        },
        {
          /* icon: "🔒", */
          title: "Entorno controlado",
          text: "Se verifica que rindas desde una sola pantalla, sin pestañas duplicadas, en modo pantalla completa.",
        },
        {
          /* icon: "🎯", */
          title: "Nota de aprobación",
          text: "Necesitás un porcentaje mínimo de respuestas correctas para aprobar y certificarte.",
        },
        {
          /* icon: "📜", */
          title: "Certificado verificable",
          text: "El resultado queda registrado permanentemente y es visible para las empresas en tu perfil.",
        },
      ],
      details: [
        { label: "// MÓDULOS",      value: "5" },
        { label: "// PREGUNTAS",    value: "5" },
        { label: "// DISPOSITIVO",  value: "Desktop" },
        { label: "// REQUIERE",     value: "1 voucher" },
      ],
    },
  },
  {
    id:          "pentesting-cert",
    title:       "Offensive Security Fundamentals",
    subtitle:    "Certificación oficial · Pentesting",
    description: "Certificación de pentesting ofensivo — metodologías de explotación, reconocimiento y reporte de vulnerabilidades.",
    tags:        ["Pentesting", "OWASP", "Kali Linux", "Metasploit"],
    level:       "Intermedio",
    duration:    "6 módulos",
    status:      "soon",
    comingSoon:  "",
    intro: {
      /* icon: "🗡️", */
      heading: "Offensive Security Fundamentals",
      description: "Certificación de pentesting ofensivo — próximamente disponible.",
      highlights: [],
      details: [],
    },
  },
];

// Mismos colores de nivel que en CourseCatalog, para consistencia visual
const LEVEL_COLORS: Record<string, string> = {
  Inicial:    "#22c55e",
  Intermedio: "#f97316",
  Avanzado:   "#f43f5e",
};

// Cantidad de vouchers disponibles — mismo criterio que getMembershipInfo
// del UserDashboard: cada "voucher" en purchases es un intento de examen.
function countVouchers(user: any): number {
  const purchases: string[] = Array.isArray(user?.purchases) ? user.purchases : [];
  return purchases.filter((p) => p === "voucher").length;
}

export default function CertificationCatalog() {
  const { theme } = UseTheme();
  const { user }  = UseSession();
  const isLight = theme === "light";

  const voucherCount = countVouchers(user);
  const hasVoucher   = voucherCount > 0;

  const [activeCert,    setActiveCert]    = useState<CatalogEntry | null>(null);
  const [showExam,      setShowExam]      = useState(false);
  // Certificación que el usuario intentó abrir sin voucher (muestra el aviso)
  const [noVoucherCert, setNoVoucherCert] = useState<CatalogEntry | null>(null);

  // Click en una card: sin voucher no se abre la certificación
  const handleCardClick = (cert: CatalogEntry) => {
    if (cert.status === "soon") return;
    if (!hasVoucher) {
      setNoVoucherCert(cert);
      return;
    }
    setActiveCert(cert);
  };

  // ── Examen real montado (vía portal) ────────────────────────────────
  // Doble chequeo: si por algún motivo se perdió el voucher (ej. se usó en
  // otra pestaña y se refrescaron las claims), no se monta el examen.
  if (activeCert && showExam && activeCert.component && hasVoucher) {
    const ActiveComponent = activeCert.component;
    return createPortal(
      <div className={`ccx-wrap ccx-fullscreen-overlay ${isLight ? "light" : ""}`}>
        <ActiveComponent />
      </div>,
      document.body
    );
  }

  // ── Pantalla intro de la certificación elegida (vía portal) ─────────
  if (activeCert && hasVoucher) {
    const { intro } = activeCert;
    return createPortal(
      <div className={`ccx-wrap ccx-fullscreen-overlay ${isLight ? "light" : ""}`}>
        <div className="ccx-intro-page">
          <button className="ccx-back-btn" onClick={() => setActiveCert(null)}>
            ← VOLVER AL CATÁLOGO
          </button>

          <span className="ccx-eyebrow">// {activeCert.subtitle.toUpperCase()}</span>
          <h1 className="ccx-intro-title">
            {/* {intro.icon} */} {intro.heading}
          </h1>
          <p className="ccx-intro-desc">{intro.description}</p>

          {intro.highlights.length > 0 && (
            <div className="ccx-intro-grid">
              {intro.highlights.map((h) => (
                <div className="ccx-intro-card" key={h.title}>
                  {/* <span className="ccx-intro-card-icon">{h.icon}</span> */}
                  <h3>{h.title}</h3>
                  <p>{h.text}</p>
                </div>
              ))}
            </div>
          )}

          {intro.details.length > 0 && (
            <div className="ccx-intro-details">
              {intro.details.map((d) => (
                <div className="ccx-intro-detail-item" key={d.label}>
                  <span className="ccx-intro-detail-label">{d.label}</span>
                  <span className="ccx-intro-detail-value">{d.value}</span>
                </div>
              ))}
            </div>
          )}

          <button className="ccx-btn ccx-btn--accent ccx-btn--lg" onClick={() => setShowExam(true)}>
            COMENZAR CERTIFICACIÓN →
          </button>
        </div>
      </div>,
      document.body
    );
  }

  // ── Vista de grilla (catálogo) — mismo formato/diseño que CourseCatalog ──
  return (
    <div className={`ccx-wrap ${isLight ? "light" : ""}`}>
      <span className="ccx-eyebrow">// CERTIFICACIONES</span>
      <h2 className="ccx-title">Rendí tu <span>certificación</span></h2>
      <p className="ccx-subtitle">
        Validá tus conocimientos con un examen controlado y sumá una certificación real a tu perfil.
      </p>

      <div className="ccx-grid">
        {CATALOG.map((cert) => {
          const isSoon     = cert.status === "soon";
          const levelColor = LEVEL_COLORS[cert.level] ?? "#ccff00";

          return (
            <div
              key={cert.id}
              className={`ccx-card${isSoon ? " ccx-card--soon" : ""}`}
              onClick={() => handleCardClick(cert)}
            >
              {/* Badges */}
              <div className="ccx-card-badges">
                <span
                  className="ccx-badge ccx-badge--level"
                  style={{ borderColor: `${levelColor}40`, color: levelColor }}
                >
                  {cert.level}
                </span>
                {isSoon ? (
                  <span className="ccx-badge ccx-badge--soon">
                    PRÓXIMAMENTE {cert.comingSoon}
                  </span>
                ) : (
                  <span className="ccx-badge ccx-badge--available">
                    DISPONIBLE
                  </span>
                )}
              </div>

              {/* Título */}
              <div className="ccx-card-title-wrap">
                <h3 className="ccx-card-title">{cert.title}</h3>
                <p className="ccx-card-subtitle">{cert.subtitle}</p>
              </div>

              {/* Descripción */}
              <p className="ccx-card-description">{cert.description}</p>

              {/* Tags */}
              <div className="ccx-card-tags">
                {cert.tags.map(t => (
                  <span key={t} className="ccx-tag">{t}</span>
                ))}
              </div>

              {/* Footer */}
              <div className="ccx-card-footer">
                <span className="ccx-card-meta">{cert.duration}</span>
                {!isSoon ? (
                  <span className="ccx-card-cta">VER DETALLES →</span>
                ) : (
                  <span className="ccx-card-cta ccx-card-cta--soon">EN DESARROLLO</span>
                )}
              </div>

              {/* Overlay de próximamente */}
              {isSoon && (
                <div className="ccx-soon-overlay">
                  {/* <span className="ccx-soon-icon">⏳</span> */}
                  <span className="ccx-soon-label">PRÓXIMAMENTE</span>
                  {cert.comingSoon && (
                    <span className="ccx-soon-date">{cert.comingSoon}</span>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Aviso: intentó abrir una certificación sin voucher */}
      {noVoucherCert && (
        <div className="ccx-novoucher-overlay" onClick={() => setNoVoucherCert(null)}>
          <div
            className="ccx-novoucher-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="ccx-novoucher-title"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              className="ccx-novoucher-close"
              onClick={() => setNoVoucherCert(null)}
              aria-label="Cerrar"
            >
              ×
            </button>
            <span className="ccx-eyebrow">// VOUCHER_REQUERIDO</span>
            <h3 id="ccx-novoucher-title" className="ccx-novoucher-title">
              Necesitás un voucher para rendir
            </h3>
            <p className="ccx-novoucher-text">
              Para rendir <strong>{noVoucherCert.title}</strong> necesitás un voucher de certificación.
              Cada voucher equivale a un intento de examen y no tiene vencimiento.
            </p>
            <div className="ccx-novoucher-actions">
              <Link to="/checkout/voucher" className="ccx-btn ccx-btn--accent ccx-novoucher-cta">
                COMPRAR VOUCHER →
              </Link>
              <button className="ccx-btn" onClick={() => setNoVoucherCert(null)}>
                CERRAR
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}