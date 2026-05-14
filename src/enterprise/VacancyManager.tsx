import { useState, useEffect, useRef } from "react";
import axios from "axios";
import { UseTheme } from "../contexts/ThemeContext";
import { UseSession } from "../contexts/SessionContext";
import "./vacancyManager.css";

// ─── Types ────────────────────────────────────────────────────────────────────
type Status = "active" | "paused" | "closed";
type ExperienceLevel = "Junior" | "Semi-Senior" | "Senior" | "Lead" | "Manager";
type Modality = "Remoto" | "Presencial" | "Híbrido";
type ContractType = "Full-time" | "Part-time" | "Freelance" | "Pasantía";

interface SalaryRange {
  min: string;
  max: string;
  currency: string;
  visible: boolean;
}

interface Vacancy {
  _id: string;
  title: string;
  description: string;
  requirements: string;
  skills: string[];
  experienceLevel: ExperienceLevel;
  modality: Modality;
  contractType: ContractType;
  location: string;
  salaryRange: SalaryRange;
  closesAt: string;
  publishedBy: string;
  companyName?: string | null;
  companyLogo?: string | null;
  applicants?: string[];
  status: Status;
}

type VacancyForm = Omit<Vacancy, "_id" | "applicants" | "status" | "publishedBy">;

// ─── Constantes ───────────────────────────────────────────────────────────────
const IT_SKILLS: string[] = [
  "JavaScript","TypeScript","Python","Java","C#","C++","Go","Rust","PHP","Ruby",
  "React","Vue.js","Angular","Next.js","Nuxt.js","Svelte",
  "Node.js","Express.js","NestJS","Django","FastAPI","Spring Boot","Laravel",
  "MongoDB","PostgreSQL","MySQL","Redis","Elasticsearch","Firebase",
  "Docker","Kubernetes","AWS","Google Cloud","Azure","Terraform",
  "Git","GitHub","GitLab","CI/CD","Jenkins","GitHub Actions",
  "Linux","Bash","PowerShell",
  "REST APIs","GraphQL","WebSockets","gRPC","Microservices",
  "Cybersecurity","Ethical Hacking","Pentesting","OSINT","SOC","SIEM",
  "Networking","TCP/IP","Firewalls","VPN","SSL/TLS",
  "Machine Learning","Deep Learning","TensorFlow","PyTorch","Data Science",
  "Agile","Scrum","Kanban","Jira","Confluence",
  "React Native","Flutter","iOS","Android",
  "Figma","UI/UX","Tailwind CSS","SASS",
  "Selenium","Cypress","Jest","Testing","QA",
  "Blockchain","Web3","Solidity",
  "SAP","Salesforce","Power BI","Tableau",
];

const BLANK_FORM: VacancyForm = {
  title: "",
  description: "",
  requirements: "",
  skills: [],
  experienceLevel: "Junior",
  modality: "Remoto",
  contractType: "Full-time",
  location: "",
  salaryRange: { min: "", max: "", currency: "USD", visible: true },
  closesAt: "",
  companyName: null,
  companyLogo: null,
};

const STATUS_LABELS: Record<Status, string> = {
  active: "ACTIVA",
  paused: "PAUSADA",
  closed: "CERRADA",
};

// ─── SkillSelector ────────────────────────────────────────────────────────────
interface SkillSelectorProps {
  selected: string[];
  onChange: (skills: string[]) => void;
}

