import { useState, useEffect, useRef } from "react";
import axios from "axios";
import { UseSession } from "../contexts/SessionContext";
import { UseTheme } from "../contexts/ThemeContext";
import "./cvBuilder.css";

// ─── Types ────────────────────────────────────────────────────────────────────
interface PersonalInfo {
  firstName: string; lastName: string; headline: string;
  email: string; phone: string; location: string;
  linkedin: string; github: string; portfolio: string; summary: string;
  photo: string; // URL de Cloudinary, vacío si no tiene
}

interface Experience {
  company: string; position: string; location: string;
  startDate: string; endDate: string; current: boolean; description: string;
}

interface Education {
  institution: string; degree: string; field: string;
  startDate: string; endDate: string; current: boolean; description: string;
}

interface Certification {
  name: string; issuer: string; date: string; credentialId: string; url: string;
}

interface Language { language: string; level: "Nativo" | "Avanzado" | "Intermedio" | "Básico"; }

interface Project {
  name: string; description: string; url: string; repoUrl: string; technologies: string[];
}

interface WorkPreferences {
  modality: string[]; contractType: string[];
  salaryMin: number | null; salaryMax: number | null; currency: string;
}

interface CVData {
  personalInfo:   PersonalInfo;
  experience:     Experience[];
  education:      Education[];
  certifications: Certification[];
  skills:         string[];
  languages:      Language[];
  projects:       Project[];
  availability:   string;
  workPreferences: WorkPreferences;
}

// ─── Constantes ───────────────────────────────────────────────────────────────
const IT_SKILLS = [
  "JavaScript","TypeScript","Python","Java","C#","C++","Go","Rust","PHP","Ruby",
  "React","Vue.js","Angular","Next.js","Node.js","Express.js","NestJS","Django","FastAPI",
  "MongoDB","PostgreSQL","MySQL","Redis","Firebase","Docker","Kubernetes",
  "AWS","Google Cloud","Azure","Git","GitHub","Linux","Bash",
  "REST APIs","GraphQL","WebSockets","Microservices",
  "Cybersecurity","Ethical Hacking","Pentesting","OSINT","SOC","SIEM",
  "Networking","TCP/IP","Firewalls","VPN",
  "Machine Learning","Deep Learning","TensorFlow","PyTorch","Data Science",
  "React Native","Flutter","iOS","Android","Figma","UI/UX","Tailwind CSS","SASS",
  "Testing","QA","Selenium","Cypress","Jest","Blockchain","Web3","Solidity",
  "Agile","Scrum","Jira","Power BI","Tableau","SAP","Salesforce",
];

const BLANK_CV: CVData = {
  personalInfo: {
    firstName:  "Claudio",
    lastName:   "Panero",
    headline:   "Senior Cybersecurity Analyst · SOC · Pentesting · 6 años de experiencia",
    email:      "Claudio.panero@email.com",
    phone:      "+54 9 11 4567-8901",
    location:   "Buenos Aires, Argentina",
    linkedin:   "linkedin.com/in/Claudiopanero",
    github:     "github.com/Claudiopanero",
    portfolio:  "Claudiopanero.dev",
    summary:    "Profesional en ciberseguridad con 6 años de experiencia en análisis de amenazas, pentesting y operaciones de SOC. Especializado en detección y respuesta a incidentes, análisis de malware y hardening de infraestructuras. Certificado en CEH, CompTIA Security+ y eJPT. Apasionado por la seguridad ofensiva y defensiva, con sólida base en redes, sistemas Linux y automatización con Python.",
    photo:      "",
  },
  experience: [
    {
      company:     "Hidden Security",
      position:    "Senior SOC Analyst",
      location:    "Buenos Aires, Argentina",
      startDate:   "2022-03",
      endDate:     "",
      current:     true,
      description: "Monitoreo de alertas en tiempo real con SIEM (Splunk). Análisis de incidentes, triage y respuesta. Desarrollo de playbooks y automatización de respuesta con Python. Coordinación con equipos de IR en casos críticos.",
    },
    {
      company:     "CyberShield S.A.",
      position:    "Pentester Jr / Analista de Vulnerabilidades",
      location:    "Remoto",
      startDate:   "2019-06",
      endDate:     "2022-02",
      current:     false,
      description: "Realización de pruebas de penetración en aplicaciones web y redes internas. Elaboración de reportes técnicos y ejecutivos. Uso de herramientas como Burp Suite, Nmap, Metasploit y Nessus.",
    },
  ],
  education: [
    {
      institution: "Universidad Tecnológica Nacional",
      degree:      "Ingeniería en Sistemas de Información",
      field:       "Seguridad Informática",
      startDate:   "2015-03",
      endDate:     "2020-12",
      current:     false,
      description: "Tesina: Implementación de un SIEM open-source para detección de amenazas en redes corporativas.",
    },
  ],
  certifications: [
    { name: "Certified Ethical Hacker (CEH)", issuer: "EC-Council", date: "2021-08", credentialId: "ECC4823901", url: "https://verify.eccouncil.org/verify" },
    { name: "CompTIA Security+", issuer: "CompTIA", date: "2020-11", credentialId: "COMP001234567", url: "" },
    { name: "eLearnSecurity Junior Penetration Tester (eJPT)", issuer: "eLearnSecurity", date: "2019-09", credentialId: "", url: "" },
  ],
  skills: [
    "Cybersecurity","Pentesting","OSINT","SOC","SIEM",
    "Networking","TCP/IP","Firewalls","VPN","Linux","Bash",
    "Python","Docker","AWS","Git","REST APIs",
  ],
  languages: [
    { language: "Español", level: "Nativo" },
    { language: "Inglés",  level: "Avanzado" },
  ],
  projects: [
    {
      name:         "ThreatHunter Dashboard",
      description:  "Dashboard en tiempo real para visualización de amenazas detectadas por el SIEM. Integra alertas de Splunk, estadísticas de incidentes y mapa geográfico de ataques.",
      url:          "https://threathunter.Claudioramirez.dev",
      repoUrl:      "https://github.com/Claudioramirez/threathunter",
      technologies: ["Python","Docker","REST APIs","Linux"],
    },
  ],
  availability:    "Inmediata",
  workPreferences: {
    modality:     ["Remoto","Híbrido"],
    contractType: ["Full-time"],
    salaryMin:    2500,
    salaryMax:    4000,
    currency:     "USD",
  },
};

