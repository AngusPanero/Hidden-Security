import { useEffect, useMemo, useRef, useState } from "react";
import { useParams } from "react-router-dom";
import axios from "axios";
import QRCode from "qrcode";
import { toPng } from "html-to-image";
import { jsPDF } from "jspdf";
import { UseTheme } from "../contexts/ThemeContext";
import "./certificateview.css";

import logoHS from "../../public/insignias/SOC.png";

const API_URL  = import.meta.env.VITE_API_URL;
const SITE_URL = "https://www.hidden-security.org";
 
// Datos del emisor que aparecen en el certificado
const ISSUER = {
  name:      "Hidden Security",
  tagline:   "Formación y certificación en ciberseguridad",
  location:  "Provincia de Buenos Aires, Argentina",
  web:       "www.hidden-security.org",
  signatory: "María Belén Arroyo",
  role:      "Responsable · Hidden Security",
};
 
// Si Hidden Security tiene página de empresa en LinkedIn, poné su ID numérico
// acá y LinkedIn va a mostrar el logo junto a la certificación del alumno.
const LINKEDIN_ORG_ID = "";
 
// Datos del examen que se muestran bajo el título, por certificación (slug).
const EXAM_FACTS: Record<string, string[]> = {
  modernSoc: ["Examen final supervisado", "80 preguntas · 2 horas", "Aprobación mínima 80%"],
};
 
// Tamaño real del certificado (A4 horizontal a 96 dpi). En pantalla se escala.
const CERT_W = 1123;
const CERT_H = 794;
 
// Debajo de este ancho se muestra la tarjeta vertical (solo pantalla). Las
// descargas salen SIEMPRE del certificado horizontal.
const MOBILE_MQ = "(max-width: 720px)";
 
type PublicCertificate = {
  credentialId: string;
  slug:         string;
  holderName:   string | null;
  title:        string;
  program:      string;
  skill:        string;
  issuedAt:     string;
  status:       "active" | "revoked";
  revokedAt:    string | null;
  url:          string;
};
 
type LoadState = "loading" | "ready" | "notfound" | "error";
 
const formatDate = (iso: string) =>
  new Date(iso).toLocaleDateString("es-AR", {
    day: "numeric", month: "long", year: "numeric",
    timeZone: "America/Argentina/Buenos_Aires", // misma fecha para cualquiera que lo vea, esté donde esté
  });
 
const nameSize = (name: string) => (name.length > 38 ? 38 : name.length > 28 ? 46 : 56);
 
