import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import axios from "axios";
import { UseTheme } from "../contexts/ThemeContext";
import { HS_SKILLS } from "../skills/Skills"; // ⚠️ ajustá esta ruta si difiere de la del CV Builder
import "./usersDataBase.css";

// ─── Types ────────────────────────────────────────────────────────────────────
interface PersonalInfo {
  firstName: string;
  lastName:  string;
  headline:  string;
  email:     string;
  phone:     string;
  location:  string;
  linkedin:  string;
  github:    string;
  portfolio: string;
  summary:   string;
  photo:     string;
}

interface ExperienceItem {
  company: string; position: string; location: string;
  startDate: string; endDate: string; current: boolean; description: string;
}

interface EducationItem {
  institution: string; degree: string; field: string;
  startDate: string; endDate: string; current: boolean; description: string;
}

interface CertificationItem {
  name: string; issuer: string; date: string; credentialId: string; url: string;
}

interface LanguageItem { language: string; level: string }

interface ProjectItem {
  name: string; description: string; url: string; repoUrl: string; technologies: string[];
}

interface WorkPreferences {
  modality: string[]; contractType: string[];
  salaryMin: number | null; salaryMax: number | null; currency: string;
}

// Skills declaradas por el candidato — mismo árbol que HS_SKILLS (skills.ts)
interface SkillsSelection {
  roles:        string[]; // HS_SKILLS.AREAS_Y_ROLES
  habilidades:  string[]; // HS_SKILLS.HABILIDADES
  herramientas: string[]; // HS_SKILLS.HERRAMIENTAS
}

interface CandidateCV {
  id:                      string;
  personalInfo:            PersonalInfo;
  skills:                  SkillsSelection;
  experience:              ExperienceItem[];
  education:               EducationItem[];
  certifications:          CertificationItem[];
  languages:               LanguageItem[];
  projects:                ProjectItem[];
  availability:            string;
  workPreferences:         WorkPreferences;
  updatedAt:               string;
  userCertificated:        boolean;
  skillsCertifiedByHidden: string[];
}

interface ApiResponse {
  data: any[]; // normalizamos "skills" al llegar (ver fetchCandidates)
  meta: { total: number; page: number; limit: number; totalPages: number };
  unmatchedSkills: { declared: string[]; certified: string[] };
}

interface SkillsSummary {
  declaredSkills:  string[];
  certifiedSkills: string[];
}

const AVAILABILITY_OPTIONS = ["Inmediata", "2 semanas", "1 mes", "No disponible"];
const MODALITY_OPTIONS     = ["Remoto", "Presencial", "Híbrido"];

// ── Ramas de skills — mismas 3 que en el CV Builder ────────────────────────
type SkillCategory = "roles" | "habilidades" | "herramientas";

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

const CATEGORY_ORDER: SkillCategory[] = ["roles", "habilidades", "herramientas"];

function emptySkills(): SkillsSelection {
  return { roles: [], habilidades: [], herramientas: [] };
}

function flattenSkills(s: SkillsSelection | undefined | null): string[] {
  if (!s) return [];
  return [...(s.roles ?? []), ...(s.habilidades ?? []), ...(s.herramientas ?? [])];
}

// Compat: candidatos guardados antes del cambio de estructura tenían
// "skills" como array plano. Todo lo que no reconocemos cae en "herramientas"
// para no perder data — igual que hicimos en el CV Builder.
function normalizeSkills(raw: any): SkillsSelection {
  if (Array.isArray(raw)) return { roles: [], habilidades: [], herramientas: raw };
  return {
    roles:        raw?.roles        ?? [],
    habilidades:  raw?.habilidades  ?? [],
    herramientas: raw?.herramientas ?? [],
  };
}