const TABS_DEF = [
  { id:"personal",  label:"Datos personales" },
  { id:"experience",label:"Experiencia"      },
  { id:"education", label:"Educación"        },
  { id:"skills",    label:"Skills"           },
  { id:"certs",     label:"Certificaciones"  },
  { id:"languages", label:"Idiomas"          },
  { id:"projects",  label:"Proyectos"        },
  { id:"prefs",     label:"Preferencias"     },
  { id:"preview",   label:"Vista previa"     },
];

// ─── Helpers de UI ────────────────────────────────────────────────────────────
function Field({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <div className="cv-field">
      <label className="cv-label">{label}{required && <span className="cv-req"> *</span>}</label>
      {children}
    </div>
  );
}

function Input({ value, onChange, placeholder, type = "text" }: { value: string; onChange: (v: string) => void; placeholder?: string; type?: string }) {
  return <input className="cv-input" type={type} value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} />;
}

function Textarea({ value, onChange, placeholder, rows = 3 }: { value: string; onChange: (v: string) => void; placeholder?: string; rows?: number }) {
  return <textarea className="cv-input cv-textarea" value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} rows={rows} />;
}

function SectionHeader({ title, onAdd, addLabel }: { title: string; onAdd?: () => void; addLabel?: string }) {
  return (
    <div className="cv-section-header">
      <span className="cv-section-title">{title}</span>
      {onAdd && <button className="cv-add-btn" onClick={onAdd}>{addLabel ?? "+ Agregar"}</button>}
    </div>
  );
}

function CardBlock({ children, onRemove }: { children: React.ReactNode; onRemove: () => void }) {
  return (
    <div className="cv-card-block">
      <button className="cv-remove-btn" onClick={onRemove}>×</button>
      {children}
    </div>
  );
}