const CertificateView = () => {
  const { slug = "", credentialId = "" } = useParams();
  const { theme } = UseTheme();
 
  const [cert, setCert]       = useState<PublicCertificate | null>(null);
  const [state, setState]     = useState<LoadState>("loading");
  const [qr, setQr]           = useState<string>("");
  const [scale, setScale]     = useState(1);
  const [busy, setBusy]       = useState<"" | "pdf" | "png">("");
  const [copied, setCopied]   = useState(false);
  const [isMobile, setIsMobile] = useState(
    () => typeof window !== "undefined" && window.matchMedia(MOBILE_MQ).matches
  );
 
  const stageRef = useRef<HTMLDivElement>(null);
  const certRef  = useRef<HTMLDivElement>(null);
 
  // ─── Carga ───────────────────────────────────────────────────────────────
  useEffect(() => {
    window.scrollTo(0, 0);
    let cancel = false;
    setState("loading");
 
    axios
      .get<PublicCertificate>(`${API_URL}/api/public-certificates/${encodeURIComponent(credentialId)}`)
      .then(({ data }) => {
        if (cancel) return;
        // El slug de la URL tiene que coincidir con la certificación real
        if (data.slug !== slug) { setState("notfound"); return; }
        setCert(data);
        setState("ready");
      })
      .catch(err => {
        if (cancel) return;
        setState(err?.response?.status === 404 ? "notfound" : "error");
      });
 
    return () => { cancel = true; };
  }, [slug, credentialId]);
 
  // ─── QR permanente (apunta a la URL pública) ─────────────────────────────
  useEffect(() => {
    if (!cert) return;
    QRCode.toDataURL(cert.url, {
      errorCorrectionLevel: "H",
      margin: 0,
      width: 640,
      color: { dark: "#000000", light: "#ffffff" },
    }).then(setQr).catch(() => setQr(""));
 
    document.title = `${cert.holderName ?? "Certificado"} · ${cert.title} · Hidden Security`;
  }, [cert]);
 
  // ─── Mobile / desktop ────────────────────────────────────────────────────
  useEffect(() => {
    const mq = window.matchMedia(MOBILE_MQ);
    const onChange = () => setIsMobile(mq.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);
 
  // ─── Escalado a la pantalla ──────────────────────────────────────────────
  useEffect(() => {
    const el = stageRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => setScale(Math.min(1, entry.contentRect.width / CERT_W)));
    ro.observe(el);
    return () => ro.disconnect();
  }, [state]);
 
  const fileBase = useMemo(() => {
    if (!cert) return "certificado";
    const n = (cert.holderName ?? "certificado").normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-zA-Z0-9]+/g, "-");
    return `HiddenSecurity-${cert.title.replace(/\s+/g, "")}-${n}`;
  }, [cert]);
 
  // ─── Descargas ───────────────────────────────────────────────────────────
  const capture = async () => {
    if (!certRef.current) throw new Error("no node");
    await document.fonts?.ready;
    return toPng(certRef.current, {
      pixelRatio: 2.5,
      cacheBust: true,
      width: CERT_W,
      height: CERT_H,
      backgroundColor: "#050505",
    });
  };
 
  const downloadPng = async () => {
    setBusy("png");
    try {
      const data = await capture();
      const a = document.createElement("a");
      a.href = data;
      a.download = `${fileBase}.png`;
      a.click();
    } finally { setBusy(""); }
  };
 
  const downloadPdf = async () => {
    setBusy("pdf");
    try {
      const data = await capture();
      const pdf = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4", compress: true });
      pdf.addImage(data, "PNG", 0, 0, 297, 210, undefined, "FAST");
      pdf.setProperties({
        title:   `${cert?.title} — ${cert?.holderName ?? ""}`,
        author:  ISSUER.name,
        subject: `Credencial ${cert?.credentialId}`,
      });
      pdf.link(0, 0, 297, 210, { url: cert?.url ?? SITE_URL });
      pdf.save(`${fileBase}.pdf`);
    } finally { setBusy(""); }
  };
 
  const linkedInUrl = useMemo(() => {
    if (!cert) return "#";
    const d = new Date(cert.issuedAt);
    const p = new URLSearchParams({
      startTask:  "CERTIFICATION_NAME",
      name:       `${cert.title} — ${cert.program}`,
      issueYear:  String(d.getFullYear()),
      issueMonth: String(d.getMonth() + 1),
      certUrl:    cert.url,
      certId:     cert.credentialId,
    });
    if (LINKEDIN_ORG_ID) p.set("organizationId", LINKEDIN_ORG_ID);
    else p.set("organizationName", ISSUER.name);
    return `https://www.linkedin.com/profile/add?${p.toString()}`;
  }, [cert]);
 
  const copyLink = async () => {
    if (!cert) return;
    try {
      await navigator.clipboard.writeText(cert.url);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch { /* sin permiso de portapapeles */ }
  };
 
  const revoked = cert?.status === "revoked";
 
  // ─── Render ──────────────────────────────────────────────────────────────
  return (
    <div className={`hcv-page ${theme === "light" ? "hcv-light" : ""}`}>
      {state === "loading" && (
        <div className="hcv-state">
          <span className="hcv-spinner" />
          <span className="hcv-eyebrow">// VERIFICANDO CREDENCIAL</span>
        </div>
      )}
 
      {(state === "notfound" || state === "error") && (
        <div className="hcv-state">
          <span className="hcv-eyebrow hcv-eyebrow--bad">
            // {state === "notfound" ? "CREDENCIAL_NO_ENCONTRADA" : "ERROR_DE_VERIFICACIÓN"}
          </span>
          <h1 className="hcv-state-title">
            {state === "notfound" ? "No encontramos este certificado" : "No pudimos verificar el certificado"}
          </h1>
          <p className="hcv-state-text">
            {state === "notfound"
              ? "El código no corresponde a ninguna credencial emitida por Hidden Security. Revisá que el link esté completo."
              : "Probá de nuevo en unos minutos."}
          </p>
          <code className="hcv-state-code">{credentialId}</code>
        </div>
      )}
 
      {state === "ready" && cert && (
        <div className="hcv-wrap">
          {/* Barra de verificación */}
          <div className={`hcv-verify ${revoked ? "hcv-verify--bad" : ""}`}>
            <span className="hcv-verify-mark">{revoked ? "✕" : "✓"}</span>
            <div className="hcv-verify-text">
              <strong>{revoked ? "Credencial revocada" : "Credencial verificada"}</strong>
              <span>
                {revoked
                  ? `Hidden Security revocó esta credencial${cert.revokedAt ? ` el ${formatDate(cert.revokedAt)}` : ""}. No es válida.`
                  : `Emitida por Hidden Security a ${cert.holderName ?? "su titular"} el ${formatDate(cert.issuedAt)}.`}
              </span>
            </div>
            <span className="hcv-verify-id">{cert.credentialId}</span>
          </div>
 
          {/* Mobile: tarjeta vertical legible (solo pantalla, no se descarga) */}
          {isMobile && (
            <section className={`hcv-m ${revoked ? "hcv-m--revoked" : ""}`}>
              <span className="hcv-m-corner hcv-m-corner--tl" />
              <span className="hcv-m-corner hcv-m-corner--br" />
              {revoked && <div className="hcv-m-void">REVOCADO</div>}
 
              <div className="hcv-m-head">
                <img src={logoHS} alt="Hidden Security" className="hcv-m-logo" />
                <div className="hcv-m-brand">
                  <span className="hcv-m-brand-name">HIDDEN SECURITY</span>
                  <span className="hcv-m-brand-sub">{ISSUER.tagline}</span>
                </div>
              </div>
 
              <span className="hcv-m-kicker">CERTIFICADO DE APROBACIÓN</span>
              <span className="hcv-m-lead">Se certifica que</span>
              <h1 className="hcv-m-name">{cert.holderName ?? "Titular de la credencial"}</h1>
              <span className="hcv-m-bar" />
              <p className="hcv-m-desc">
                aprobó el examen final de certificación del programa <b>{cert.program}</b>,
                acreditando las competencias profesionales de
              </p>
              <div className="hcv-m-title">{cert.title.toUpperCase()}</div>
 
              {!!EXAM_FACTS[cert.slug]?.length && (
                <div className="hcv-m-facts">
                  {EXAM_FACTS[cert.slug].map(f => <span key={f}>{f}</span>)}
                </div>
              )}
 
              <div className="hcv-m-qr-block">
                <div className="hcv-m-qr">{qr && <img src={qr} alt="QR de verificación" />}</div>
                <span className="hcv-m-qr-cap">Escaneá para verificar</span>
              </div>
 
              <dl className="hcv-m-meta">
                <div><dt>FECHA DE EMISIÓN</dt><dd>{formatDate(cert.issuedAt)}</dd></div>
                <div><dt>VIGENCIA</dt><dd>Permanente</dd></div>
                <div className="hcv-m-meta-full"><dt>N.º DE CREDENCIAL</dt><dd className="hcv-m-id">{cert.credentialId}</dd></div>
              </dl>
 
              <div className="hcv-m-sign">
                <span className="hcv-m-sign-name">{ISSUER.signatory}</span>
                <span className="hcv-m-sign-line" />
                <span className="hcv-m-sign-role">{ISSUER.role}</span>
              </div>
 
              <div className="hcv-m-strip">{ISSUER.web}</div>
            </section>
          )}
 
          {isMobile && <span className="hcv-m-preview-label">// VERSIÓN DESCARGABLE · HORIZONTAL</span>}
 
          {/* Certificado horizontal (desktop + vista previa en mobile + fuente de las descargas) */}
          <div className="hcv-stage" ref={stageRef} style={{ height: CERT_H * scale }}>
            <div className="hcv-scaler" style={{ transform: `scale(${scale})` }}>
              <div className="hcv-cert" ref={certRef}>
                <div className="hcv-grid" />
                <div className="hcv-glow" />
                <div className="hcv-frame" />
                <span className="hcv-corner hcv-corner--tl" />
                <span className="hcv-corner hcv-corner--tr" />
                <span className="hcv-corner hcv-corner--bl" />
                <span className="hcv-corner hcv-corner--br" />
                {!revoked && <div className="hcv-tag">CREDENCIAL VERIFICABLE</div>}
                {revoked && <div className="hcv-void">REVOCADO</div>}
 
                {/* Encabezado */}
                <header className="hcv-head">
                  <div className="hcv-brand">
                    <img src={logoHS} alt="Hidden Security" className="hcv-logo" />
                    <div className="hcv-brand-text">
                      <span className="hcv-brand-name">HIDDEN SECURITY</span>
                      <span className="hcv-brand-sub">{ISSUER.tagline}</span>
                    </div>
                  </div>
                  <div className="hcv-head-id">
                    <span className="hcv-label">N.º DE CREDENCIAL</span>
                    <span className="hcv-head-id-val">{cert.credentialId}</span>
                  </div>
                </header>
 
                {/* Cuerpo */}
                <div className="hcv-body">
                  <div className="hcv-main">
                    <span className="hcv-kicker">CERTIFICADO DE APROBACIÓN</span>
                    <span className="hcv-lead">Se certifica que</span>
                    <h2 className="hcv-name" style={{ fontSize: nameSize(cert.holderName ?? "") }}>
                      {cert.holderName ?? "Titular de la credencial"}
                    </h2>
                    <span className="hcv-name-bar" />
                    <p className="hcv-desc">
                      aprobó el examen final de certificación del programa <b>{cert.program}</b>,
                      rendido en un entorno supervisado y corregido por Hidden Security, acreditando
                      las competencias profesionales de
                    </p>
                    <div className="hcv-title">{cert.title.toUpperCase()}</div>
                    {!!EXAM_FACTS[cert.slug]?.length && (
                      <div className="hcv-facts">
                        {EXAM_FACTS[cert.slug].map(f => <span key={f}>{f}</span>)}
                      </div>
                    )}
                  </div>
 
                  <aside className="hcv-side">
                    <svg className="hcv-seal" viewBox="0 0 200 200" aria-hidden>
                      <defs>
                        <path id="hcv-seal-path" d="M100,100 m-74,0 a74,74 0 1,1 148,0 a74,74 0 1,1 -148,0" />
                      </defs>
                      <circle cx="100" cy="100" r="96" fill="none" stroke="#ccff00" strokeWidth="1.5" />
                      <circle cx="100" cy="100" r="88" fill="none" stroke="#ccff00" strokeOpacity=".35" strokeWidth="1" strokeDasharray="2 4" />
                      <circle cx="100" cy="100" r="58" fill="none" stroke="#ccff00" strokeWidth="1" />
                      <text fill="#ccff00" fontSize="12.5" fontWeight="700" letterSpacing="3.4" fontFamily="Montserrat, sans-serif">
                        <textPath href="#hcv-seal-path">HIDDEN SECURITY · VERIFIED CREDENTIAL · </textPath>
                      </text>
                      <path d="M100 66 L126 76 V100 C126 116 114 128 100 134 C86 128 74 116 74 100 V76 Z" fill="#ccff00" />
                      <path d="M88 100 L97 109 L113 91" fill="none" stroke="#050505" strokeWidth="5" strokeLinecap="square" />
                    </svg>
 
                    <div className="hcv-qr">
                      {qr && <img src={qr} alt="QR de verificación" />}
                    </div>
                    <span className="hcv-qr-cap">Escaneá para verificar</span>
                  </aside>
                </div>
 
                {/* Pie */}
                <footer className="hcv-foot">
                  <div className="hcv-meta">
                    <div>
                      <span className="hcv-label">FECHA DE EMISIÓN</span>
                      <span className="hcv-meta-val">{formatDate(cert.issuedAt)}</span>
                    </div>
                    <div>
                      <span className="hcv-label">VIGENCIA</span>
                      <span className="hcv-meta-val">Permanente</span>
                    </div>
                    <div>
                      <span className="hcv-label">VERIFICACIÓN</span>
                      <span className="hcv-meta-val hcv-meta-val--sm">
                        {ISSUER.web}/certifications/{cert.slug}
                      </span>
                    </div>
                  </div>
 
                  <div className="hcv-sign">
                    <span className="hcv-sign-name">{ISSUER.signatory}</span>
                    <span className="hcv-sign-line" />
                    <span className="hcv-label">{ISSUER.role}</span>
                  </div>
                </footer>
 
                <div className="hcv-strip">
                  <span>{ISSUER.name.toUpperCase()}</span>
                  <i />
                  <span>{ISSUER.tagline}</span>
                  <i />
                  <span>{ISSUER.location}</span>
                  <i />
                  <span>{ISSUER.web}</span>
                </div>
              </div>
            </div>
          </div>
 
          {/* Acciones */}
          {!revoked && (
            <div className="hcv-actions">
              <button className="hcv-btn hcv-btn--main" onClick={downloadPdf} disabled={!!busy}>
                {busy === "pdf" ? "GENERANDO…" : "DESCARGAR PDF"}
              </button>
              <button className="hcv-btn" onClick={downloadPng} disabled={!!busy}>
                {busy === "png" ? "GENERANDO…" : "DESCARGAR IMAGEN"}
              </button>
              <a className="hcv-btn hcv-btn--in" href={linkedInUrl} target="_blank" rel="noopener noreferrer">
                AGREGAR A LINKEDIN
              </a>
              <button className="hcv-btn" onClick={copyLink}>
                {copied ? "✓ LINK COPIADO" : "COPIAR LINK"}
              </button>
            </div>
          )}
 
          <p className="hcv-note">
            Este certificado es público y verificable. Cualquier persona puede confirmar su validez
            escaneando el QR o ingresando a <b>{cert.url.replace(/^https?:\/\//, "")}</b>.
          </p>
        </div>
      )}
    </div>
  );
};
 
export default CertificateView;