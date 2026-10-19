import { useState, useEffect } from "react";
import axios from "axios";
import { createPortal } from "react-dom";
import { Link, useNavigate } from "react-router-dom";
import { UseTheme } from "../contexts/ThemeContext"; 
import { UseSession } from "../contexts/SessionContext";
import ModernSocCertification from "./ModernSocCertification";
import "./certificationCatalog.css";

interface CatalogEntry {
  id:          string; // debe coincidir EXACTO con el certId del backend
  slug?:       string; // slug del certificado público → /certifications/:slug/:credentialId
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
    slug:        "modernSoc",
    title:       "Modern SOC Operations",
    subtitle:    "Certificación oficial · Analista SOC",
    description: "Examen controlado y cronometrado que valida tus conocimientos reales como analista SOC — fundamentos, operaciones, detección y respuesta a incidentes.",
    tags:        ["SIEM", "Incident Response", "Threat Intel", "SOC"],
    level:       "Avanzado",
    duration:    "80 preguntas · 2 h",
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
          text: "Tenés 2 horas para completar el examen. Una vez iniciado, no se puede pausar.",
        },
        {
          /* icon: "🔒", */
          title: "Entorno controlado",
          text: "Se verifica que rindas desde una sola pantalla, sin pestañas duplicadas, en modo pantalla completa.",
        },
        {
          /* icon: "🎯", */
          title: "Nota de aprobación",
          text: "Necesitás al menos el 80% del puntaje para aprobar. Si reintentás, siempre se guarda tu mejor resultado.",
        },
        {
          /* icon: "📜", */
          title: "Certificado verificable",
          text: "El resultado queda registrado permanentemente y es visible para las empresas en tu perfil.",
        },
      ],
      details: [
        { label: "// MÓDULOS",      value: "8" },
        { label: "// PREGUNTAS",    value: "80" },
        { label: "// TIEMPO",       value: "2 h" },
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

// Resultado vigente del usuario en una certificación (GET /api/certification/summary)
interface CertSummary {
  attempts:      number;
  passed:        boolean;
  bestScore:     number;
  lastScore:     number;
  lastAttemptAt: string | null;
  passingScore:  number;
}

type Filter = "all" | "taken" | "passed" | "failed";
const FILTERS: { id: Filter; label: string }[] = [
  { id: "all",    label: "TODAS" },
  { id: "taken",  label: "RENDIDAS" },
  { id: "passed", label: "APROBADAS" },
  { id: "failed", label: "NO APROBADAS" },
];

function matchesFilter(filter: Filter, s: CertSummary | null | undefined): boolean {
  if (filter === "all")    return true;
  if (!s || s.attempts === 0) return false;
  if (filter === "taken")  return true;
  if (filter === "passed") return s.passed;
  return !s.passed; // "failed"
}

const pct = (n: number) => `${Math.round(n * 100)}%`;

// Certificado público del usuario (GET /api/certificates/mine)
interface MyCertificate {
  certId?:      string;
  credentialId: string;
  slug:         string;
  status:       "active" | "revoked";
  url:          string;
}

// Intento en curso de una certificación (GET /api/certification/:certId/status)
interface InProgressInfo {
  expiresAt: string;
}

// ms → "1:23:05" / "05:09"
function formatRemaining(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const pad = (n: number) => String(n).padStart(2, "0");
  return h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${pad(m)}:${pad(s)}`;
}

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

// ═══════════════════════════════════════════════════════════════════════════════
//  examTabSession.ts — Hidden Security
//  Identificador de la pestaña donde se rinde el examen.
// ═══════════════════════════════════════════════════════════════════════════════
const KEY = "hs-exam-tab";

export function getExamTabId(): string {
  try {
    let id = sessionStorage.getItem(KEY);
    if (!id) {
      id = typeof crypto !== "undefined" && "randomUUID" in crypto
        ? crypto.randomUUID()
        : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
      sessionStorage.setItem(KEY, id);
    }
    return id;
  } catch {
    // Sin sessionStorage (modo muy restringido): el backend no decide nada sin id
    return "";
  }
}

export default function CertificationCatalog() {
  const { theme } = UseTheme();
  const { user }  = UseSession();
  const navigate  = useNavigate();
  const isLight = theme === "light";

  const voucherCount = countVouchers(user);
  const hasVoucher   = voucherCount > 0;

  const [activeCert,    setActiveCert]    = useState<CatalogEntry | null>(null);
  const [showExam,      setShowExam]      = useState(false);
  // Certificación que el usuario intentó abrir sin voucher (muestra el aviso)
  const [noVoucherCert, setNoVoucherCert] = useState<CatalogEntry | null>(null);

  // Resultados del usuario por certificación (los calcula el backend)
  const [summaries, setSummaries] = useState<Record<string, CertSummary | null>>({});
  const [filter,    setFilter]    = useState<Filter>("all");

  // Intentos en curso por certificación (los decide el backend, no el voucher)
  const [inProgress, setInProgress] = useState<Record<string, InProgressInfo | null>>({});
  const [now,        setNow]        = useState(() => Date.now());

  // Certificado público: qué card está buscando y error por card
  const [certLoading, setCertLoading] = useState<string | null>(null);
  const [certError,   setCertError]   = useState<Record<string, string>>({});

  // Busca en la DB el certificado del usuario logueado y redirige a su página.
  // /api/certificates/mine también lo emite si aprobó antes de que existiera
  // el sistema de certificados (backfill), así que siempre se consulta al click.
  const openCertificate = async (cert: CatalogEntry, e: React.MouseEvent) => {
    e.stopPropagation(); // no abrir la intro del examen
    if (certLoading) return;
    setCertLoading(cert.id);
    setCertError(prev => ({ ...prev, [cert.id]: "" }));
    try {
      const { data } = await axios.get(
        `${import.meta.env.VITE_API_URL}/api/certificates/mine`,
        { withCredentials: true }
      );
      const list: MyCertificate[] = Array.isArray(data?.certificates) ? data.certificates : [];
      const found = list.find(c => c.certId === cert.id)
                 ?? list.find(c => !!cert.slug && c.slug === cert.slug);

      if (!found) {
        setCertError(prev => ({ ...prev, [cert.id]: "Todavía no encontramos tu certificado. Probá de nuevo en unos minutos." }));
        return;
      }
      if (found.status === "revoked") {
        setCertError(prev => ({ ...prev, [cert.id]: "Este certificado fue revocado. Contactanos si creés que es un error." }));
        return;
      }
      // Ruta interna: funciona igual en local y en producción
      navigate(`/certifications/${found.slug}/${found.credentialId}`);
    } catch {
      setCertError(prev => ({ ...prev, [cert.id]: "No pudimos obtener tu certificado. Probá de nuevo." }));
    } finally {
      setCertLoading(null);
    }
  };

  const fetchSummaries = () => {
    axios.get(`${import.meta.env.VITE_API_URL}/api/certification/summary`, { withCredentials: true })
      .then(({ data }) => setSummaries(data.data ?? {}))
      .catch(() => setSummaries({}));
  };

  // Pregunta al backend, por cada certificación disponible, si hay un intento abierto.
  // El /status ya cierra los intentos vencidos, así que lo que vuelve como
  // inProgress: true es un examen que todavía se puede retomar.
  const fetchInProgress = async () => {
    const available = CATALOG.filter(c => c.status === "available");
    const results = await Promise.all(
      available.map(async (c) => {
        try {
          const { data } = await axios.get(
            `${import.meta.env.VITE_API_URL}/api/certification/${c.id}/status`,
            // Mismo id de pestaña que el examen: así una recarga no se toma como cierre
            { params: { tab: getExamTabId() }, withCredentials: true }
          );
          return [c.id, data?.inProgress && data?.expiresAt ? { expiresAt: data.expiresAt } : null] as const;
        } catch {
          return [c.id, null] as const;
        }
      })
    );
    setInProgress(Object.fromEntries(results));
  };

  useEffect(() => {
    if (!user) return;
    fetchSummaries();
    fetchInProgress();
  }, [user]); // eslint-disable-line react-hooks/exhaustive-deps

  // Reloj: solo corre si hay algún examen en curso
  const hasAnyInProgress = Object.values(inProgress).some(Boolean);
  useEffect(() => {
    if (!hasAnyInProgress) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [hasAnyInProgress]);

  // Tiempo restante de una certificación en curso (null si no hay intento abierto)
  const remainingFor = (certId: string): number | null => {
    const info = inProgress[certId];
    if (!info) return null;
    return new Date(info.expiresAt).getTime() - now;
  };

  // Cuando un intento llega a 0, se vuelve a consultar: el backend lo cierra
  // y el resultado pasa a verse en la card.
  const anyExpired = CATALOG.some(c => {
    const r = remainingFor(c.id);
    return r !== null && r <= 0;
  });
  useEffect(() => {
    if (!anyExpired) return;
    const t = setTimeout(() => { fetchInProgress(); fetchSummaries(); }, 1500);
    return () => clearTimeout(t);
  }, [anyExpired]); // eslint-disable-line react-hooks/exhaustive-deps

  // Puede entrar si tiene voucher o si ya tiene un examen abierto de esa certificación
  const isInProgress = (certId: string) => {
    const r = remainingFor(certId);
    return r !== null && r > 0;
  };
  const canEnter = (cert: CatalogEntry) => hasVoucher || isInProgress(cert.id);

  const counts: Record<Filter, number> = {
    all:    CATALOG.length,
    taken:  CATALOG.filter(c => matchesFilter("taken",  summaries[c.id])).length,
    passed: CATALOG.filter(c => matchesFilter("passed", summaries[c.id])).length,
    failed: CATALOG.filter(c => matchesFilter("failed", summaries[c.id])).length,
  };
  const visible = CATALOG.filter(c => matchesFilter(filter, summaries[c.id]));

  // Click en una card: sin voucher y sin examen en curso no se abre la certificación
  const handleCardClick = (cert: CatalogEntry) => {
    if (cert.status === "soon") return;
    if (!canEnter(cert)) {
      setNoVoucherCert(cert);
      return;
    }
    setActiveCert(cert);
  };

  // ── Examen real montado (vía portal) ────────────────────────────────
  // Doble chequeo: sin voucher y sin examen en curso no se monta el examen.
  // Una vez montado no se desmonta aunque el voucher se consuma al iniciar.
  if (activeCert && showExam && activeCert.component) {
    const ActiveComponent = activeCert.component;
    return createPortal(
      <div className={`ccx-wrap ccx-fullscreen-overlay ${isLight ? "light" : ""}`}>
        <ActiveComponent />
      </div>,
      document.body
    );
  }

  // ── Pantalla intro de la certificación elegida (vía portal) ─────────
  if (activeCert && canEnter(activeCert)) {
    const { intro } = activeCert;
    const activeRemaining = remainingFor(activeCert.id);
    const resuming        = activeRemaining !== null && activeRemaining > 0;
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

          {resuming && (
            <div className="ccx-progress ccx-progress--intro" role="status">
              <div className="ccx-progress-head">
                <span className="ccx-progress-label"><i className="ccx-live-dot" /> EXAMEN EN CURSO</span>
                <span className="ccx-progress-time">{formatRemaining(activeRemaining!)}</span>
              </div>
              <p className="ccx-progress-text">
                Ya empezaste este examen y el tiempo sigue corriendo. Al retomarlo seguís desde la
                misma pregunta, con tus respuestas guardadas. No se consume otro voucher.
              </p>
            </div>
          )}

          <button className="ccx-btn ccx-btn--accent ccx-btn--lg" onClick={() => setShowExam(true)}>
            {resuming ? "RETOMAR EXAMEN →" : "COMENZAR CERTIFICACIÓN →"}
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

      {/* Filtros por resultado */}
      <div className="ccx-filters" role="tablist" aria-label="Filtrar certificaciones">
        {FILTERS.map(f => (
          <button
            key={f.id}
            role="tab"
            aria-selected={filter === f.id}
            className={`ccx-filter${filter === f.id ? " active" : ""} ccx-filter--${f.id}`}
            onClick={() => setFilter(f.id)}
          >
            {f.label}
            <span className="ccx-filter-count">{counts[f.id]}</span>
          </button>
        ))}
      </div>

      {visible.length === 0 && (
        <div className="ccx-empty">
          <span className="ccx-eyebrow">// SIN_RESULTADOS</span>
          <p>
            {filter === "passed" ? "Todavía no aprobaste ninguna certificación."
              : filter === "failed" ? "No tenés certificaciones pendientes de aprobar."
              : "Todavía no rendiste ninguna certificación."}
          </p>
        </div>
      )}

      <div className="ccx-grid">
        {visible.map((cert) => {
          const isSoon     = cert.status === "soon";
          const levelColor = LEVEL_COLORS[cert.level] ?? "#ccff00";
          const summary    = summaries[cert.id];
          const taken      = !!summary && summary.attempts > 0;
          const remaining  = remainingFor(cert.id);
          const running    = remaining !== null && remaining > 0;

          return (
            <div
              key={cert.id}
              className={`ccx-card${isSoon ? " ccx-card--soon" : ""}${running ? " ccx-card--running" : ""}`}
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
                ) : running ? (
                  <span className="ccx-badge ccx-badge--running">
                    <i className="ccx-live-dot" /> EN CURSO
                  </span>
                ) : taken ? (
                  <span className={`ccx-badge ccx-badge--${summary!.passed ? "passed" : "failed"}`}>
                    {summary!.passed ? "✓ APROBADA" : "✕ NO APROBADA"}
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

              {/* Examen en curso: tiempo restante en vivo */}
              {running && (
                <div className="ccx-progress" role="status">
                  <div className="ccx-progress-head">
                    <span className="ccx-progress-label">// TIEMPO RESTANTE</span>
                    <span className="ccx-progress-time">{formatRemaining(remaining!)}</span>
                  </div>
                  <span className="ccx-progress-meta">
                    Examen iniciado · el tiempo sigue corriendo
                  </span>
                </div>
              )}

              {/* Resultado obtenido (mejor intento) */}
              {taken && !running && (
                <div className={`ccx-result ccx-result--${summary!.passed ? "passed" : "failed"}`}>
                  <div className="ccx-result-head">
                    <span className="ccx-result-label">// {summary!.passed ? "TU RESULTADO" : "MEJOR INTENTO"}</span>
                    <span className="ccx-result-pct">{pct(summary!.bestScore)}</span>
                  </div>
                  <div className="ccx-result-bar">
                    <i style={{ width: pct(summary!.bestScore) }} />
                    <b style={{ left: pct(summary!.passingScore) }} />
                  </div>
                  <span className="ccx-result-meta">
                    {summary!.attempts} intento{summary!.attempts > 1 ? "s" : ""} · mínimo {pct(summary!.passingScore)}
                  </span>

                  {/* Aprobada: acceso al certificado público */}
                  {summary!.passed && cert.slug && (
                    <>
                      <button
                        type="button"
                        className="ccx-cert-btn"
                        onClick={(e) => openCertificate(cert, e)}
                        disabled={certLoading === cert.id}
                        aria-busy={certLoading === cert.id}
                      >
                        <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                          <circle cx="10" cy="8" r="5" />
                          <path d="M7 12l-1.5 6L10 16l4.5 2L13 12" />
                        </svg>
                        {certLoading === cert.id ? "BUSCANDO CERTIFICADO…" : "VER MI CERTIFICADO →"}
                      </button>
                      {certError[cert.id] && (
                        <span className="ccx-cert-error" role="alert">{certError[cert.id]}</span>
                      )}
                    </>
                  )}
                </div>
              )}

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
                  <span className="ccx-card-cta">
                    {running ? "CONTINUAR EXAMEN →"
                      : !taken ? "VER DETALLES →"
                      : summary!.passed ? "MEJORAR NOTA →" : "REINTENTAR →"}
                  </span>
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