function SkillSelector({ selected, onChange }: SkillSelectorProps) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  const filtered = IT_SKILLS.filter(
    (s) => !selected.includes(s) && s.toLowerCase().includes(query.toLowerCase())
  );

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const add = (skill: string) => { onChange([...selected, skill]); setQuery(""); };
  const remove = (skill: string) => onChange(selected.filter((s) => s !== skill));

  return (
    <div ref={wrapRef} className="hs-skill-selector">
      <div className="hs-skill-input-box" onClick={() => setOpen(true)}>
        {selected.map((skill) => (
          <span key={skill} className="hs-skill-tag">
            {skill}
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); remove(skill); }}
              className="hs-skill-remove"
            >×</button>
          </span>
        ))}
        <input
          value={query}
          onChange={(e) => { setQuery(e.target.value); setOpen(true); }}
          onFocus={() => setOpen(true)}
          placeholder={selected.length === 0 ? "Buscar y agregar skills..." : ""}
          className="hs-skill-search"
        />
      </div>
      {open && filtered.length > 0 && (
        <div className="hs-skill-dropdown">
          {filtered.slice(0, 30).map((skill) => (
            <div
              key={skill}
              onMouseDown={(e) => { e.preventDefault(); add(skill); }}
              className="hs-skill-option"
            >
              {skill}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Field ────────────────────────────────────────────────────────────────────
interface FieldProps {
  label: string;
  required?: boolean;
  hint?: string;
  error?: string;
  children: React.ReactNode;
}

function Field({ label, required, hint, error, children }: FieldProps) {
  return (
    <div className="hs-field">
      <label className="hs-field-label">
        {label} {required && <span className="hs-required">*</span>}
      </label>
      {children}
      {hint  && <p className="hs-field-hint">{hint}</p>}
      {error && <p className="hs-field-error">{error}</p>}
    </div>
  );
}

// ─── Modal ────────────────────────────────────────────────────────────────────
interface VacancyModalProps {
  initial: Vacancy | null;
  onSave: (form: VacancyForm) => void;
  onClose: () => void;
}

function VacancyModal({ initial, onSave, onClose }: VacancyModalProps) {
  const { user } = UseSession();
  const companyName = user?.companyName ?? null;
  const companyLogo = user?.companyLogo ?? null;

  const [form, setForm] = useState<VacancyForm>(
    initial
      ? {
          title:           initial.title,
          description:     initial.description,
          requirements:    initial.requirements,
          skills:          initial.skills,
          experienceLevel: initial.experienceLevel,
          modality:        initial.modality,
          contractType:    initial.contractType,
          location:        initial.location,
          salaryRange:     initial.salaryRange,
          closesAt:        initial.closesAt ? initial.closesAt.split("T")[0] : "",
          companyName:     initial.companyName ?? null,
          companyLogo:     initial.companyLogo ?? null,
        }
      : { ...BLANK_FORM, companyName, companyLogo }
  );

  const [errors, setErrors] = useState<Partial<Record<keyof VacancyForm, string>>>({});

  const set = <K extends keyof VacancyForm>(key: K, value: VacancyForm[K]) =>
    setForm((f) => ({ ...f, [key]: value }));

  const setSalary = (key: keyof SalaryRange, value: string | boolean) =>
    setForm((f) => ({ ...f, salaryRange: { ...f.salaryRange, [key]: value } }));

  const validate = () => {
    const e: typeof errors = {};
    if (!form.title.trim())        e.title        = "Campo requerido";
    if (!form.description.trim())  e.description  = "Campo requerido";
    if (!form.requirements.trim()) e.requirements = "Campo requerido";
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const submit = () => { if (validate()) onSave(form); };

  return (
    <div className="hs-modal-overlay">
      <div className="hs-modal">

        {/* Header */}
        <div className="hs-modal-header">
          <div>
            <span className="hs-terminal-text">
              {initial ? "// EDITAR_VACANTE" : "// NUEVA_VACANTE"}
            </span>
            <h2 className="hs-modal-title">
              {initial ? "Editar posición" : "Publicar posición"}
            </h2>
          </div>
          <button className="hs-modal-close" onClick={onClose}>×</button>
        </div>

        {/* Body */}
        <div className="hs-modal-body">

          {/* Preview empresa — datos de las claims, solo lectura */}
          <div className="hs-modal-company-preview">
            <span className="hs-terminal-text hs-terminal-text--sm">// PUBLICADO_POR</span>
            <div className="hs-modal-company-row">
              {companyLogo
                ? <img src={companyLogo} alt={companyName ?? "empresa"} className="hs-modal-company-logo" />
                : <div className="hs-modal-company-placeholder">{(companyName ?? "?")[0].toUpperCase()}</div>
              }
              <span className="hs-modal-company-name">
                {companyName ?? <span className="hs-modal-company-empty">Sin nombre de empresa en claims</span>}
              </span>
            </div>
          </div>

          {/* Título */}
          <Field label="Título del puesto" required error={errors.title}>
            <input
              className={`hs-input${errors.title ? " hs-input--error" : ""}`}
              placeholder="Ej: Senior Backend Engineer"
              value={form.title}
              onChange={(e) => set("title", e.target.value)}
            />
          </Field>

          {/* Descripción */}
          <Field label="Descripción" required error={errors.description}>
            <textarea
              className={`hs-input hs-textarea${errors.description ? " hs-input--error" : ""}`}
              placeholder="Describí el rol, responsabilidades y el equipo..."
              value={form.description}
              onChange={(e) => set("description", e.target.value)}
              rows={4}
            />
          </Field>

          {/* Requisitos */}
          <Field label="Requisitos" required error={errors.requirements}>
            <textarea
              className={`hs-input hs-textarea${errors.requirements ? " hs-input--error" : ""}`}
              placeholder="Formación, experiencia mínima, certificaciones..."
              value={form.requirements}
              onChange={(e) => set("requirements", e.target.value)}
              rows={3}
            />
          </Field>

          {/* Skills */}
          <Field label="Skills requeridas" hint="Escribí para filtrar · Click para agregar">
            <SkillSelector selected={form.skills} onChange={(v) => set("skills", v)} />
          </Field>

          {/* Nivel · Modalidad · Contrato */}
          <div className="hs-grid-3">
            <Field label="Nivel" required>
              <select
                className="hs-input hs-select"
                value={form.experienceLevel}
                onChange={(e) => set("experienceLevel", e.target.value as ExperienceLevel)}
              >
                {(["Junior","Semi-Senior","Senior","Lead","Manager"] as ExperienceLevel[]).map((v) => (
                  <option key={v} value={v}>{v}</option>
                ))}
              </select>
            </Field>
            <Field label="Modalidad" required>
              <select
                className="hs-input hs-select"
                value={form.modality}
                onChange={(e) => set("modality", e.target.value as Modality)}
              >
                {(["Remoto","Presencial","Híbrido"] as Modality[]).map((v) => (
                  <option key={v} value={v}>{v}</option>
                ))}
              </select>
            </Field>
            <Field label="Contrato" required>
              <select
                className="hs-input hs-select"
                value={form.contractType}
                onChange={(e) => set("contractType", e.target.value as ContractType)}
              >
                {(["Full-time","Part-time","Freelance","Pasantía"] as ContractType[]).map((v) => (
                  <option key={v} value={v}>{v}</option>
                ))}
              </select>
            </Field>
          </div>

          {/* Ubicación */}
          <Field label="Ubicación">
            <input
              className="hs-input"
              placeholder="Ciudad, país o 'Remoto'"
              value={form.location}
              onChange={(e) => set("location", e.target.value)}
            />
          </Field>

          {/* Salario */}
          <Field label="Rango salarial" hint="Opcional. Dejá vacío para no mostrar.">
            <div className="hs-salary-row">
              <input
                className="hs-input"
                type="number"
                placeholder="Mínimo"
                value={form.salaryRange.min}
                onChange={(e) => setSalary("min", e.target.value)}
              />
              <input
                className="hs-input"
                type="number"
                placeholder="Máximo"
                value={form.salaryRange.max}
                onChange={(e) => setSalary("max", e.target.value)}
              />
              <select
                className="hs-input hs-select hs-select--narrow"
                value={form.salaryRange.currency}
                onChange={(e) => setSalary("currency", e.target.value)}
              >
                {["USD","ARS","EUR","BRL"].map((c) => <option key={c}>{c}</option>)}
              </select>
            </div>
            <label className="hs-checkbox-row">
              <input
                type="checkbox"
                checked={form.salaryRange.visible}
                onChange={(e) => setSalary("visible", e.target.checked)}
                className="hs-checkbox"
              />
              <span className="hs-checkbox-label">Mostrar rango en la publicación</span>
            </label>
          </Field>

          {/* Fecha de cierre */}
          <Field label="Fecha de cierre">
            <input
              className="hs-input"
              type="date"
              value={form.closesAt}
              onChange={(e) => set("closesAt", e.target.value)}
            />
          </Field>

        </div>

        {/* Footer */}
        <div className="hs-modal-footer">
          <button className="hs-btn hs-btn--ghost" onClick={onClose}>
            Cancelar
          </button>
          <button className="hs-btn hs-btn--accent" onClick={submit}>
            {initial ? "Guardar cambios" : "Publicar vacante"}
          </button>
        </div>

      </div>
    </div>
  );
}

// ─── VacancyCard ──────────────────────────────────────────────────────────────
interface VacancyCardProps {
  vacancy: Vacancy;
  onEdit: (v: Vacancy) => void;
  onDelete: (id: string) => void;
  onToggleStatus: (id: string, status: Status) => void;
}

function VacancyCard({ vacancy, onEdit, onDelete, onToggleStatus }: VacancyCardProps) {
  const [confirmDelete, setConfirmDelete] = useState(false);

  const handleDelete = () => {
    if (confirmDelete) {
      onDelete(vacancy._id);
    } else {
      setConfirmDelete(true);
      setTimeout(() => setConfirmDelete(false), 3000);
    }
  };

  return (
    <div className={`hs-card hs-card--${vacancy.status}`}>

      {/* Empresa */}
      <div className="hs-card-company">
        {vacancy.companyLogo
          ? <img src={vacancy.companyLogo} alt={vacancy.companyName ?? "empresa"} className="hs-card-company-logo" />
          : <div className="hs-card-company-placeholder">{(vacancy.companyName ?? "?")[0].toUpperCase()}</div>
        }
        {vacancy.companyName && (
          <span className="hs-card-company-name">{vacancy.companyName}</span>
        )}
      </div>

      {/* Header */}
      <div className="hs-card-header">
        <div className="hs-card-meta">
          <span className="hs-terminal-text hs-terminal-text--sm">// POSICIÓN</span>
          <h3 className="hs-card-title">{vacancy.title}</h3>
          <p className="hs-card-subtitle">
            {vacancy.modality} · {vacancy.contractType} · {vacancy.experienceLevel}
            {vacancy.location ? ` · ${vacancy.location}` : ""}
          </p>
        </div>
        <span className={`hs-status-badge hs-status-badge--${vacancy.status}`}>
          {STATUS_LABELS[vacancy.status]}
        </span>
      </div>

      {/* Skills */}
      {vacancy.skills.length > 0 && (
        <div className="hs-card-skills">
          {vacancy.skills.slice(0, 7).map((s) => (
            <span key={s} className="hs-card-skill">{s}</span>
          ))}
          {vacancy.skills.length > 7 && (
            <span className="hs-card-skill-more">+{vacancy.skills.length - 7}</span>
          )}
        </div>
      )}

      {/* Salario */}
      {vacancy.salaryRange?.visible && (vacancy.salaryRange.min || vacancy.salaryRange.max) && (
        <div className="hs-card-salary">
          <span className="hs-terminal-text hs-terminal-text--sm" style={{ display: "inline" }}>
            {vacancy.salaryRange.currency}
          </span>
          {" "}
          {vacancy.salaryRange.min && Number(vacancy.salaryRange.min).toLocaleString("es-AR")}
          {vacancy.salaryRange.min && vacancy.salaryRange.max && " — "}
          {vacancy.salaryRange.max && Number(vacancy.salaryRange.max).toLocaleString("es-AR")}
        </div>
      )}

      {/* Cierre */}
      {vacancy.closesAt && (
        <p className="hs-card-closes">
          Cierra: {new Date(vacancy.closesAt).toLocaleDateString("es-AR", { day: "2-digit", month: "short", year: "numeric" })}
        </p>
      )}

      {/* Footer */}
      <div className="hs-card-footer">
        <span className="hs-card-applicants">
          {vacancy.applicants?.length ?? 0} aplicantes
        </span>
        <div className="hs-card-actions">
          <button
            className="hs-action-btn"
            title={vacancy.status === "paused" ? "Activar" : "Pausar"}
            onClick={() =>
              onToggleStatus(vacancy._id, vacancy.status === "paused" ? "active" : "paused")
            }
          >
            {vacancy.status === "paused" ? "ACTIVAR" : "PAUSAR"}
          </button>
          <button
            className="hs-action-btn hs-action-btn--accent"
            onClick={() => onEdit(vacancy)}
          >
            EDITAR
          </button>
          <button
            className={`hs-action-btn hs-action-btn--danger${confirmDelete ? " hs-action-btn--confirm" : ""}`}
            onClick={handleDelete}
          >
            {confirmDelete ? "¿CONFIRMAR?" : "ELIMINAR"}
          </button>
        </div>
      </div>

    </div>
  );
}

// ─── Toast ────────────────────────────────────────────────────────────────────
interface ToastState { msg: string; type: "success" | "error" }

// ─── VacancyManager principal ─────────────────────────────────────────────────
export default function VacancyManager() {
  const { theme } = UseTheme();
  const isLight = theme === "light";

  const [vacancies,      setVacancies]      = useState<Vacancy[]>([]);
  const [showModal,      setShowModal]      = useState(false);
  const [editingVacancy, setEditingVacancy] = useState<Vacancy | null>(null);
  const [filterStatus,   setFilterStatus]   = useState<Status | "all">("all");
  const [toast,          setToast]          = useState<ToastState | null>(null);

  const notify = (msg: string, type: "success" | "error" = "success") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  };

  const fetchVacancies = () => {
    axios
      .get(`${import.meta.env.VITE_API_URL}/api/vacancies`, { withCredentials: true })
      .then(({ data }) => setVacancies(Array.isArray(data.data) ? data.data : []))
      .catch(() => notify("Error al cargar vacantes", "error"));
  };

  useEffect(() => { fetchVacancies(); }, []);

  const openCreate = () => { setEditingVacancy(null); setShowModal(true); };
  const openEdit   = (v: Vacancy) => { setEditingVacancy(v); setShowModal(true); };
  const closeModal = () => { setShowModal(false); setEditingVacancy(null); };

  const handleSave = async (form: VacancyForm) => {
    try {
      if (editingVacancy) {
        await axios.put(
          `${import.meta.env.VITE_API_URL}/api/vacancy/${editingVacancy._id}`,
          form,
          { withCredentials: true }
        );
        notify("Vacante actualizada correctamente");
      } else {
        await axios.post(
          `${import.meta.env.VITE_API_URL}/api/vacancy`,
          form,
          { withCredentials: true }
        );
        notify("Vacante publicada");
      }
      closeModal();
      fetchVacancies();
    } catch {
      notify("Error al guardar la vacante", "error");
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await axios.delete(
        `${import.meta.env.VITE_API_URL}/api/vacancy/${id}`,
        { withCredentials: true }
      );
      notify("Vacante eliminada");
      fetchVacancies();
    } catch {
      notify("Error al eliminar", "error");
    }
  };

  const handleToggleStatus = async (id: string, newStatus: Status) => {
    try {
      await axios.patch(
        `${import.meta.env.VITE_API_URL}/api/vacancy/${id}/status`,
        { status: newStatus },
        { withCredentials: true }
      );
      notify(`Estado: ${STATUS_LABELS[newStatus]}`);
      fetchVacancies();
    } catch {
      notify("Error al cambiar estado", "error");
    }
  };

  const filtered = filterStatus === "all"
    ? vacancies.filter(Boolean)
    : vacancies.filter((v) => v?.status === filterStatus);

  const counts = {
    all:    vacancies.filter(Boolean).length,
    active: vacancies.filter((v) => v?.status === "active").length,
    paused: vacancies.filter((v) => v?.status === "paused").length,
    closed: vacancies.filter((v) => v?.status === "closed").length,
  };

  return (
    <div className={`hs-vacancy-manager${isLight ? " light" : ""}`}>

      {/* Header */}
      <div className="hs-vm-header">
        <div className="hs-vm-header-text">
          <span className="hs-terminal-text">// EMPRESA</span>
          <h1 className="hs-vm-title">
            GESTIÓN DE <span className="hs-accent">VACANTES</span>
          </h1>
        </div>
        <button className="hs-btn hs-btn--accent hs-btn--lg" onClick={openCreate}>
          + NUEVA VACANTE
        </button>
      </div>

      {/* Filtros */}
      <div className="hs-vm-filters">
        {(["all","active","paused","closed"] as const).map((s) => (
          <button
            key={s}
            className={`hs-filter-btn${filterStatus === s ? " hs-filter-btn--active" : ""}`}
            onClick={() => setFilterStatus(s)}
          >
            {s === "all" ? "TODAS" : STATUS_LABELS[s]}
            <span className="hs-filter-count">{counts[s]}</span>
          </button>
        ))}
      </div>

      {/* Grid */}
      {filtered.length === 0 ? (
        <div className="hs-empty">
          <span className="hs-terminal-text hs-terminal-text--lg">// NO_RESULTS</span>
          <p className="hs-empty-text">No hay vacantes en esta categoría</p>
        </div>
      ) : (
        <div className="hs-vacancy-grid">
          {filtered.map((v) => (
            <VacancyCard
              key={v._id}
              vacancy={v}
              onEdit={openEdit}
              onDelete={handleDelete}
              onToggleStatus={handleToggleStatus}
            />
          ))}
        </div>
      )}

      {/* Modal */}
      {showModal && (
        <VacancyModal initial={editingVacancy} onSave={handleSave} onClose={closeModal} />
      )}
    </div>
  );
}