// ══════════════════════════════════════════════════════════════════════════════
//  Sub-componente: chip de skill (declarada vs certificada)
// ══════════════════════════════════════════════════════════════════════════════
function SkillChip({ label, certified }: { label: string; certified?: boolean }) {
  return (
    <span className={`udb-skill-chip${certified ? " udb-skill-chip--certified" : ""}`}>
      {certified && <span className="udb-skill-chip-icon">✓</span>}
      {label}
    </span>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
//  Sub-componente: dropdown de una rama de skills (Áreas/Habilidades/Herramientas)
//  Buscador propio (16px) arriba; sin búsqueda activa, acordeón por subgrupo.
// ══════════════════════════════════════════════════════════════════════════════
function SkillBranchDropdown({
  label,
  catalog,
  selected,
  onToggle,
  isOpen,
  onOpen,
  onClose,
}: {
  label: string;
  catalog: Record<string, readonly string[]>;
  selected: string[];
  onToggle: (skill: string) => void;
  isOpen: boolean;
  onOpen: () => void;
  onClose: () => void;
}) {
  const [query, setQuery] = useState("");
  const [openSubgroup, setOpenSubgroup] = useState<string | null>(null);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [onClose]);

  // Al cerrar el dropdown, reseteamos búsqueda y subgrupo abierto
  useEffect(() => {
    if (!isOpen) { setQuery(""); setOpenSubgroup(null); }
  }, [isOpen]);

  const trimmed = query.trim().toLowerCase();
  const searchResults = trimmed.length === 0
    ? []
    : Object.entries(catalog).flatMap(([group, items]) =>
        items
          .filter(name => name.toLowerCase().includes(trimmed))
          .map(name => ({ group, name }))
      );

  return (
    <div className="udb-filter-dropdown" ref={ref}>
      <button
        className={`udb-filter-btn${selected.length > 0 ? " udb-filter-btn--active" : ""}`}
        onClick={() => (isOpen ? onClose() : onOpen())}
      >
        {label.toUpperCase()}
        {selected.length > 0 && <span className="udb-filter-count">{selected.length}</span>}
      </button>

      {isOpen && (
        <div className="udb-filter-menu udb-skillgroup-menu">
          <input
            className="udb-skillgroup-search"
            type="text"
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder={`Buscar en ${label.toLowerCase()}...`}
            autoFocus
          />

          {trimmed.length > 0 ? (
            searchResults.length === 0 ? (
              <p className="udb-filter-empty">Sin resultados.</p>
            ) : (
              <div className="udb-skillgroup-results">
                {searchResults.slice(0, 60).map(({ group, name }) => (
                  <button
                    key={name}
                    className={`udb-filter-checkbox udb-filter-checkbox--result${selected.includes(name) ? " udb-filter-checkbox--active" : ""}`}
                    onClick={() => onToggle(name)}
                  >
                    <span className="udb-filter-checkbox-dot" />
                    <span className="udb-skillgroup-option-name">{name}</span>
                    <span className="udb-skillgroup-option-group">{group}</span>
                  </button>
                ))}
              </div>
            )
          ) : (
            <div className="udb-skillgroup-accordion">
              {Object.entries(catalog).map(([group, items]) => {
                const open = openSubgroup === group;
                const selectedInGroup = items.filter(i => selected.includes(i)).length;
                return (
                  <div key={group} className={`udb-skillgroup-item${open ? " open" : ""}`}>
                    <button
                      type="button"
                      className="udb-skillgroup-item-header"
                      onClick={() => setOpenSubgroup(open ? null : group)}
                    >
                      <span>{group}</span>
                      <span className="udb-skillgroup-item-right">
                        {selectedInGroup > 0 && <span className="udb-filter-count">{selectedInGroup}</span>}
                        <span className="udb-skillgroup-chevron">{open ? "−" : "+"}</span>
                      </span>
                    </button>
                    {open && (
                      <div className="udb-skillgroup-options">
                        {items.map(name => (
                          <button
                            key={name}
                            className={`udb-filter-checkbox${selected.includes(name) ? " udb-filter-checkbox--active" : ""}`}
                            onClick={() => onToggle(name)}
                          >
                            <span className="udb-filter-checkbox-dot" />
                            <span>{name}</span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
//  Sub-componente: panel de filtros
// ══════════════════════════════════════════════════════════════════════════════
interface FiltersState {
  search:          string;
  declaredSkills:  Record<SkillCategory, string[]>;
  certifiedSkills: string[];
  certifiedOnly:   boolean;
  availability:    string;
  modality:        string;
}

const EMPTY_FILTERS: FiltersState = {
  search: "",
  declaredSkills: { roles: [], habilidades: [], herramientas: [] },
  certifiedSkills: [],
  certifiedOnly: false,
  availability: "",
  modality: "",
};

function FiltersPanel({
  filters, setFilters, skillsSummary, unmatchedSkills,
}: {
  filters: FiltersState;
  setFilters: (f: FiltersState) => void;
  skillsSummary: SkillsSummary | null;
  unmatchedSkills: { declared: string[]; certified: string[] };
}) {
  // Un solo estado de "cuál dropdown está abierto" — abrir uno cierra el resto
  const [openBranch, setOpenBranch] = useState<SkillCategory | "certified" | null>(null);
  const certifiedRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (openBranch === "certified" && certifiedRef.current && !certifiedRef.current.contains(e.target as Node)) {
        setOpenBranch(null);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [openBranch]);

  const toggleDeclared = (category: SkillCategory, skill: string) => {
    const current = filters.declaredSkills[category];
    setFilters({
      ...filters,
      declaredSkills: {
        ...filters.declaredSkills,
        [category]: current.includes(skill)
          ? current.filter(s => s !== skill)
          : [...current, skill],
      },
    });
  };

  const toggleCertified = (skill: string) => {
    setFilters({
      ...filters,
      certifiedSkills: filters.certifiedSkills.includes(skill)
        ? filters.certifiedSkills.filter(s => s !== skill)
        : [...filters.certifiedSkills, skill],
    });
  };

  const totalDeclaredCount =
    filters.declaredSkills.roles.length +
    filters.declaredSkills.habilidades.length +
    filters.declaredSkills.herramientas.length;

  const hasActiveFilters =
    filters.search || totalDeclaredCount > 0 || filters.certifiedSkills.length > 0
    || filters.certifiedOnly || filters.availability || filters.modality;

  return (
    <div className="udb-filters">
      <div className="udb-filters-row">

        {/* Búsqueda */}
        <input
          className="udb-search-input"
          placeholder="Buscar por nombre, email o headline..."
          value={filters.search}
          onChange={(e) => setFilters({ ...filters, search: e.target.value })}
        />

        {/* Las 3 ramas de skills declaradas — cada una con su propio buscador */}
        {CATEGORY_ORDER.map(category => (
          <SkillBranchDropdown
            key={category}
            label={CATEGORY_LABELS[category]}
            catalog={CATEGORY_CATALOGS[category]}
            selected={filters.declaredSkills[category]}
            onToggle={(skill) => toggleDeclared(category, skill)}
            isOpen={openBranch === category}
            onOpen={() => setOpenBranch(category)}
            onClose={() => setOpenBranch(prev => (prev === category ? null : prev))}
          />
        ))}

        {/* Skills certificadas por Hidden — se mantiene como antes */}
        <div className="udb-filter-dropdown" ref={certifiedRef}>
          <button
            className={`udb-filter-btn udb-filter-btn--gold${filters.certifiedSkills.length > 0 ? " udb-filter-btn--active" : ""}`}
            onClick={() => setOpenBranch(openBranch === "certified" ? null : "certified")}
          >
            ✓ CERTIFICADAS HIDDEN
            {filters.certifiedSkills.length > 0 && (
              <span className="udb-filter-count">{filters.certifiedSkills.length}</span>
            )}
          </button>
          {openBranch === "certified" && (
            <div className="udb-filter-menu">
              {!skillsSummary || skillsSummary.certifiedSkills.length === 0 ? (
                <p className="udb-filter-empty">Aún no hay skills certificadas en la plataforma</p>
              ) : (
                skillsSummary.certifiedSkills.map(skill => (
                  <button
                    key={skill}
                    className={`udb-filter-checkbox${filters.certifiedSkills.includes(skill) ? " udb-filter-checkbox--active udb-filter-checkbox--gold" : ""}`}
                    onClick={() => toggleCertified(skill)}
                  >
                    <span className="udb-filter-checkbox-dot" />
                    <span>{skill}</span>
                  </button>
                ))
              )}
            </div>
          )}
        </div>

        {/* Disponibilidad */}
        <select
          className="udb-filter-select"
          value={filters.availability}
          onChange={(e) => setFilters({ ...filters, availability: e.target.value })}
        >
          <option value="">Disponibilidad</option>
          {AVAILABILITY_OPTIONS.map(a => <option key={a} value={a}>{a}</option>)}
        </select>

        {/* Modalidad */}
        <select
          className="udb-filter-select"
          value={filters.modality}
          onChange={(e) => setFilters({ ...filters, modality: e.target.value })}
        >
          <option value="">Modalidad</option>
          {MODALITY_OPTIONS.map(m => <option key={m} value={m}>{m}</option>)}
        </select>

        {/* Solo certificados */}
        <button
          className={`udb-filter-toggle${filters.certifiedOnly ? " udb-filter-toggle--active" : ""}`}
          onClick={() => setFilters({ ...filters, certifiedOnly: !filters.certifiedOnly })}
        >
          <span className="udb-filter-checkbox-dot" />
          Solo certificados ✓
        </button>

        {hasActiveFilters && (
          <button className="udb-filter-clear" onClick={() => setFilters(EMPTY_FILTERS)}>
            LIMPIAR FILTROS
          </button>
        )}
      </div>

      {/* Chips activos */}
      {(totalDeclaredCount > 0 || filters.certifiedSkills.length > 0) && (
        <div className="udb-active-chips">
          {CATEGORY_ORDER.map(category =>
            filters.declaredSkills[category].map(s => (
              <span key={`${category}-${s}`} className="udb-active-chip" onClick={() => toggleDeclared(category, s)}>
                {s} ×
              </span>
            ))
          )}
          {filters.certifiedSkills.map(s => (
            <span key={`c-${s}`} className="udb-active-chip udb-active-chip--gold" onClick={() => toggleCertified(s)}>
              ✓ {s} ×
            </span>
          ))}
        </div>
      )}

      {/* Skills no encontradas */}
      {(unmatchedSkills.declared.length > 0 || unmatchedSkills.certified.length > 0) && (
        <div className="udb-unmatched-warning">
          <span className="udb-unmatched-icon">⚠</span>
          <div>
            {unmatchedSkills.declared.length > 0 && (
              <p>
                Ningún candidato declaró: <strong>{unmatchedSkills.declared.join(", ")}</strong>
              </p>
            )}
            {unmatchedSkills.certified.length > 0 && (
              <p>
                Ningún candidato tiene certificada por Hidden: <strong>{unmatchedSkills.certified.join(", ")}</strong>
              </p>
            )}
            <p className="udb-unmatched-sub">Mostrando resultados que coinciden con el resto de los filtros.</p>
          </div>
        </div>
      )}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
//  Sub-componente: desglose del candidato (panel expandido)
// ══════════════════════════════════════════════════════════════════════════════
function CandidateDetail({ candidate, onDownload }: { candidate: CandidateCV; onDownload: () => void }) {
  const p = candidate.personalInfo;
  const allDeclared = useMemo(() => flattenSkills(candidate.skills), [candidate.skills]);

  const extraCertified = candidate.skillsCertifiedByHidden.filter(s => !allDeclared.includes(s));

  const skillGroups: { key: SkillCategory; title: string; items: string[] }[] = [
    { key: "roles",        title: "// ÁREAS Y ROLES",   items: candidate.skills.roles        ?? [] },
    { key: "habilidades",  title: "// HABILIDADES",     items: candidate.skills.habilidades  ?? [] },
    { key: "herramientas", title: "// HERRAMIENTAS",    items: candidate.skills.herramientas ?? [] },
  ];

  return (
    <div className="udb-detail">

      {/* Header con resumen */}
      {p.summary && (
        <div className="udb-detail-section">
          <span className="udb-detail-section-title">// PERFIL PROFESIONAL</span>
          <p className="udb-detail-text">{p.summary}</p>
        </div>
      )}

      {/* Skills declaradas vs certificadas — separadas por rama */}
      {allDeclared.length === 0 ? (
        <div className="udb-detail-section">
          <span className="udb-detail-section-title">// SKILLS DECLARADAS POR EL CANDIDATO</span>
          <p className="udb-detail-empty">Sin skills registradas</p>
        </div>
      ) : (
        skillGroups.map(g => g.items.length > 0 && (
          <div className="udb-detail-section" key={g.key}>
            <span className="udb-detail-section-title">{g.title}</span>
            <div className="udb-skills-row">
              {g.items.map(skill => (
                <SkillChip
                  key={skill}
                  label={skill}
                  certified={candidate.skillsCertifiedByHidden.includes(skill)}
                />
              ))}
            </div>
          </div>
        ))
      )}
      {allDeclared.length > 0 && (
        <p className="udb-detail-hint">
          <span className="udb-skill-chip-icon">✓</span> = validado por Hidden Security
        </p>
      )}

      {/* Skills certificadas que el candidato NO declaró (caso edge importante) */}
      {extraCertified.length > 0 && (
        <div className="udb-detail-section">
          <span className="udb-detail-section-title udb-detail-section-title--gold">
            // CERTIFICACIONES ADICIONALES (no declaradas por el candidato)
          </span>
          <div className="udb-skills-row">
            {extraCertified.map(skill => (
              <SkillChip key={skill} label={skill} certified />
            ))}
          </div>
        </div>
      )}

      {/* Experiencia */}
      {candidate.experience.length > 0 && (
        <div className="udb-detail-section">
          <span className="udb-detail-section-title">// EXPERIENCIA LABORAL</span>
          {candidate.experience.map((e, i) => (
            <div key={i} className="udb-entry">
              <div className="udb-entry-header">
                <div>
                  <strong>{e.position}</strong>
                  <span className="udb-entry-sub"> · {e.company}{e.location ? `, ${e.location}` : ""}</span>
                </div>
                <span className="udb-entry-dates">
                  {e.startDate}{e.startDate && " — "}{e.current ? "Actualidad" : e.endDate}
                </span>
              </div>
              {e.description && <p className="udb-detail-text">{e.description}</p>}
            </div>
          ))}
        </div>
      )}

      {/* Educación */}
      {candidate.education.length > 0 && (
        <div className="udb-detail-section">
          <span className="udb-detail-section-title">// EDUCACIÓN</span>
          {candidate.education.map((e, i) => (
            <div key={i} className="udb-entry">
              <div className="udb-entry-header">
                <div>
                  <strong>{e.degree}{e.field ? ` — ${e.field}` : ""}</strong>
                  <span className="udb-entry-sub"> · {e.institution}</span>
                </div>
                <span className="udb-entry-dates">
                  {e.startDate}{e.startDate && " — "}{e.current ? "Actualidad" : e.endDate}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Certificaciones declaradas */}
      {candidate.certifications.length > 0 && (
        <div className="udb-detail-section">
          <span className="udb-detail-section-title">// CERTIFICACIONES DECLARADAS</span>
          {candidate.certifications.map((c, i) => (
            <div key={i} className="udb-entry">
              <div className="udb-entry-header">
                <div>
                  <strong>{c.name}</strong>
                  <span className="udb-entry-sub"> · {c.issuer}</span>
                  {c.credentialId && <div className="udb-entry-credential">ID: {c.credentialId}</div>}
                </div>
                <span className="udb-entry-dates">{c.date}</span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Proyectos */}
      {candidate.projects.length > 0 && (
        <div className="udb-detail-section">
          <span className="udb-detail-section-title">// PROYECTOS</span>
          {candidate.projects.map((proj, i) => (
            <div key={i} className="udb-entry">
              <div className="udb-entry-header">
                <strong>{proj.name}</strong>
                <div className="udb-entry-links">
                  {proj.url     && <a href={proj.url}     target="_blank" rel="noreferrer">Demo</a>}
                  {proj.repoUrl && <a href={proj.repoUrl} target="_blank" rel="noreferrer">Repo</a>}
                </div>
              </div>
              {proj.description && <p className="udb-detail-text">{proj.description}</p>}
              {proj.technologies.length > 0 && (
                <div className="udb-skills-row">
                  {proj.technologies.map(t => <span key={t} className="udb-tech-chip">{t}</span>)}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Idiomas */}
      {candidate.languages.length > 0 && (
        <div className="udb-detail-section">
          <span className="udb-detail-section-title">// IDIOMAS</span>
          <div className="udb-languages-row">
            {candidate.languages.map((l, i) => (
              <div key={i} className="udb-language-item">
                <span className="udb-language-name">{l.language}</span>
                <span className="udb-language-level">{l.level}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Disponibilidad y preferencias */}
      <div className="udb-detail-section">
        <span className="udb-detail-section-title">// DISPONIBILIDAD Y PREFERENCIAS</span>
        <div className="udb-prefs-row">
          <span className="udb-pref-chip udb-pref-chip--accent">{candidate.availability}</span>
          {candidate.workPreferences?.modality?.map(m => (
            <span key={m} className="udb-pref-chip">{m}</span>
          ))}
          {candidate.workPreferences?.contractType?.map(c => (
            <span key={c} className="udb-pref-chip">{c}</span>
          ))}
          {(candidate.workPreferences?.salaryMin || candidate.workPreferences?.salaryMax) && (
            <span className="udb-pref-chip udb-pref-chip--salary">
              {candidate.workPreferences.currency}{" "}
              {candidate.workPreferences.salaryMin?.toLocaleString("es-AR") ?? ""}
              {candidate.workPreferences.salaryMin && candidate.workPreferences.salaryMax ? " — " : ""}
              {candidate.workPreferences.salaryMax?.toLocaleString("es-AR") ?? ""}
            </span>
          )}
        </div>
      </div>

      {/* Contacto y descarga */}
      <div className="udb-detail-footer">
        <div className="udb-contacts-row">
          {p.email     && <span>{p.email}</span>}
          {p.phone     && <span>{p.phone}</span>}
          {p.linkedin  && <span>{p.linkedin}</span>}
          {p.github    && <span>{p.github}</span>}
          {p.portfolio && <span>{p.portfolio}</span>}
        </div>
        <button className="udb-download-btn" onClick={onDownload}>
          ↓ DESCARGAR CV (PDF)
        </button>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
//  Sub-componente: fila de candidato
// ══════════════════════════════════════════════════════════════════════════════
function CandidateRow({ candidate, isExpanded, onToggle, onDownload }: {
  candidate: CandidateCV;
  isExpanded: boolean;
  onToggle: () => void;
  onDownload: (c: CandidateCV) => void;
}) {
  const p = candidate.personalInfo;
  const fullName = `${p.firstName} ${p.lastName}`.trim() || "Sin nombre";

  return (
    <div className={`udb-row-wrap${isExpanded ? " udb-row-wrap--expanded" : ""}`}>
      <div className="udb-row" onClick={onToggle}>

        {/* Avatar */}
        <div className="udb-row-avatar">
          {p.photo
            ? <img src={p.photo} alt={fullName} className="udb-row-avatar-img" />
            : <span>{(p.firstName?.[0] ?? "?").toUpperCase()}{(p.lastName?.[0] ?? "").toUpperCase()}</span>
          }
        </div>

        {/* Nombre + headline */}
        <div className="udb-row-info">
          <div className="udb-row-name-line">
            <span className="udb-row-name">{fullName}</span>
            {candidate.userCertificated && (
              <span className="udb-cert-badge" title="Estudiante certificado por Hidden Security">
                ✓ CERTIFICADO
              </span>
            )}
          </div>
          {p.headline && <span className="udb-row-headline">{p.headline}</span>}
        </div>

        {/* Email */}
        <span className="udb-row-email">{p.email}</span>

        {/* Skills certificadas preview */}
        <div className="udb-row-cert-skills">
          {candidate.skillsCertifiedByHidden.slice(0, 3).map(s => (
            <span key={s} className="udb-skill-chip udb-skill-chip--certified udb-skill-chip--sm">
              ✓ {s}
            </span>
          ))}
          {candidate.skillsCertifiedByHidden.length > 3 && (
            <span className="udb-skill-more">+{candidate.skillsCertifiedByHidden.length - 3}</span>
          )}
        </div>

        {/* Chevron */}
        <span className="udb-row-chevron">{isExpanded ? "▲" : "▼"}</span>
      </div>

      {isExpanded && (
        <CandidateDetail candidate={candidate} onDownload={() => onDownload(candidate)} />
      )}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
//  COMPONENTE PRINCIPAL
// ══════════════════════════════════════════════════════════════════════════════
export default function UsersDatabase() {
  const { theme } = UseTheme();
  const isLight = theme === "light";

  const [candidates,      setCandidates]      = useState<CandidateCV[]>([]);
  const [meta,            setMeta]            = useState<ApiResponse["meta"]>({ total: 0, page: 1, limit: 15, totalPages: 0 });
  const [unmatchedSkills, setUnmatchedSkills] = useState<{ declared: string[]; certified: string[] }>({ declared: [], certified: [] });
  const [skillsSummary,   setSkillsSummary]   = useState<SkillsSummary | null>(null);
  const [loading,         setLoading]         = useState(true);
  const [expandedId,      setExpandedId]      = useState<string | null>(null);
  const [page,            setPage]            = useState(1);

  const [filters, setFilters] = useState<FiltersState>(EMPTY_FILTERS);

  // ── Cargar resumen de skills (una sola vez) ────────────────────────────
  useEffect(() => {
    axios
      .get(`${import.meta.env.VITE_API_URL}/api/users-database/skills-summary`, { withCredentials: true })
      .then(({ data }) => setSkillsSummary(data))
      .catch(() => setSkillsSummary({ declaredSkills: [], certifiedSkills: [] }));
  }, []);

  // ── Cargar candidatos (filtros + paginación) ────────────────────────────
  const fetchCandidates = useCallback(() => {
    setLoading(true);
    const params: Record<string, string> = { page: String(page), limit: "15" };

    // El backend matchea por nombre de skill sin importar la categoría,
    // así que juntamos las 3 ramas seleccionadas en un solo CSV — igual
    // contrato que antes cuando "declaredSkills" era una lista plana.
    const flatDeclared = [
      ...filters.declaredSkills.roles,
      ...filters.declaredSkills.habilidades,
      ...filters.declaredSkills.herramientas,
    ];

    if (filters.search)                     params.search          = filters.search;
    if (flatDeclared.length > 0)            params.declaredSkills   = flatDeclared.join(",");
    if (filters.certifiedSkills.length > 0) params.certifiedSkills  = filters.certifiedSkills.join(",");
    if (filters.certifiedOnly)              params.certifiedOnly    = "true";
    if (filters.availability)               params.availability     = filters.availability;
    if (filters.modality)                   params.modality         = filters.modality;

    axios
      .get<ApiResponse>(`${import.meta.env.VITE_API_URL}/api/users-database`, { params, withCredentials: true })
      .then(({ data }) => {
        // Normalizamos "skills" por candidato (compat con el formato viejo)
        const normalized: CandidateCV[] = data.data.map((c: any) => ({
          ...c,
          skills: normalizeSkills(c.skills),
        }));
        setCandidates(normalized);
        setMeta(data.meta);
        setUnmatchedSkills(data.unmatchedSkills);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [page, filters]);

  useEffect(() => { fetchCandidates(); }, [fetchCandidates]);

  // Resetear a página 1 cuando cambian los filtros
  useEffect(() => { setPage(1); }, [filters]);

  // ── Descarga de CV en PDF ────────────────────────────────────────────────
  const handleDownload = (candidate: CandidateCV) => {
    const p        = candidate.personalInfo;
    const filename = `CV_${(p.firstName + "_" + p.lastName).replace(/\s+/g, "_")}`;
    const allDeclared = flattenSkills(candidate.skills);

    const section = (title: string, content: string) => !content.trim() ? "" : `
      <div style="page-break-inside:avoid;margin-bottom:28px;">
        <div style="display:flex;align-items:center;gap:14px;margin-bottom:14px;page-break-after:avoid;">
          <span style="font-family:'Montserrat',sans-serif;font-size:8px;font-weight:900;letter-spacing:5px;text-transform:uppercase;color:#111;white-space:nowrap;">${title}</span>
          <div style="flex:1;height:2px;background:#000;"></div>
        </div>${content}
      </div>`;

    const entry = (inner: string) => `<div style="page-break-inside:avoid;margin-bottom:18px;">${inner}</div>`;

    // Genera los tags de una lista de skills, marcando las certificadas
    const skillTagsFor = (list: string[]) => list.map(s => {
      const isCert = candidate.skillsCertifiedByHidden.includes(s);
      return `<span style="display:inline-block;border:1.5px solid ${isCert ? "#999" : "#111"};background:${isCert ? "#111" : "transparent"};color:${isCert ? "#fff" : "#111"};font-family:'Montserrat',sans-serif;font-size:8.5px;font-weight:800;letter-spacing:2px;text-transform:uppercase;padding:4px 11px;margin:3px;">${isCert ? "✓ " : ""}${s}</span>`;
    }).join("");

    const rolesTags        = skillTagsFor(candidate.skills.roles        ?? []);
    const habilidadesTags  = skillTagsFor(candidate.skills.habilidades  ?? []);
    const herramientasTags = skillTagsFor(candidate.skills.herramientas ?? []);

    const experienceHTML = candidate.experience.map(e => entry(`
      <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:12px;flex-wrap:wrap;margin-bottom:5px;">
        <div>
          <div style="font-family:'Montserrat',sans-serif;font-size:15px;font-weight:900;text-transform:uppercase;color:#000;">${e.position}</div>
          <div style="font-family:'Montserrat',sans-serif;font-size:12px;font-weight:700;color:#555;margin-top:2px;">${e.company}${e.location ? ` · ${e.location}` : ""}</div>
        </div>
        <div style="font-family:'Montserrat',sans-serif;font-size:10px;font-weight:700;color:#888;letter-spacing:1px;white-space:nowrap;padding-top:3px;">
          ${e.startDate}${e.startDate ? " — " : ""}${e.current ? "Actualidad" : e.endDate}
        </div>
      </div>
      ${e.description ? `<p style="font-family:'Montserrat',sans-serif;font-size:12px;font-weight:500;color:#333;line-height:1.8;margin:6px 0 0;">${e.description}</p>` : ""}`
    )).join("");

    const educationHTML = candidate.education.map(e => entry(`
      <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:12px;flex-wrap:wrap;margin-bottom:5px;">
        <div>
          <div style="font-family:'Montserrat',sans-serif;font-size:15px;font-weight:900;text-transform:uppercase;color:#000;">${e.degree}${e.field ? ` — ${e.field}` : ""}</div>
          <div style="font-family:'Montserrat',sans-serif;font-size:12px;font-weight:700;color:#555;margin-top:2px;">${e.institution}</div>
        </div>
        <div style="font-family:'Montserrat',sans-serif;font-size:10px;font-weight:700;color:#888;letter-spacing:1px;white-space:nowrap;padding-top:3px;">
          ${e.startDate}${e.startDate ? " — " : ""}${e.current ? "Actualidad" : e.endDate}
        </div>
      </div>
      ${e.description ? `<p style="font-family:'Montserrat',sans-serif;font-size:12px;font-weight:500;color:#333;line-height:1.8;margin:6px 0 0;">${e.description}</p>` : ""}`
    )).join("");

    const certsHTML = candidate.certifications.map(c => entry(`
      <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:12px;flex-wrap:wrap;">
        <div>
          <span style="font-family:'Montserrat',sans-serif;font-size:13px;font-weight:900;color:#000;">${c.name}</span>
          <span style="font-family:'Montserrat',sans-serif;font-size:11px;font-weight:600;color:#666;margin-left:8px;">· ${c.issuer}</span>
          ${c.credentialId ? `<div style="font-family:'Montserrat',sans-serif;font-size:10px;font-weight:600;color:#999;margin-top:3px;">ID: ${c.credentialId}</div>` : ""}
        </div>
        <span style="font-family:'Montserrat',sans-serif;font-size:10px;font-weight:700;color:#999;letter-spacing:1px;white-space:nowrap;">${c.date}</span>
      </div>`
    )).join("");

    const langsHTML = `<div style="display:flex;flex-wrap:wrap;gap:28px;">${candidate.languages.map(l => `
      <div style="page-break-inside:avoid;">
        <div style="font-family:'Montserrat',sans-serif;font-size:14px;font-weight:900;text-transform:uppercase;color:#000;">${l.language}</div>
        <div style="font-family:'Montserrat',sans-serif;font-size:10px;font-weight:800;letter-spacing:2px;color:#777;text-transform:uppercase;margin-top:2px;">${l.level}</div>
      </div>`).join("")}</div>`;

    const projectsHTML = candidate.projects.map(proj => entry(`
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
      </div>`
    )).join("");

    const wp = candidate.workPreferences ?? {} as WorkPreferences;
    const dispHTML = `
      <div style="page-break-inside:avoid;display:flex;align-items:center;gap:20px;flex-wrap:wrap;">
        <span style="font-family:'Montserrat',sans-serif;font-size:16px;font-weight:900;text-transform:uppercase;color:#000;">${candidate.availability ?? ""}</span>
        ${wp.modality?.length > 0 ? `<span style="font-family:'Montserrat',sans-serif;font-size:11px;font-weight:600;color:#666;">${wp.modality.join(" · ")}</span>` : ""}
        ${wp.salaryMin || wp.salaryMax ? `<span style="font-family:'Montserrat',sans-serif;font-size:11px;font-weight:700;color:#555;">${wp.currency ?? "USD"} ${wp.salaryMin?.toLocaleString("es-AR") ?? ""}${wp.salaryMin && wp.salaryMax ? " — " : ""}${wp.salaryMax?.toLocaleString("es-AR") ?? ""}</span>` : ""}
      </div>`;

    const certifiedBadge = candidate.userCertificated
      ? `<div style="display:inline-block;background:#000;color:#fff;font-family:'Montserrat',sans-serif;font-size:9px;font-weight:900;letter-spacing:3px;text-transform:uppercase;padding:6px 14px;margin-top:8px;">✓ ESTUDIANTE CERTIFICADO — HIDDEN SECURITY</div>`
      : "";

    const html = `<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8"/><title>${filename}</title>
      <link href="https://fonts.googleapis.com/css2?family=Montserrat:wght@400;500;600;700;800;900&display=swap" rel="stylesheet"/>
      <style>*{margin:0;padding:0;box-sizing:border-box;}body{background:#fff;color:#000;font-family:'Montserrat',sans-serif;}@page{size:A4;margin:18mm 16mm;}@media print{body{-webkit-print-color-adjust:exact;print-color-adjust:exact;}.no-print{display:none!important;}}</style>
    </head><body><div style="max-width:794px;margin:0 auto;padding:0 0 48px;">
      <div style="page-break-inside:avoid;display:flex;justify-content:space-between;align-items:flex-start;gap:24px;padding-bottom:20px;border-bottom:3px solid #000;margin-bottom:28px;flex-wrap:wrap;">
        <div style="flex:1;min-width:200px;padding:30px;">
          <div style="font-family:'Montserrat',sans-serif;font-size:8px;font-weight:800;letter-spacing:6px;text-transform:uppercase;color:#888;margin-bottom:8px;">CURRICULUM VITAE</div>
          <h1 style="font-family:'Montserrat',sans-serif;font-size:42px;font-weight:900;letter-spacing:-2.5px;text-transform:uppercase;line-height:0.92;color:#000;margin-bottom:10px;">${p.firstName ?? ""}<br/>${p.lastName ?? ""}</h1>
          ${p.headline ? `<p style="font-family:'Montserrat',sans-serif;font-size:12px;font-weight:600;color:#555;line-height:1.5;margin-top:8px;max-width:380px;">${p.headline}</p>` : ""}
          ${certifiedBadge}
        </div>
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
      ${p.summary ? section("PERFIL PROFESIONAL", `<p style="font-family:'Montserrat',sans-serif;font-size:13px;font-weight:500;color:#222;line-height:1.85;border-left:3px solid #000;padding-left:16px;">${p.summary}</p>`) : ""}
      ${experienceHTML ? section("EXPERIENCIA LABORAL", experienceHTML) : ""}
      ${educationHTML  ? section("EDUCACIÓN",           educationHTML)  : ""}
      ${rolesTags        ? section("ÁREAS Y ROLES — ✓ = CERTIFICADA POR HIDDEN", `<div style="display:flex;flex-wrap:wrap;gap:4px;">${rolesTags}</div>`) : ""}
      ${habilidadesTags  ? section("HABILIDADES — ✓ = CERTIFICADA POR HIDDEN", `<div style="display:flex;flex-wrap:wrap;gap:4px;">${habilidadesTags}</div>`) : ""}
      ${herramientasTags ? section("HERRAMIENTAS — ✓ = CERTIFICADA POR HIDDEN", `<div style="display:flex;flex-wrap:wrap;gap:4px;">${herramientasTags}</div>`) : ""}
      ${projectsHTML   ? section("PROYECTOS",           projectsHTML)   : ""}
      ${certsHTML      ? section("CERTIFICACIONES",     certsHTML)      : ""}
      ${candidate.languages.length > 0 ? section("IDIOMAS", langsHTML) : ""}
      ${candidate.availability ? section("DISPONIBILIDAD", dispHTML) : ""}
    </div>
    <div class="no-print" style="position:fixed;bottom:24px;right:24px;">
      <button onclick="window.print()" style="background:#000;border:none;color:#fff;font-family:'Montserrat',sans-serif;font-size:11px;font-weight:900;letter-spacing:2px;text-transform:uppercase;padding:14px 28px;cursor:pointer;">↓ GUARDAR PDF</button>
    </div></body></html>`;

    const win = window.open("", "_blank");
    if (!win) return;
    win.document.write(html);
    win.document.close();
  };

  return (
    <div className={`udb-wrap${isLight ? " light" : ""}`}>

      {/* Header */}
      <div className="udb-header">
        <span className="udb-eyebrow">// BASE_DE_CANDIDATOS</span>
        <h1 className="udb-title">
          BÚSQUEDA DE <span className="udb-accent">TALENTO</span>
        </h1>
        <p className="udb-subtitle">
          Explorá los perfiles de candidatos certificados por Hidden Security. Las skills con{" "}
          <span className="udb-skill-chip udb-skill-chip--certified udb-skill-chip--sm">✓</span>{" "}
          fueron validadas por nuestra plataforma.
        </p>
      </div>

      {/* Filtros */}
      <FiltersPanel
        filters={filters}
        setFilters={setFilters}
        skillsSummary={skillsSummary}
        unmatchedSkills={unmatchedSkills}
      />

      {/* Resultados */}
      <div className="udb-results-meta">
        {loading ? (
          <span className="udb-results-count">Cargando...</span>
        ) : (
          <span className="udb-results-count">
            {meta.total} candidato{meta.total !== 1 ? "s" : ""} encontrado{meta.total !== 1 ? "s" : ""}
          </span>
        )}
      </div>

      {loading ? (
        <div className="udb-loading">
          <span className="udb-loading-dot" />
          <span className="udb-loading-dot" />
          <span className="udb-loading-dot" />
        </div>
      ) : candidates.length === 0 ? (
        <div className="udb-empty">
          <span className="udb-mono">// SIN_RESULTADOS</span>
          <p>Ningún candidato coincide con los filtros aplicados.</p>
        </div>
      ) : (
        <div className="udb-list">
          {candidates.map((c) => (
            <CandidateRow
              key={c.id}
              candidate={c}
              isExpanded={expandedId === c.id}
              onToggle={() => setExpandedId(expandedId === c.id ? null : c.id)}
              onDownload={handleDownload}
            />
          ))}
        </div>
      )}

      {/* Paginación */}
      {meta.totalPages > 1 && (
        <div className="udb-pagination">
          <button
            className="udb-page-btn"
            onClick={() => setPage(p => Math.max(1, p - 1))}
            disabled={page === 1}
          >
            ← ANTERIOR
          </button>
          <span className="udb-page-info">
            Página {meta.page} / {meta.totalPages}
          </span>
          <button
            className="udb-page-btn"
            onClick={() => setPage(p => Math.min(meta.totalPages, p + 1))}
            disabled={page === meta.totalPages}
          >
            SIGUIENTE →
          </button>
        </div>
      )}
    </div>
  );
}