import { useState, useEffect, useMemo, useRef, useCallback, type ReactNode } from "react";
import axios from "axios";
import { Link } from "react-router-dom";
import { UseTheme } from "../contexts/ThemeContext";
import { UseSession } from "../contexts/SessionContext";
import { HS_SKILLS } from "../skills/Skills"; // ⚠️ ajustá esta ruta si difiere de la del CV Builder
import "./vacancyManager.css";

// ─── Types ────────────────────────────────────────────────────────────────────
type Status = "active" | "paused" | "closed";
type ExperienceLevel = "Junior" | "Semi-Senior" | "Senior" | "Lead" | "Manager";
type Modality = "Remoto" | "Presencial" | "Híbrido";
type ContractType = "Full-time" | "Part-time" | "Freelance" | "Pasantía";
type SkillCategory = "roles" | "habilidades" | "herramientas";

interface SalaryRange {
  min: string;
  max: string;
  currency: string;
  visible: boolean;
}

// Skills requeridas por la vacante — mismo árbol que HS_SKILLS (skills.ts)
interface SkillsSelection {
  roles:        string[]; // HS_SKILLS.AREAS_Y_ROLES
  habilidades:  string[]; // HS_SKILLS.HABILIDADES
  herramientas: string[]; // HS_SKILLS.HERRAMIENTAS
}

interface Vacancy {
  _id: string;
  title: string;
  description: string;
  requirements: string;
  skills: SkillsSelection;
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

// ─── Catálogo de skills — las 3 ramas de HS_SKILLS ─────────────────────────────
const CATEGORY_LABELS: Record<SkillCategory, string> = {
  roles:        "Áreas y roles",
  habilidades:  "Habilidades",
  herramientas: "Herramientas",
};

const CATEGORY_CATALOGS: Record<SkillCategory, Record<string, readonly string[]>> = {
  roles:        HS_SKILLS.AREAS_Y_ROLES,
  habilidades:  HS_SKILLS.HABILIDADES,
  herramientas: HS_SKILLS.HERRAMIENTAS,
};

function emptySkills(): SkillsSelection {
  return { roles: [], habilidades: [], herramientas: [] };
}

function flattenSkills(s: SkillsSelection | undefined | null): string[] {
  if (!s) return [];
  return [...(s.roles ?? []), ...(s.habilidades ?? []), ...(s.herramientas ?? [])];
}

// Compat: vacantes creadas antes de este cambio tenían "skills" como array
// plano. Todo lo que no reconocemos cae en "herramientas" para no perder data.
function normalizeSkills(raw: any): SkillsSelection {
  if (Array.isArray(raw)) return { roles: [], habilidades: [], herramientas: raw };
  return {
    roles:        raw?.roles        ?? [],
    habilidades:  raw?.habilidades  ?? [],
    herramientas: raw?.herramientas ?? [],
  };
}

const BLANK_FORM: VacancyForm = {
  title: "",
  description: "",
  requirements: "",
  skills: emptySkills(),
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

const FILTER_LABELS: Record<Status | "all", string> = {
  all:    "Todas",
  active: "Activas",
  paused: "Pausadas",
  closed: "Cerradas",
};

// Distancia (px) que hay que arrastrar hacia abajo para cerrar el sheet
const DISMISS_DISTANCE = 110;

const fmtDate = (iso: string) =>
  new Date(iso).toLocaleDateString("es-AR", { day: "2-digit", month: "short", year: "numeric" });

// ─── Logo de empresa (imagen o inicial) ───────────────────────────────────────
function CompanyLogo({ name, logo, size }: { name?: string | null; logo?: string | null; size: "sm" | "md" }) {
  return logo
    ? <img src={logo} alt={name ?? "Empresa"} className={`hs-logo hs-logo--${size}`} />
    : <span className={`hs-logo hs-logo--${size} hs-logo--placeholder`}>{(name || "?").charAt(0).toUpperCase()}</span>;
}

// ─── Sheet: bottom sheet en mobile, modal centrado en desktop ─────────────────
// Se cierra deslizando la cabecera hacia abajo, tocando el fondo, con la ✕ o
// con Escape. El arrastre solo funciona desde la cabecera, así scrollear el
// formulario nunca lo cierra sin querer.
interface SheetProps {
  onClose:  () => void;
  labelId:  string;
  header:   ReactNode;
  footer:   ReactNode;
  children: ReactNode;
  locked?:  boolean; // no se puede cerrar (mientras se guarda)
}

function Sheet({ onClose, labelId, header, footer, children, locked = false }: SheetProps) {
  const startY = useRef<number | null>(null);
  const [dragY, setDragY] = useState(0);

  const tryClose = useCallback(() => { if (!locked) onClose(); }, [locked, onClose]);

  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") tryClose(); };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
    };
  }, [tryClose]);

  const onTouchStart = (e: React.TouchEvent) => { if (!locked) startY.current = e.touches[0].clientY; };
  const onTouchMove  = (e: React.TouchEvent) => {
    if (startY.current === null) return;
    setDragY(Math.max(0, e.touches[0].clientY - startY.current));
  };
  const onTouchEnd   = () => {
    if (startY.current === null) return;
    startY.current = null;
    if (dragY > DISMISS_DISTANCE) tryClose();
    setDragY(0); // si el cierre se cancela (confirm), vuelve a su lugar
  };

  return (
    <div className="hs-sheet-root" onClick={tryClose}>
      <div
        className="hs-sheet"
        role="dialog"
        aria-modal="true"
        aria-labelledby={labelId}
        onClick={(e) => e.stopPropagation()}
        style={dragY ? { transform: `translateY(${dragY}px)`, transition: "none" } : undefined}
      >
        <div className="hs-sheet-drag" onTouchStart={onTouchStart} onTouchMove={onTouchMove} onTouchEnd={onTouchEnd}>
          <span className="hs-sheet-handle" aria-hidden="true" />
          <div className="hs-sheet-header">
            <div className="hs-sheet-heading">{header}</div>
            <button type="button" className="hs-sheet-close" onClick={tryClose} disabled={locked} aria-label="Cerrar">✕</button>
          </div>
        </div>
        <div className="hs-sheet-body">{children}</div>
        <div className="hs-sheet-footer">{footer}</div>
      </div>
    </div>
  );
}