// ─── SkillSelector ────────────────────────────────────────────────────────────
function SkillSelector({ selected, onChange }: { selected: string[]; onChange: (s: string[]) => void }) {
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const h = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);

  const filtered = IT_SKILLS.filter(s => !selected.includes(s) && s.toLowerCase().includes(q.toLowerCase()));

  return (
    <div ref={ref} className="cv-skill-selector">
      <div className="cv-skill-box" onClick={() => setOpen(true)}>
        {selected.map(s => (
          <span key={s} className="cv-skill-tag">
            {s}
            <button type="button" onClick={(e) => { e.stopPropagation(); onChange(selected.filter(x => x !== s)); }}>×</button>
          </span>
        ))}
        <input
          className="cv-skill-input"
          value={q}
          onChange={e => { setQ(e.target.value); setOpen(true); }}
          onFocus={() => setOpen(true)}
          placeholder={selected.length === 0 ? "Buscar skills..." : ""}
        />
      </div>
      {open && filtered.length > 0 && (
        <div className="cv-skill-dropdown">
          {filtered.slice(0, 30).map(s => (
            <div key={s} className="cv-skill-option" onMouseDown={e => { e.preventDefault(); onChange([...selected, s]); setQ(""); }}>
              {s}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Vista previa del CV ──────────────────────────────────────────────────────
function CVPreview({ cv }: { cv: CVData }) {
  const p = cv.personalInfo;
  return (
    <div className="cv-preview" id="cv-preview-print">
      {/* Header */}
      <div className="cvp-header">
        <div>
          <h1 className="cvp-name">{p.firstName} {p.lastName}</h1>
          {p.headline && <p className="cvp-headline">{p.headline}</p>}
        </div>
        <div className="cvp-contact">
          {p.email     && <span>{p.email}</span>}
          {p.phone     && <span>{p.phone}</span>}
          {p.location  && <span>{p.location}</span>}
          {p.linkedin  && <a href={p.linkedin} target="_blank" rel="noreferrer">LinkedIn</a>}
          {p.github    && <a href={p.github}   target="_blank" rel="noreferrer">GitHub</a>}
          {p.portfolio && <a href={p.portfolio}target="_blank" rel="noreferrer">Portfolio</a>}
        </div>
      </div>

      {/* Resumen */}
      {p.summary && (
        <div className="cvp-section">
          <h2 className="cvp-section-title">PERFIL PROFESIONAL</h2>
          <p className="cvp-text">{p.summary}</p>
        </div>
      )}

      {/* Experiencia */}
      {cv.experience.length > 0 && (
        <div className="cvp-section">
          <h2 className="cvp-section-title">EXPERIENCIA LABORAL</h2>
          {cv.experience.map((e, i) => (
            <div key={i} className="cvp-entry">
              <div className="cvp-entry-header">
                <div>
                  <strong className="cvp-entry-title">{e.position}</strong>
                  <span className="cvp-entry-sub"> — {e.company}{e.location ? `, ${e.location}` : ""}</span>
                </div>
                <span className="cvp-entry-date">
                  {e.startDate}{e.startDate ? " — " : ""}{e.current ? "Actualidad" : e.endDate}
                </span>
              </div>
              {e.description && <p className="cvp-text">{e.description}</p>}
            </div>
          ))}
        </div>
      )}

      {/* Educación */}
      {cv.education.length > 0 && (
        <div className="cvp-section">
          <h2 className="cvp-section-title">EDUCACIÓN</h2>
          {cv.education.map((e, i) => (
            <div key={i} className="cvp-entry">
              <div className="cvp-entry-header">
                <div>
                  <strong className="cvp-entry-title">{e.degree}{e.field ? ` — ${e.field}` : ""}</strong>
                  <span className="cvp-entry-sub"> · {e.institution}</span>
                </div>
                <span className="cvp-entry-date">
                  {e.startDate}{e.startDate ? " — " : ""}{e.current ? "Actualidad" : e.endDate}
                </span>
              </div>
              {e.description && <p className="cvp-text">{e.description}</p>}
            </div>
          ))}
        </div>
      )}

      {/* Skills */}
      {cv.skills.length > 0 && (
        <div className="cvp-section">
          <h2 className="cvp-section-title">SKILLS TÉCNICAS</h2>
          <div className="cvp-skills">
            {cv.skills.map(s => <span key={s} className="cvp-skill">{s}</span>)}
          </div>
        </div>
      )}

      {/* Proyectos */}
      {cv.projects.length > 0 && (
        <div className="cvp-section">
          <h2 className="cvp-section-title">PROYECTOS</h2>
          {cv.projects.map((p, i) => (
            <div key={i} className="cvp-entry">
              <div className="cvp-entry-header">
                <strong className="cvp-entry-title">{p.name}</strong>
                <div style={{ display: "flex", gap: 8 }}>
                  {p.url    && <a href={p.url}    target="_blank" rel="noreferrer" className="cvp-link">Demo</a>}
                  {p.repoUrl&& <a href={p.repoUrl}target="_blank" rel="noreferrer" className="cvp-link">Repo</a>}
                </div>
              </div>
              {p.description && <p className="cvp-text">{p.description}</p>}
              {p.technologies.length > 0 && (
                <div className="cvp-skills" style={{ marginTop: 6 }}>
                  {p.technologies.map(t => <span key={t} className="cvp-skill">{t}</span>)}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Certificaciones */}
      {cv.certifications.length > 0 && (
        <div className="cvp-section">
          <h2 className="cvp-section-title">CERTIFICACIONES</h2>
          {cv.certifications.map((c, i) => (
            <div key={i} className="cvp-entry">
              <div className="cvp-entry-header">
                <div>
                  <strong className="cvp-entry-title">{c.name}</strong>
                  <span className="cvp-entry-sub"> · {c.issuer}</span>
                </div>
                <span className="cvp-entry-date">{c.date}</span>
              </div>
              {(c.credentialId || c.url) && (
                <p className="cvp-text" style={{ fontSize: "0.75rem", opacity: 0.6 }}>
                  {c.credentialId && `ID: ${c.credentialId}`}
                  {c.url && <> · <a href={c.url} target="_blank" rel="noreferrer" className="cvp-link">Ver credencial</a></>}
                </p>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Idiomas */}
      {cv.languages.length > 0 && (
        <div className="cvp-section">
          <h2 className="cvp-section-title">IDIOMAS</h2>
          <div className="cvp-langs">
            {cv.languages.map((l, i) => (
              <div key={i} className="cvp-lang">
                <span className="cvp-lang-name">{l.language}</span>
                <span className="cvp-lang-level">{l.level}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Disponibilidad */}
      {cv.availability && (
        <div className="cvp-section">
          <h2 className="cvp-section-title">DISPONIBILIDAD</h2>
          <p className="cvp-text">{cv.availability}</p>
        </div>
      )}
    </div>
  );
}

// ─── CVBuilder principal ──────────────────────────────────────────────────────
export default function CVBuilder() {
  const { user }  = UseSession();
  const { theme } = UseTheme();
  const isLight   = theme === "light";

  const [cv,        setCV]        = useState<CVData>(BLANK_CV);
  const [activeTab, setActiveTab] = useState("personal");
  const [saving,    setSaving]    = useState(false);
  const [loading,   setLoading]   = useState(true);
  const [toast,     setToast]     = useState<{ msg: string; type: "success"|"error" } | null>(null);
  const [, setPhotoFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const photoInputRef = useRef<HTMLInputElement>(null);

  const uploadToCloudinary = async (file: File): Promise<string> => {
    const imgData = new FormData();
    imgData.append("file", file);
    imgData.append("upload_preset", "product-images");
    const response = await axios.post(
      `https://api.cloudinary.com/v1_1/${import.meta.env.VITE_CLOUDINARY_CLOUD_NAME}/image/upload`,
      imgData
    );
    return response.data.secure_url;
  };

  const handlePhotoChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setPhotoFile(file);
    setUploading(true);
    try {
      const url = await uploadToCloudinary(file);
      setPI("photo", url);
      notify("Foto subida correctamente");
    } catch {
      notify("Error al subir la foto", "error");
    } finally {
      setUploading(false);
    }
  };

  const notify = (msg: string, type: "success"|"error" = "success") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3500);
  };

  // Cargar CV existente
  useEffect(() => {
    axios.get(`${import.meta.env.VITE_API_URL}/api/cv/me`, { withCredentials: true })
      .then(({ data }) => { if (data.data) setCV({ ...BLANK_CV, ...data.data }); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  // Guardar
  const save = async () => {
    setSaving(true);
    try {
      await axios.put(`${import.meta.env.VITE_API_URL}/api/cv/me`, cv, { withCredentials: true });
      notify("CV guardado correctamente");
    } catch {
      notify("Error al guardar", "error");
    } finally {
      setSaving(false);
    }
  };

  // Exportar PDF via print
  const exportPDF = () => {
    const p    = cv.personalInfo;
    const name = `${p.firstName}_${p.lastName}`.replace(/\s+/g, "_");

    // ── Helpers de sección ──────────────────────────────────────
    // page-break-inside:avoid en cada bloque evita que se corten a mitad de página
    const section = (title: string, content: string) => !content.trim() ? "" : `
      <div style="page-break-inside:avoid;margin-bottom:28px;">
        <div style="display:flex;align-items:center;gap:14px;margin-bottom:14px;page-break-after:avoid;">
          <span style="font-family:'Montserrat',sans-serif;font-size:8px;font-weight:900;letter-spacing:5px;text-transform:uppercase;color:#111;white-space:nowrap;">${title}</span>
          <div style="flex:1;height:2px;background:#000;"></div>
        </div>
        ${content}
      </div>`;

    const entryBlock = (inner: string) =>
      `<div style="page-break-inside:avoid;margin-bottom:18px;">${inner}</div>`;

    // ── Skills ──────────────────────────────────────────────────
    const skillTags = cv.skills.map(s =>
      `<span style="display:inline-block;border:1.5px solid #111;color:#111;font-family:'Montserrat',sans-serif;font-size:8.5px;font-weight:800;letter-spacing:2px;text-transform:uppercase;padding:4px 11px;margin:3px;">${s}</span>`
    ).join("");

    // ── Experiencia ─────────────────────────────────────────────
    const experienceHTML = cv.experience.map(e => entryBlock(`
      <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:12px;flex-wrap:wrap;margin-bottom:5px;">
        <div>
          <div style="font-family:'Montserrat',sans-serif;font-size:15px;font-weight:900;text-transform:uppercase;letter-spacing:-0.3px;color:#000;">${e.position}</div>
          <div style="font-family:'Montserrat',sans-serif;font-size:12px;font-weight:700;color:#555;margin-top:2px;">${e.company}${e.location ? ` · ${e.location}` : ""}</div>
        </div>
        <div style="font-family:'Montserrat',sans-serif;font-size:10px;font-weight:700;color:#888;letter-spacing:1px;white-space:nowrap;padding-top:3px;">
          ${e.startDate}${e.startDate ? " — " : ""}${e.current ? "Actualidad" : e.endDate}
        </div>
      </div>
      ${e.description ? `<p style="font-family:'Montserrat',sans-serif;font-size:12px;font-weight:500;color:#333;line-height:1.8;margin:6px 0 0;">${e.description}</p>` : ""}
    `)).join("");

    // ── Educación ───────────────────────────────────────────────
    const educationHTML = cv.education.map(e => entryBlock(`
      <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:12px;flex-wrap:wrap;margin-bottom:5px;">
        <div>
          <div style="font-family:'Montserrat',sans-serif;font-size:15px;font-weight:900;text-transform:uppercase;color:#000;">${e.degree}${e.field ? ` — ${e.field}` : ""}</div>
          <div style="font-family:'Montserrat',sans-serif;font-size:12px;font-weight:700;color:#555;margin-top:2px;">${e.institution}</div>
        </div>
        <div style="font-family:'Montserrat',sans-serif;font-size:10px;font-weight:700;color:#888;letter-spacing:1px;white-space:nowrap;padding-top:3px;">
          ${e.startDate}${e.startDate ? " — " : ""}${e.current ? "Actualidad" : e.endDate}
        </div>
      </div>
      ${e.description ? `<p style="font-family:'Montserrat',sans-serif;font-size:12px;font-weight:500;color:#333;line-height:1.8;margin:6px 0 0;">${e.description}</p>` : ""}
    `)).join("");

    // ── Certificaciones ─────────────────────────────────────────
    const certsHTML = cv.certifications.map(c => entryBlock(`
      <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:12px;flex-wrap:wrap;">
        <div>
          <span style="font-family:'Montserrat',sans-serif;font-size:13px;font-weight:900;color:#000;">${c.name}</span>
          <span style="font-family:'Montserrat',sans-serif;font-size:11px;font-weight:600;color:#666;margin-left:8px;">· ${c.issuer}</span>
          ${c.credentialId ? `<div style="font-family:'Montserrat',sans-serif;font-size:10px;font-weight:600;color:#999;margin-top:3px;">ID: ${c.credentialId}</div>` : ""}
        </div>
        <span style="font-family:'Montserrat',sans-serif;font-size:10px;font-weight:700;color:#999;letter-spacing:1px;white-space:nowrap;">${c.date}</span>
      </div>
    `)).join("");

    // ── Idiomas ─────────────────────────────────────────────────
    const langsHTML = `<div style="display:flex;flex-wrap:wrap;gap:28px;">` +
      cv.languages.map(l => `
        <div style="page-break-inside:avoid;">
          <div style="font-family:'Montserrat',sans-serif;font-size:14px;font-weight:900;text-transform:uppercase;color:#000;">${l.language}</div>
          <div style="font-family:'Montserrat',sans-serif;font-size:10px;font-weight:800;letter-spacing:2px;color:#777;text-transform:uppercase;margin-top:2px;">${l.level}</div>
        </div>`
      ).join("") + `</div>`;

    // ── Proyectos ───────────────────────────────────────────────
    const projectsHTML = cv.projects.map(proj => entryBlock(`
      <div style="border-left:3px solid #000;padding-left:14px;">
        <div style="display:flex;justify-content:space-between;align-items:center;gap:12px;flex-wrap:wrap;margin-bottom:5px;">
          <span style="font-family:'Montserrat',sans-serif;font-size:15px;font-weight:900;text-transform:uppercase;color:#000;">${proj.name}</span>
          <div style="display:flex;gap:10px;">
            ${proj.url     ? `<span style="font-family:'Montserrat',sans-serif;font-size:9px;font-weight:800;letter-spacing:2px;color:#555;text-transform:uppercase;">↗ DEMO</span>` : ""}
            ${proj.repoUrl ? `<span style="font-family:'Montserrat',sans-serif;font-size:9px;font-weight:800;letter-spacing:2px;color:#888;text-transform:uppercase;">↗ REPO</span>` : ""}
          </div>
        </div>
        ${proj.description ? `<p style="font-family:'Montserrat',sans-serif;font-size:12px;font-weight:500;color:#333;line-height:1.8;margin:0 0 8px;">${proj.description}</p>` : ""}
        ${proj.technologies.length > 0 ? `<div style="display:flex;flex-wrap:wrap;gap:4px;">${proj.technologies.map(t => `<span style="font-family:'Montserrat',sans-serif;font-size:8px;font-weight:800;letter-spacing:2px;text-transform:uppercase;border:1px solid #bbb;color:#444;padding:3px 8px;">${t}</span>`).join("")}</div>` : ""}
      </div>
    `)).join("");

    // ── Disponibilidad ──────────────────────────────────────────
    const dispHTML = `
      <div style="page-break-inside:avoid;display:flex;align-items:center;gap:20px;flex-wrap:wrap;">
        <span style="font-family:'Montserrat',sans-serif;font-size:16px;font-weight:900;text-transform:uppercase;color:#000;">${cv.availability}</span>
        ${(cv.workPreferences.modality.length > 0) ? `<span style="font-family:'Montserrat',sans-serif;font-size:11px;font-weight:600;color:#666;">${cv.workPreferences.modality.join(" · ")}</span>` : ""}
        ${(cv.workPreferences.salaryMin || cv.workPreferences.salaryMax) ? `
          <span style="font-family:'Montserrat',sans-serif;font-size:11px;font-weight:700;color:#555;">
            ${cv.workPreferences.currency} ${cv.workPreferences.salaryMin?.toLocaleString("es-AR") ?? ""}${cv.workPreferences.salaryMin && cv.workPreferences.salaryMax ? " — " : ""}${cv.workPreferences.salaryMax?.toLocaleString("es-AR") ?? ""}
          </span>` : ""}
      </div>`;

    // ── HTML completo ───────────────────────────────────────────
    const html = `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8"/>
  <title>CV_${name}</title>
  <link href="https://fonts.googleapis.com/css2?family=Montserrat:wght@400;500;600;700;800;900&display=swap" rel="stylesheet"/>
  <style>
    * { margin:0; padding:0; box-sizing:border-box; }
    body { background:#fff; color:#000; font-family:'Montserrat',sans-serif; }
    @page { size:A4; margin:18mm 16mm; }
    @media print {
      body { -webkit-print-color-adjust:exact; print-color-adjust:exact; }
      .no-print { display:none !important; }
    }
  </style>
</head>
<body>
<div style="max-width:794px;margin:0 auto;padding:0 0 48px;">

  <!-- HEADER ──────────────────────────────────────── -->
  <div style="page-break-inside:avoid;display:flex;justify-content:space-between;align-items:flex-start;gap:24px;padding-bottom:20px;border-bottom:3px solid #000;margin-bottom:28px;flex-wrap:wrap;">

    <!-- Nombre + headline -->
    <div style="flex:1;min-width:200px;padding:30px;">
      <div style="font-family:'Montserrat',sans-serif;font-size:8px;font-weight:800;letter-spacing:6px;text-transform:uppercase;color:#888;margin-bottom:8px;">CURRICULUM VITAE</div>
      <h1 style="font-family:'Montserrat',sans-serif;font-size:42px;font-weight:900;letter-spacing:-2.5px;text-transform:uppercase;line-height:0.92;color:#000;margin-bottom:10px;">
        ${p.firstName}<br/>${p.lastName}
      </h1>
      ${p.headline ? `<p style="font-family:'Montserrat',sans-serif;font-size:12px;font-weight:600;color:#555;line-height:1.5;margin-top:8px;max-width:380px;">${p.headline}</p>` : ""}
    </div>

    <!-- Foto + contacto -->
    <div style="display:flex;flex-direction:column;align-items:flex-end;gap:10px;margin-top:30px;">
      ${p.photo ? `<img src="${p.photo}" alt="Foto" style="width:90px;height:90px;object-fit:cover;border:2px solid #000;border-radius:2px;display:block;" />` : ""}
      <div style="display:flex;flex-direction:column;align-items:flex-end;gap:4px;">
        ${p.email    ? `<span style="font-family:'Montserrat',sans-serif;font-size:11px;font-weight:600;color:#333;">${p.email}</span>` : ""}
        ${p.phone    ? `<span style="font-family:'Montserrat',sans-serif;font-size:11px;font-weight:600;color:#333;">${p.phone}</span>` : ""}
        ${p.location ? `<span style="font-family:'Montserrat',sans-serif;font-size:11px;font-weight:600;color:#333;">${p.location}</span>` : ""}
        ${p.linkedin ? `<span style="font-family:'Montserrat',sans-serif;font-size:10px;font-weight:800;letter-spacing:0.5px;color:#000;text-transform:uppercase;">${p.linkedin}</span>` : ""}
        ${p.github   ? `<span style="font-family:'Montserrat',sans-serif;font-size:10px;font-weight:800;letter-spacing:0.5px;color:#555;text-transform:uppercase;">${p.github}</span>` : ""}
        ${p.portfolio? `<span style="font-family:'Montserrat',sans-serif;font-size:10px;font-weight:800;letter-spacing:0.5px;color:#555;text-transform:uppercase;">${p.portfolio}</span>` : ""}
      </div>
    </div>
  </div>

  <!-- RESUMEN ─────────────────────────────────────── -->
  ${p.summary ? section("PERFIL PROFESIONAL", `<p style="font-family:'Montserrat',sans-serif;font-size:13px;font-weight:500;color:#222;line-height:1.85;border-left:3px solid #000;padding-left:16px;">${p.summary}</p>`) : ""}

  <!-- EXPERIENCIA ─────────────────────────────────── -->
  ${cv.experience.length > 0 ? section("EXPERIENCIA LABORAL", experienceHTML) : ""}

  <!-- EDUCACIÓN ───────────────────────────────────── -->
  ${cv.education.length > 0 ? section("EDUCACIÓN", educationHTML) : ""}

  <!-- SKILLS ──────────────────────────────────────── -->
  ${cv.skills.length > 0 ? section("SKILLS TÉCNICAS", `<div style="display:flex;flex-wrap:wrap;gap:4px;">${skillTags}</div>`) : ""}

  <!-- PROYECTOS ───────────────────────────────────── -->
  ${cv.projects.length > 0 ? section("PROYECTOS", projectsHTML) : ""}

  <!-- CERTIFICACIONES ─────────────────────────────── -->
  ${cv.certifications.length > 0 ? section("CERTIFICACIONES", certsHTML) : ""}

  <!-- IDIOMAS ─────────────────────────────────────── -->
  ${cv.languages.length > 0 ? section("IDIOMAS", langsHTML) : ""}

  <!-- DISPONIBILIDAD ──────────────────────────────── -->
  ${cv.availability ? section("DISPONIBILIDAD", dispHTML) : ""}

</div>

<!-- Botón imprimir -->
<div class="no-print" style="position:fixed;bottom:24px;right:24px;display:flex;gap:10px;">
  <button onclick="window.print()" style="background:#000;border:none;color:#fff;font-family:'Montserrat',sans-serif;font-size:11px;font-weight:900;letter-spacing:2px;text-transform:uppercase;padding:14px 28px;cursor:pointer;">
    ↓ GUARDAR PDF
  </button>
</div>

</body>
</html>`;

    const win = window.open("", "_blank");
    if (!win) { notify("Permitir popups para exportar", "error"); return; }
    win.document.write(html);
    win.document.close();
  };

  // Helpers para arrays
  const addExp   = () => setCV(c => ({ ...c, experience:     [...c.experience,     { company:"",position:"",location:"",startDate:"",endDate:"",current:false,description:"" }] }));
  const addEdu   = () => setCV(c => ({ ...c, education:      [...c.education,      { institution:"",degree:"",field:"",startDate:"",endDate:"",current:false,description:"" }] }));
  const addCert  = () => setCV(c => ({ ...c, certifications: [...c.certifications, { name:"",issuer:"",date:"",credentialId:"",url:"" }] }));
  const addLang  = () => setCV(c => ({ ...c, languages:      [...c.languages,      { language:"",level:"Intermedio" as const }] }));
  const addProj  = () => setCV(c => ({ ...c, projects:       [...c.projects,       { name:"",description:"",url:"",repoUrl:"",technologies:[] }] }));

  const setPI  = (k: keyof PersonalInfo, v: string) => setCV(c => ({ ...c, personalInfo:    { ...c.personalInfo,    [k]: v } }));
  const setExp = (i: number, k: keyof Experience,  v: any) => setCV(c => { const a = [...c.experience];     a[i] = { ...a[i], [k]: v }; return { ...c, experience:     a }; });
  const setEdu = (i: number, k: keyof Education,   v: any) => setCV(c => { const a = [...c.education];      a[i] = { ...a[i], [k]: v }; return { ...c, education:      a }; });
  const setCert= (i: number, k: keyof Certification,v: any)=> setCV(c => { const a = [...c.certifications]; a[i] = { ...a[i], [k]: v }; return { ...c, certifications: a }; });
  const setLang= (i: number, k: keyof Language,    v: any) => setCV(c => { const a = [...c.languages];      a[i] = { ...a[i], [k]: v }; return { ...c, languages:      a }; });
  const setProj= (i: number, k: keyof Project,     v: any) => setCV(c => { const a = [...c.projects];       a[i] = { ...a[i], [k]: v }; return { ...c, projects:        a }; });
  const setWP  = (k: keyof WorkPreferences, v: any)         => setCV(c => ({ ...c, workPreferences: { ...c.workPreferences, [k]: v } }));

  const toggleWP = (k: "modality"|"contractType", v: string) =>
    setWP(k, cv.workPreferences[k].includes(v)
      ? cv.workPreferences[k].filter((x:string) => x !== v)
      : [...cv.workPreferences[k], v]);

  if (loading) return (
    <div className="cv-loading">
      <span className="dm-loading-dot"/><span className="dm-loading-dot"/><span className="dm-loading-dot"/>
    </div>
  );

  return (
    <div className={`cv-builder${isLight ? " light" : ""}`}>

      {/* Header */}
      <div className="cv-builder-header">
        <div>
          <span className="cv-eyebrow">// MI_CURRICULUM</span>
          <h2 className="cv-title">CONSTRUIR <span>CV</span></h2>
        </div>
        <div className="cv-header-actions">
          <button className="cv-btn cv-btn--ghost" onClick={exportPDF}>↓ EXPORTAR PDF</button>
          <button className="cv-btn cv-btn--accent" onClick={save} disabled={saving}>
            {saving ? "GUARDANDO..." : "GUARDAR CV"}
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="cv-tabs">
        {TABS_DEF.map(t => (
          <button
            key={t.id}
            className={`cv-tab${activeTab === t.id ? " active" : ""}`}
            onClick={() => setActiveTab(t.id)}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="cv-body">

        {/* ── DATOS PERSONALES ── */}
        {activeTab === "personal" && (
          <div className="cv-section">
            <SectionHeader title="// DATOS_PERSONALES" />

            {/* Foto de perfil */}
            <div className="cv-photo-row">
              <div className="cv-photo-preview">
                {cv.personalInfo.photo
                  ? <img src={cv.personalInfo.photo} alt="Foto de perfil" className="cv-photo-img" />
                  : <div className="cv-photo-placeholder">
                      <span>FOTO</span>
                      <span style={{ fontSize: "0.6rem", opacity: 0.5 }}>OPCIONAL</span>
                    </div>
                }
              </div>
              <div className="cv-photo-actions">
                <p className="cv-hint">Foto de perfil opcional para el CV. Recomendado: cuadrada, formato JPG o PNG.</p>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 8 }}>
                  <button
                    className="cv-btn cv-btn--ghost"
                    onClick={() => photoInputRef.current?.click()}
                    disabled={uploading}
                  >
                    {uploading ? "SUBIENDO..." : cv.personalInfo.photo ? "CAMBIAR FOTO" : "SUBIR FOTO"}
                  </button>
                  {cv.personalInfo.photo && (
                    <button
                      className="cv-btn cv-btn--ghost"
                      style={{ borderColor: "rgba(244,63,94,0.4)", color: "#f43f5e" }}
                      onClick={() => { setPhotoFile(null); setPI("photo", ""); }}
                    >
                      QUITAR
                    </button>
                  )}
                </div>
                <input
                  ref={photoInputRef}
                  type="file"
                  accept="image/*"
                  style={{ display: "none" }}
                  onChange={handlePhotoChange}
                />
              </div>
            </div>
            <div className="cv-grid-2">
              <Field label="Nombre" required><Input value={cv.personalInfo.firstName} onChange={v => setPI("firstName", v)} placeholder="Juan" /></Field>
              <Field label="Apellido" required><Input value={cv.personalInfo.lastName} onChange={v => setPI("lastName", v)} placeholder="Pérez" /></Field>
            </div>
            <Field label="Título profesional"><Input value={cv.personalInfo.headline} onChange={v => setPI("headline", v)} placeholder="Senior Backend Developer · 5 años de experiencia" /></Field>
            <div className="cv-grid-2">
              <Field label="Email" required><Input value={cv.personalInfo.email} onChange={v => setPI("email", v)} type="email" placeholder="juan@email.com" /></Field>
              <Field label="Teléfono"><Input value={cv.personalInfo.phone} onChange={v => setPI("phone", v)} placeholder="+54 9 11 1234-5678" /></Field>
            </div>
            <Field label="Ubicación"><Input value={cv.personalInfo.location} onChange={v => setPI("location", v)} placeholder="Buenos Aires, Argentina" /></Field>
            <div className="cv-grid-3">
              <Field label="LinkedIn"><Input value={cv.personalInfo.linkedin} onChange={v => setPI("linkedin", v)} placeholder="linkedin.com/in/usuario" /></Field>
              <Field label="GitHub"><Input value={cv.personalInfo.github} onChange={v => setPI("github", v)} placeholder="github.com/usuario" /></Field>
              <Field label="Portfolio"><Input value={cv.personalInfo.portfolio} onChange={v => setPI("portfolio", v)} placeholder="miportfolio.com" /></Field>
            </div>
            <Field label="Resumen profesional"><Textarea value={cv.personalInfo.summary} onChange={v => setPI("summary", v)} rows={5} placeholder="Describí tu perfil, fortalezas y lo que buscás profesionalmente..." /></Field>
          </div>
        )}

        {/* ── EXPERIENCIA ── */}
        {activeTab === "experience" && (
          <div className="cv-section">
            <SectionHeader title="// EXPERIENCIA_LABORAL" onAdd={addExp} addLabel="+ Agregar experiencia" />
            {cv.experience.length === 0 && <p className="cv-empty">No hay experiencias cargadas todavía.</p>}
            {cv.experience.map((e, i) => (
              <CardBlock key={i} onRemove={() => setCV(c => ({ ...c, experience: c.experience.filter((_,j) => j !== i) }))}>
                <div className="cv-grid-2">
                  <Field label="Empresa" required><Input value={e.company} onChange={v => setExp(i,"company",v)} placeholder="Empresa S.A." /></Field>
                  <Field label="Cargo" required><Input value={e.position} onChange={v => setExp(i,"position",v)} placeholder="Senior Developer" /></Field>
                </div>
                <Field label="Ubicación"><Input value={e.location} onChange={v => setExp(i,"location",v)} placeholder="Buenos Aires / Remoto" /></Field>
                <div className="cv-grid-3">
                  <Field label="Desde (YYYY-MM)"><Input value={e.startDate} onChange={v => setExp(i,"startDate",v)} placeholder="2021-03" /></Field>
                  <Field label="Hasta (YYYY-MM)">
                    <Input value={e.endDate} onChange={v => setExp(i,"endDate",v)} placeholder="2023-08" />
                  </Field>
                  <Field label="¿Trabajo actual?">
                    <label className="cv-checkbox-row">
                      <input type="checkbox" checked={e.current} onChange={ev => setExp(i,"current",ev.target.checked)} className="cv-checkbox" />
                      <span>Sí, trabajo aquí</span>
                    </label>
                  </Field>
                </div>
                <Field label="Descripción de tareas"><Textarea value={e.description} onChange={v => setExp(i,"description",v)} placeholder="Describí tus responsabilidades, logros y tecnologías usadas..." /></Field>
              </CardBlock>
            ))}
          </div>
        )}

        {/* ── EDUCACIÓN ── */}
        {activeTab === "education" && (
          <div className="cv-section">
            <SectionHeader title="// EDUCACIÓN" onAdd={addEdu} addLabel="+ Agregar educación" />
            {cv.education.length === 0 && <p className="cv-empty">No hay educación cargada todavía.</p>}
            {cv.education.map((e, i) => (
              <CardBlock key={i} onRemove={() => setCV(c => ({ ...c, education: c.education.filter((_,j) => j !== i) }))}>
                <Field label="Institución" required><Input value={e.institution} onChange={v => setEdu(i,"institution",v)} placeholder="Universidad de Buenos Aires" /></Field>
                <div className="cv-grid-2">
                  <Field label="Título / Carrera"><Input value={e.degree} onChange={v => setEdu(i,"degree",v)} placeholder="Lic. en Sistemas" /></Field>
                  <Field label="Área / Especialización"><Input value={e.field} onChange={v => setEdu(i,"field",v)} placeholder="Ingeniería en Software" /></Field>
                </div>
                <div className="cv-grid-3">
                  <Field label="Desde (YYYY-MM)"><Input value={e.startDate} onChange={v => setEdu(i,"startDate",v)} placeholder="2017-03" /></Field>
                  <Field label="Hasta (YYYY-MM)"><Input value={e.endDate} onChange={v => setEdu(i,"endDate",v)} placeholder="2022-12" /></Field>
                  <Field label="¿En curso?">
                    <label className="cv-checkbox-row">
                      <input type="checkbox" checked={e.current} onChange={ev => setEdu(i,"current",ev.target.checked)} className="cv-checkbox" />
                      <span>Sí, en curso</span>
                    </label>
                  </Field>
                </div>
                <Field label="Descripción (opcional)"><Textarea value={e.description} onChange={v => setEdu(i,"description",v)} placeholder="Tesis, honores, actividades relevantes..." /></Field>
              </CardBlock>
            ))}
          </div>
        )}

        {/* ── SKILLS ── */}
        {activeTab === "skills" && (
          <div className="cv-section">
            <SectionHeader title="// SKILLS_TÉCNICAS" />
            <p className="cv-hint">Escribí para filtrar y hacé click para agregar. Podés seleccionar cuantas quieras.</p>
            <SkillSelector selected={cv.skills} onChange={s => setCV(c => ({ ...c, skills: s }))} />
            {cv.skills.length > 0 && (
              <p className="cv-skills-count">{cv.skills.length} skill{cv.skills.length !== 1 ? "s" : ""} seleccionada{cv.skills.length !== 1 ? "s" : ""}</p>
            )}
          </div>
        )}

        {/* ── CERTIFICACIONES ── */}
        {activeTab === "certs" && (
          <div className="cv-section">
            <SectionHeader title="// CERTIFICACIONES" onAdd={addCert} addLabel="+ Agregar certificación" />
            {cv.certifications.length === 0 && <p className="cv-empty">No hay certificaciones cargadas.</p>}
            {cv.certifications.map((c, i) => (
              <CardBlock key={i} onRemove={() => setCV(cv => ({ ...cv, certifications: cv.certifications.filter((_,j) => j !== i) }))}>
                <div className="cv-grid-2">
                  <Field label="Nombre del certificado" required><Input value={c.name} onChange={v => setCert(i,"name",v)} placeholder="AWS Solutions Architect" /></Field>
                  <Field label="Entidad emisora" required><Input value={c.issuer} onChange={v => setCert(i,"issuer",v)} placeholder="Amazon Web Services" /></Field>
                </div>
                <div className="cv-grid-3">
                  <Field label="Fecha (YYYY-MM)"><Input value={c.date} onChange={v => setCert(i,"date",v)} placeholder="2023-06" /></Field>
                  <Field label="ID de credencial"><Input value={c.credentialId} onChange={v => setCert(i,"credentialId",v)} placeholder="ABC123XYZ" /></Field>
                  <Field label="URL de verificación"><Input value={c.url} onChange={v => setCert(i,"url",v)} placeholder="https://verify.credly.com/..." /></Field>
                </div>
              </CardBlock>
            ))}
          </div>
        )}

        {/* ── IDIOMAS ── */}
        {activeTab === "languages" && (
          <div className="cv-section">
            <SectionHeader title="// IDIOMAS" onAdd={addLang} addLabel="+ Agregar idioma" />
            {cv.languages.length === 0 && <p className="cv-empty">No hay idiomas cargados.</p>}
            {cv.languages.map((l, i) => (
              <CardBlock key={i} onRemove={() => setCV(c => ({ ...c, languages: c.languages.filter((_,j) => j !== i) }))}>
                <div className="cv-grid-2">
                  <Field label="Idioma" required><Input value={l.language} onChange={v => setLang(i,"language",v)} placeholder="Inglés" /></Field>
                  <Field label="Nivel">
                    <select className="cv-input cv-select" value={l.level} onChange={e => setLang(i,"level",e.target.value)}>
                      {["Nativo","Avanzado","Intermedio","Básico"].map(lv => <option key={lv}>{lv}</option>)}
                    </select>
                  </Field>
                </div>
              </CardBlock>
            ))}
          </div>
        )}

        {/* ── PROYECTOS ── */}
        {activeTab === "projects" && (
          <div className="cv-section">
            <SectionHeader title="// PROYECTOS" onAdd={addProj} addLabel="+ Agregar proyecto" />
            {cv.projects.length === 0 && <p className="cv-empty">No hay proyectos cargados.</p>}
            {cv.projects.map((p, i) => (
              <CardBlock key={i} onRemove={() => setCV(c => ({ ...c, projects: c.projects.filter((_,j) => j !== i) }))}>
                <Field label="Nombre del proyecto" required><Input value={p.name} onChange={v => setProj(i,"name",v)} placeholder="Mi App" /></Field>
                <Field label="Descripción"><Textarea value={p.description} onChange={v => setProj(i,"description",v)} placeholder="¿Qué hace el proyecto? ¿Cuál fue tu rol?" /></Field>
                <div className="cv-grid-2">
                  <Field label="URL demo / live"><Input value={p.url} onChange={v => setProj(i,"url",v)} placeholder="https://miapp.com" /></Field>
                  <Field label="Repositorio"><Input value={p.repoUrl} onChange={v => setProj(i,"repoUrl",v)} placeholder="https://github.com/..." /></Field>
                </div>
                <Field label="Tecnologías usadas">
                  <SkillSelector selected={p.technologies} onChange={v => setProj(i,"technologies",v)} />
                </Field>
              </CardBlock>
            ))}
          </div>
        )}

        {/* ── PREFERENCIAS ── */}
        {activeTab === "prefs" && (
          <div className="cv-section">
            <SectionHeader title="// PREFERENCIAS_LABORALES" />

            <Field label="Disponibilidad">
              <select className="cv-input cv-select" value={cv.availability} onChange={e => setCV(c => ({ ...c, availability: e.target.value }))}>
                {["Inmediata","2 semanas","1 mes","No disponible"].map(a => <option key={a}>{a}</option>)}
              </select>
            </Field>

            <Field label="Modalidad preferida">
              <div className="cv-checkbox-group">
                {["Remoto","Presencial","Híbrido"].map(m => (
                  <label key={m} className="cv-checkbox-row">
                    <input type="checkbox" checked={cv.workPreferences.modality.includes(m)} onChange={() => toggleWP("modality", m)} className="cv-checkbox" />
                    <span>{m}</span>
                  </label>
                ))}
              </div>
            </Field>

            <Field label="Tipo de contrato">
              <div className="cv-checkbox-group">
                {["Full-time","Part-time","Freelance","Pasantía"].map(c => (
                  <label key={c} className="cv-checkbox-row">
                    <input type="checkbox" checked={cv.workPreferences.contractType.includes(c)} onChange={() => toggleWP("contractType", c)} className="cv-checkbox" />
                    <span>{c}</span>
                  </label>
                ))}
              </div>
            </Field>

            <Field label="Expectativa salarial">
              <div className="cv-salary-row">
                <input className="cv-input" type="number" placeholder="Mínimo" value={cv.workPreferences.salaryMin ?? ""} onChange={e => setWP("salaryMin", e.target.value ? Number(e.target.value) : null)} />
                <span className="cv-salary-sep">—</span>
                <input className="cv-input" type="number" placeholder="Máximo" value={cv.workPreferences.salaryMax ?? ""} onChange={e => setWP("salaryMax", e.target.value ? Number(e.target.value) : null)} />
                <select className="cv-input cv-select cv-select--sm" value={cv.workPreferences.currency} onChange={e => setWP("currency", e.target.value)}>
                  {["USD","ARS","EUR","BRL"].map(c => <option key={c}>{c}</option>)}
                </select>
              </div>
            </Field>
          </div>
        )}

        {/* ── VISTA PREVIA ── */}
        {activeTab === "preview" && (
          <div className="cv-section cv-section--preview">
            <div className="cv-preview-actions">
              <button className="cv-btn cv-btn--accent" onClick={exportPDF}>↓ EXPORTAR PDF</button>
              <button className="cv-btn cv-btn--ghost" onClick={save} disabled={saving}>{saving ? "GUARDANDO..." : "GUARDAR"}</button>
            </div>
            <CVPreview cv={cv} />
          </div>
        )}

      </div>

      {/* Toast */}
      {toast && (
        <div className={`cv-toast cv-toast--${toast.type}`}>
          <span className="cv-toast-dot" />
          {toast.msg}
        </div>
      )}

    </div>
  );
}