// ─── VacancySkillPicker (colapsable a 2 niveles) ──────────────────────────────
// Nivel 1: la rama entera (Áreas y roles / Habilidades / Herramientas) arranca
// CERRADA — solo título + badge con cantidad. Al abrirla aparecen las tags
// seleccionadas + el acordeón de subgrupos (nivel 2: cada subgrupo tiene su
// propio buscador de 16px + sus opciones).
function buildGroupMap(catalog: Record<string, readonly string[]>): Record<string, string> {
  const map: Record<string, string> = {};
  for (const [group, items] of Object.entries(catalog)) {
    for (const item of items) map[item] = group;
  }
  return map;
}

function VacancySkillPicker({
  title,
  catalog,
  selected,
  onChange,
}: {
  title: string;
  catalog: Record<string, readonly string[]>;
  selected: string[];
  onChange: (s: string[]) => void;
}) {
  const [mainOpen,  setMainOpen]  = useState(false);
  const [openGroup, setOpenGroup] = useState<string | null>(null);
  const [groupQuery, setGroupQuery] = useState<Record<string, string>>({});
  const groupMap = useMemo(() => buildGroupMap(catalog), [catalog]);

  const toggleItem = (name: string) => {
    onChange(selected.includes(name) ? selected.filter(x => x !== name) : [...selected, name]);
  };
  const removeItem = (name: string) => onChange(selected.filter(x => x !== name));

  const toggleMain = () => {
    setMainOpen(o => !o);
    if (mainOpen) setOpenGroup(null);
  };

  return (
    <div className={`hs-picker${mainOpen ? " open" : ""}`}>
      <button type="button" className="hs-picker-header" onClick={toggleMain} aria-expanded={mainOpen}>
        <span className="hs-picker-title">{title}</span>
        <span className="hs-picker-right">
          {selected.length > 0 && <span className="hs-count-badge">{selected.length}</span>}
          <span className="hs-chevron" aria-hidden="true" />
        </span>
      </button>

      {mainOpen && (
        <div className="hs-picker-body">
          {selected.length > 0 ? (
            <div className="hs-picker-selected">
              {selected.map(name => (
                <span key={name} className="hs-chip">
                  <span className="hs-chip-text">
                    <span className="hs-chip-group">{groupMap[name] ?? ""}</span>
                    <span className="hs-chip-name">{name}</span>
                  </span>
                  <button type="button" className="hs-chip-remove" onClick={() => removeItem(name)} aria-label={`Quitar ${name}`}>×</button>
                </span>
              ))}
            </div>
          ) : (
            <p className="hs-hint">Ninguna seleccionada todavía. Abrí un subgrupo para ver sus opciones.</p>
          )}

          <div className="hs-accordion">
            {Object.entries(catalog).map(([group, items]) => {
              const isOpen = openGroup === group;
              const query = (groupQuery[group] ?? "").trim().toLowerCase();
              const filteredItems = query.length === 0
                ? items
                : items.filter(name => name.toLowerCase().includes(query));
              const selectedInGroup = items.filter(name => selected.includes(name)).length;

              return (
                <div className={`hs-accordion-item${isOpen ? " open" : ""}`} key={group}>
                  <button
                    type="button"
                    className="hs-accordion-header"
                    onClick={() => setOpenGroup(isOpen ? null : group)}
                    aria-expanded={isOpen}
                  >
                    <span className="hs-accordion-name">{group}</span>
                    <span className="hs-picker-right">
                      {selectedInGroup > 0 && <span className="hs-count-badge">{selectedInGroup}</span>}
                      <span className="hs-chevron hs-chevron--sm" aria-hidden="true" />
                    </span>
                  </button>

                  {isOpen && (
                    <div className="hs-accordion-body">
                      <input
                        className="hs-input hs-input--search"
                        type="search"
                        value={groupQuery[group] ?? ""}
                        onChange={e => setGroupQuery(q => ({ ...q, [group]: e.target.value }))}
                        placeholder={`Buscar en ${group.toLowerCase()}…`}
                      />
                      <div className="hs-options">
                        {filteredItems.length === 0 && <p className="hs-hint hs-options-empty">Sin resultados.</p>}
                        {filteredItems.map(name => {
                          const isSelected = selected.includes(name);
                          return (
                            <button
                              type="button"
                              key={name}
                              className={`hs-option${isSelected ? " selected" : ""}`}
                              onClick={() => toggleItem(name)}
                              aria-pressed={isSelected}
                            >
                              <span className="hs-option-check" aria-hidden="true">{isSelected ? "✓" : ""}</span>
                              <span>{name}</span>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
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
      <span className="hs-field-label">
        {label}{required && <span className="hs-required"> *</span>}
      </span>
      {children}
      {hint  && <p className="hs-hint">{hint}</p>}
      {error && <p className="hs-field-error">{error}</p>}
    </div>
  );
}

// ─── Formulario de vacante (en el sheet) ──────────────────────────────────────
interface VacancyModalProps {
  initial: Vacancy | null;
  onSave: (form: VacancyForm) => void;
  onClose: () => void;
}

function VacancyModal({ initial, onSave, onClose }: VacancyModalProps) {
  const { user } = UseSession();
  const companyName = user?.companyName ?? null;
  const companyLogo = user?.companyLogo ?? null;

  const [initialForm] = useState<VacancyForm>(() =>
    initial
      ? {
          title:           initial.title,
          description:     initial.description,
          requirements:    initial.requirements,
          skills:          initial.skills, // ya viene normalizado desde fetchVacancies
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
  const [form, setForm] = useState<VacancyForm>(initialForm);

  const [errors, setErrors] = useState<Partial<Record<keyof VacancyForm, string>>>({});
  // Evita doble envío: mientras se guarda, el botón queda deshabilitado
  const [saving, setSaving] = useState(false);

  const set = <K extends keyof VacancyForm>(key: K, value: VacancyForm[K]) =>
    setForm((f) => ({ ...f, [key]: value }));

  const setSalary = (key: keyof SalaryRange, value: string | boolean) =>
    setForm((f) => ({ ...f, salaryRange: { ...f.salaryRange, [key]: value } }));

  const setSkillsBranch = (branch: SkillCategory, value: string[]) =>
    setForm((f) => ({ ...f, skills: { ...f.skills, [branch]: value } }));

  const validate = () => {
    const e: typeof errors = {};
    if (!form.title.trim())        e.title        = "Campo requerido";
    if (!form.description.trim())  e.description  = "Campo requerido";
    if (!form.requirements.trim()) e.requirements = "Campo requerido";
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const submit = async () => {
    if (saving || !validate()) return;
    setSaving(true);
    try {
      await onSave(form);
    } finally {
      setSaving(false);
    }
  };

  // Si hay cambios sin guardar, se pide confirmación antes de cerrar
  // (deslizar, tocar el fondo, Escape o Cancelar).
  const isDirty = JSON.stringify(form) !== JSON.stringify(initialForm);
  const requestClose = useCallback(() => {
    if (isDirty && !window.confirm("Tenés cambios sin guardar. ¿Descartarlos?")) return;
    onClose();
  }, [isDirty, onClose]);

  const totalSkills = flattenSkills(form.skills).length;

  return (
    <Sheet
      onClose={requestClose}
      labelId="hs-form-title"
      locked={saving}
      header={
        <>
          <span className="hs-eyebrow">{initial ? "Editar vacante" : "Nueva vacante"}</span>
          <h2 id="hs-form-title" className="hs-sheet-title">
            {initial ? "Editar posición" : "Publicar posición"}
          </h2>
        </>
      }
      footer={
        <div className="hs-footer-row">
          <button type="button" className="hs-btn hs-btn--ghost" onClick={requestClose} disabled={saving}>
            Cancelar
          </button>
          <button type="button" className="hs-btn hs-btn--accent" onClick={submit} disabled={saving}>
            {saving ? "Guardando…" : initial ? "Guardar cambios" : "Publicar vacante"}
          </button>
        </div>
      }
    >
      {/* Empresa — datos de las claims, solo lectura */}
      <div className="hs-publisher">
        <CompanyLogo name={companyName} logo={companyLogo} size="md" />
        <div className="hs-publisher-text">
          <span className="hs-field-label">Publicado por</span>
          {companyName
            ? <span className="hs-publisher-name">{companyName}</span>
            : <span className="hs-publisher-empty">Sin nombre de empresa en la cuenta</span>}
        </div>
      </div>

      {/* ── Bloque 1: el puesto ── */}
      <section className="hs-form-section">
        <h3 className="hs-form-section-title"><span>01</span> El puesto</h3>

        <Field label="Título del puesto" required error={errors.title}>
          <input
            className={`hs-input${errors.title ? " hs-input--error" : ""}`}
            placeholder="Ej: Analista SOC Nivel 1"
            value={form.title}
            onChange={(e) => set("title", e.target.value)}
          />
        </Field>

        <div className="hs-grid-3">
          <Field label="Nivel" required>
            <select className="hs-input hs-select" value={form.experienceLevel} onChange={(e) => set("experienceLevel", e.target.value as ExperienceLevel)}>
              {(["Junior","Semi-Senior","Senior","Lead","Manager"] as ExperienceLevel[]).map((v) => (
                <option key={v} value={v}>{v}</option>
              ))}
            </select>
          </Field>
          <Field label="Modalidad" required>
            <select className="hs-input hs-select" value={form.modality} onChange={(e) => set("modality", e.target.value as Modality)}>
              {(["Remoto","Presencial","Híbrido"] as Modality[]).map((v) => (
                <option key={v} value={v}>{v}</option>
              ))}
            </select>
          </Field>
          <Field label="Contrato" required>
            <select className="hs-input hs-select" value={form.contractType} onChange={(e) => set("contractType", e.target.value as ContractType)}>
              {(["Full-time","Part-time","Freelance","Pasantía"] as ContractType[]).map((v) => (
                <option key={v} value={v}>{v}</option>
              ))}
            </select>
          </Field>
        </div>

        <div className="hs-grid-2">
          <Field label="Ubicación">
            <input
              className="hs-input"
              placeholder="Ciudad, país o 'Remoto'"
              value={form.location}
              onChange={(e) => set("location", e.target.value)}
            />
          </Field>
          <Field label="Fecha de cierre">
            <input
              className="hs-input"
              type="date"
              value={form.closesAt}
              onChange={(e) => set("closesAt", e.target.value)}
            />
          </Field>
        </div>
      </section>

      {/* ── Bloque 2: descripción ── */}
      <section className="hs-form-section">
        <h3 className="hs-form-section-title"><span>02</span> Descripción</h3>

        <Field label="Descripción" required error={errors.description}>
          <textarea
            className={`hs-input hs-textarea${errors.description ? " hs-input--error" : ""}`}
            placeholder="Describí el rol, responsabilidades y el equipo…"
            value={form.description}
            onChange={(e) => set("description", e.target.value)}
            rows={6}
          />
        </Field>

        <Field label="Requisitos" required error={errors.requirements}>
          <textarea
            className={`hs-input hs-textarea${errors.requirements ? " hs-input--error" : ""}`}
            placeholder="Formación, experiencia mínima, certificaciones…"
            value={form.requirements}
            onChange={(e) => set("requirements", e.target.value)}
            rows={5}
          />
        </Field>
      </section>

      {/* ── Bloque 3: skills ── */}
      <section className="hs-form-section">
        <h3 className="hs-form-section-title">
          <span>03</span> Skills requeridas
          {totalSkills > 0 && <span className="hs-count-badge">{totalSkills}</span>}
        </h3>
        <p className="hs-hint hs-hint--top">Elegí las áreas, habilidades y herramientas que buscás para este puesto.</p>
        <div className="hs-picker-stack">
          <VacancySkillPicker
            title={CATEGORY_LABELS.roles}
            catalog={CATEGORY_CATALOGS.roles}
            selected={form.skills.roles}
            onChange={(s) => setSkillsBranch("roles", s)}
          />
          <VacancySkillPicker
            title={CATEGORY_LABELS.habilidades}
            catalog={CATEGORY_CATALOGS.habilidades}
            selected={form.skills.habilidades}
            onChange={(s) => setSkillsBranch("habilidades", s)}
          />
          <VacancySkillPicker
            title={CATEGORY_LABELS.herramientas}
            catalog={CATEGORY_CATALOGS.herramientas}
            selected={form.skills.herramientas}
            onChange={(s) => setSkillsBranch("herramientas", s)}
          />
        </div>
      </section>

      {/* ── Bloque 4: salario ── */}
      <section className="hs-form-section">
        <h3 className="hs-form-section-title"><span>04</span> Salario</h3>
        <Field label="Rango salarial" hint="Opcional. Dejalo vacío para no mostrarlo.">
          <div className="hs-salary-row">
            <input
              className="hs-input"
              type="number"
              inputMode="numeric"
              placeholder="Mínimo"
              value={form.salaryRange.min}
              onChange={(e) => setSalary("min", e.target.value)}
            />
            <input
              className="hs-input"
              type="number"
              inputMode="numeric"
              placeholder="Máximo"
              value={form.salaryRange.max}
              onChange={(e) => setSalary("max", e.target.value)}
            />
            <select
              className="hs-input hs-select hs-select--currency"
              value={form.salaryRange.currency}
              onChange={(e) => setSalary("currency", e.target.value)}
              aria-label="Moneda"
            >
              {["USD","ARS","EUR","BRL"].map((c) => <option key={c}>{c}</option>)}
            </select>
          </div>
        </Field>
        <label className="hs-switch">
          <input
            type="checkbox"
            checked={form.salaryRange.visible}
            onChange={(e) => setSalary("visible", e.target.checked)}
          />
          <span className="hs-switch-track" aria-hidden="true"><span /></span>
          <span className="hs-switch-label">Mostrar el rango en la publicación</span>
        </label>
      </section>
    </Sheet>
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
  const allSkills = flattenSkills(vacancy.skills);
  const applicants = vacancy.applicants?.length ?? 0;

  const isExpired = vacancy.closesAt
    ? new Date(vacancy.closesAt) < new Date()
    : false;

  const handleDelete = () => {
    if (confirmDelete) {
      onDelete(vacancy._id);
    } else {
      setConfirmDelete(true);
      setTimeout(() => setConfirmDelete(false), 3000);
    }
  };

  const toggleDisabled = isExpired && vacancy.status !== "active";
  const hasSalary = vacancy.salaryRange?.visible && (vacancy.salaryRange.min || vacancy.salaryRange.max);

  return (
    <article className={`hs-card hs-card--${vacancy.status}${isExpired ? " hs-card--expired" : ""}`}>

      {/* Empresa + estado */}
      <div className="hs-card-head">
        <CompanyLogo name={vacancy.companyName} logo={vacancy.companyLogo} size="sm" />
        <span className="hs-card-company">{vacancy.companyName || "Tu empresa"}</span>
        <div className="hs-card-badges">
          <span className={`hs-status hs-status--${vacancy.status}`}>{STATUS_LABELS[vacancy.status]}</span>
          {isExpired && <span className="hs-status hs-status--expired">VENCIDA</span>}
        </div>
      </div>

      <div className="hs-card-main">
        <h3 className="hs-card-title">{vacancy.title}</h3>
        <div className="hs-tags">
          {[vacancy.modality, vacancy.contractType, vacancy.experienceLevel, vacancy.location].filter(Boolean).map((t) => (
            <span key={t} className="hs-tag">{t}</span>
          ))}
        </div>
      </div>

      {hasSalary && (
        <p className="hs-card-salary">
          <span className="hs-currency">{vacancy.salaryRange.currency}</span>{" "}
          {vacancy.salaryRange.min && Number(vacancy.salaryRange.min).toLocaleString("es-AR")}
          {vacancy.salaryRange.min && vacancy.salaryRange.max && " – "}
          {vacancy.salaryRange.max && Number(vacancy.salaryRange.max).toLocaleString("es-AR")}
        </p>
      )}

      {allSkills.length > 0 && (
        <div className="hs-skills">
          {allSkills.slice(0, 5).map((s) => <span key={s} className="hs-skill">{s}</span>)}
          {allSkills.length > 5 && <span className="hs-skill-more">+{allSkills.length - 5}</span>}
        </div>
      )}

      {/* Métricas */}
      <div className="hs-card-stats">
        <div className="hs-card-stat">
          <span className="hs-card-stat-value">{applicants}</span>
          <span className="hs-card-stat-label">{applicants === 1 ? "Postulante" : "Postulantes"}</span>
        </div>
        <div className="hs-card-stat">
          <span className={`hs-card-stat-value hs-card-stat-value--sm${isExpired ? " hs-text-danger" : ""}`}>
            {vacancy.closesAt ? fmtDate(vacancy.closesAt) : "Sin fecha"}
          </span>
          <span className="hs-card-stat-label">{isExpired ? "Venció" : "Cierre"}</span>
        </div>
      </div>

      {isExpired && (
        <p className="hs-card-note">La fecha de cierre ya pasó. Editá la vacante para extenderla.</p>
      )}

      {/* Acciones */}
      <div className="hs-card-actions">
        <button type="button" className="hs-action hs-action--accent" onClick={() => onEdit(vacancy)}>
          Editar
        </button>
        <button
          type="button"
          className="hs-action"
          disabled={toggleDisabled}
          title={
            isExpired
              ? "Fecha vencida — editá la vacante para cambiar la fecha"
              : vacancy.status === "paused" ? "Activar" : "Pausar"
          }
          onClick={() => {
            if (isExpired) return;
            onToggleStatus(vacancy._id, vacancy.status === "paused" ? "active" : "paused");
          }}
        >
          {vacancy.status === "paused" ? "Activar" : "Pausar"}
        </button>
        <button
          type="button"
          className={`hs-action hs-action--danger${confirmDelete ? " hs-action--confirm" : ""}`}
          onClick={handleDelete}
        >
          {confirmDelete ? "¿Confirmar?" : "Eliminar"}
        </button>
      </div>
    </article>
  );
}

// ─── Bloque sin plan activo (misma estética que la pantalla de bloqueo de UsersDatabase) ──
function NoPlanBlock({ planExpired }: { planExpired: boolean }) {
  return (
    <div className="hs-plan-blocked">
      <span className="hs-plan-blocked-mark" aria-hidden="true"></span>
      <span className="hs-eyebrow">Sin plan activo</span>
      <h2 className="hs-plan-blocked-title">
        Solo para cuentas <span className="hs-accent">Business / Enterprise</span>
      </h2>
      <p className="hs-plan-blocked-text">
        Necesitás un plan de empresa activo para publicar vacantes y gestionar postulantes.
        Podés ver las vacantes existentes pero no crear nuevas.
        {planExpired && " Tu plan venció — renovalo para volver a publicar."}
      </p>
      <Link to="/pricing?tipo=empresas" className="hs-plan-blocked-cta">
        {planExpired ? "Renovar plan" : "Ver planes corporativos"}
      </Link>
    </div>
  );
}

// ─── Toast ────────────────────────────────────────────────────────────────────
interface ToastState { msg: string; type: "success" | "error" }

// ─── VacancyManager principal ─────────────────────────────────────────────────
export default function VacancyManager() {
  const { theme } = UseTheme();
  const { user }  = UseSession();
  const isLight   = theme === "light";

  const [vacancies,      setVacancies]      = useState<Vacancy[]>([]);
  const [showModal,      setShowModal]      = useState(false);
  const [editingVacancy, setEditingVacancy] = useState<Vacancy | null>(null);
  const [filterStatus,   setFilterStatus]   = useState<Status | "all">("all");
  const [toast,          setToast]          = useState<ToastState | null>(null);

  // ── Plan B2B activo ────────────────────────────────────────────
  const [b2bPlan,          setB2bPlan]          = useState<string | null>(null);   // "b2b_seis" | "b2b_doce" | null
  const [vacancyLimit,     setVacancyLimit]     = useState<number | null>(null);   // null = ilimitado
  const [vacanciesUsed,    setVacanciesUsed]    = useState<number>(0);
  const [planExpiry,       setPlanExpiry]       = useState<Date | null>(null);
  const [hasActivePlan,    setHasActivePlan]    = useState(false);

  // Tuvo un plan que ya venció (para mostrar "Renovar plan" en vez de "Ver planes")
  const planExpired =
    !hasActivePlan &&
    !!(user as any)?.enterprisePlan &&
    !!(user as any)?.enterprisePlanExpiry;

  useEffect(() => {
    if (!user) return;

    const plan        = (user as any).enterprisePlan       ?? null;
    const expiryStr   = (user as any).enterprisePlanExpiry ?? null;
    const limit       = (user as any).vacancyLimit         ?? null;   // null = ilimitado
    const used        = (user as any).vacanciesUsed        ?? 0;

    if (!plan || !expiryStr) {
      setHasActivePlan(false);
      setB2bPlan(null);
      return;
    }

    const expiry = new Date(expiryStr);
    if (expiry <= new Date()) {
      // Plan vencido en el cliente — mostrará bloqueado hasta que refresh-claims lo limpie
      setHasActivePlan(false);
      setB2bPlan(null);
      return;
    }

    setHasActivePlan(true);
    setB2bPlan(plan);
    setVacancyLimit(limit);
    setVacanciesUsed(used);
    setPlanExpiry(expiry);
  }, [user]);

  // ── Cuántas publicaciones quedan ───────────────────────────────
  const canCreateVacancy = hasActivePlan && (
    vacancyLimit === null          // ilimitado (b2b_doce)
    || vacanciesUsed < vacancyLimit // dentro del límite (b2b_seis)
  );

  const remainingVacancies = vacancyLimit !== null
    ? Math.max(0, vacancyLimit - vacanciesUsed)
    : null; // null = ilimitado

  const notify = (msg: string, type: "success" | "error" = "success") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  };

  const fetchVacancies = () => {
    axios
      .get(`${import.meta.env.VITE_API_URL}/api/vacancies`, { withCredentials: true })
      .then(({ data }) => {
        const list = Array.isArray(data.data) ? data.data : [];
        setVacancies(list.map((v: any) => ({ ...v, skills: normalizeSkills(v.skills) })));
      })
      .catch(() => notify("Error al cargar vacantes", "error"));
  };

  useEffect(() => { fetchVacancies(); }, []);

  const openCreate = () => {
    if (!canCreateVacancy) return;
    setEditingVacancy(null);
    setShowModal(true);
  };
  const openEdit   = (v: Vacancy) => { setEditingVacancy(v); setShowModal(true); };
  const closeModal = useCallback(() => { setShowModal(false); setEditingVacancy(null); }, []);

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
      // Recuperar cupo localmente si el plan tiene límite
      if (vacancyLimit !== null) {
        setVacanciesUsed(prev => Math.max(0, prev - 1));
      }
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

  const totalApplicants = vacancies.reduce((acc, v) => acc + (v?.applicants?.length ?? 0), 0);
  const usagePct = vacancyLimit ? Math.min(100, Math.round((vacanciesUsed / vacancyLimit) * 100)) : 0;

  const createTitle =
    !hasActivePlan
      ? "Necesitás un plan B2B activo para publicar vacantes"
      : remainingVacancies === 0
        ? "Alcanzaste el límite de publicaciones de tu plan"
        : undefined;

  return (
    <div className={`hs-vacancy-manager${isLight ? " light" : ""}`}>

      {/* ── Header ── */}
      <header className="hs-vm-header">
        <div className="hs-vm-header-text">
          <span className="hs-eyebrow">Empresa</span>
          <h1 className="hs-vm-title">Gestión de <span className="hs-accent">vacantes</span></h1>
          <p className="hs-vm-subtitle">
            {counts.all === 0
              ? "Todavía no publicaste vacantes."
              : `${counts.active} ${counts.active === 1 ? "activa" : "activas"} · ${totalApplicants} ${totalApplicants === 1 ? "postulante" : "postulantes"} en total`}
          </p>
        </div>
        <button
          type="button"
          className="hs-btn hs-btn--accent hs-btn--lg"
          onClick={openCreate}
          disabled={!canCreateVacancy}
          title={createTitle}
        >
          + Nueva vacante
        </button>
      </header>

      {/* ── Estado del plan ── */}
      {!hasActivePlan ? (
        <NoPlanBlock planExpired={planExpired} />
      ) : (
        <div className={`hs-plan${remainingVacancies === 0 ? " hs-plan--full" : ""}`}>
          <div className="hs-plan-info">
            <span className="hs-plan-name">Plan {b2bPlan?.replace(/^b2b_/i, "").toUpperCase()} activo</span>
            {planExpiry && <span className="hs-plan-expiry">Vence el {planExpiry.toLocaleDateString("es-AR", { day: "2-digit", month: "short", year: "numeric" })}</span>}
          </div>

          {vacancyLimit !== null ? (
            <div className="hs-plan-usage">
              <div className="hs-plan-usage-text">
                <span><b>{vacanciesUsed}</b> de {vacancyLimit} publicaciones</span>
                {remainingVacancies === 0
                  ? <span className="hs-plan-limit">Límite alcanzado</span>
                  : <span className="hs-plan-left">Te quedan {remainingVacancies}</span>}
              </div>
              <div className="hs-plan-bar" role="progressbar" aria-valuenow={vacanciesUsed} aria-valuemin={0} aria-valuemax={vacancyLimit}>
                <span style={{ width: `${usagePct}%` }} />
              </div>
            </div>
          ) : (
            <span className="hs-plan-unlimited">Publicaciones ilimitadas</span>
          )}
        </div>
      )}

      {/* ── Filtros por estado ── */}
      <div className="hs-tabs" role="tablist" aria-label="Filtrar vacantes por estado">
        {(["all","active","paused","closed"] as const).map((s) => (
          <button
            key={s}
            type="button"
            role="tab"
            aria-selected={filterStatus === s}
            className={`hs-tab${filterStatus === s ? " hs-tab--active" : ""}`}
            onClick={() => setFilterStatus(s)}
          >
            {FILTER_LABELS[s]}
            <span className="hs-tab-count">{counts[s]}</span>
          </button>
        ))}
      </div>

      {/* ── Grid ── */}
      {filtered.length === 0 ? (
        <div className="hs-empty">
          <span className="hs-empty-icon" aria-hidden="true">◫</span>
          <p className="hs-empty-title">
            {filterStatus === "all" ? "Sin vacantes publicadas" : `Sin vacantes ${FILTER_LABELS[filterStatus].toLowerCase()}`}
          </p>
          {filterStatus === "all" && canCreateVacancy && (
            <button type="button" className="hs-btn hs-btn--ghost" onClick={openCreate}>Publicar la primera</button>
          )}
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

      {/* ── Formulario (bottom sheet en mobile, modal en desktop) ── */}
      {showModal && (
        <VacancyModal initial={editingVacancy} onSave={handleSave} onClose={closeModal} />
      )}

      {/* ── Toast ── */}
      {toast && (
        <div className={`hs-toast hs-toast--${toast.type}`} role="status">
          <span className="hs-toast-label">{toast.type === "success" ? "Listo" : "Error"}</span>
          {toast.msg}
        </div>
      )}
    </div>
  );
}