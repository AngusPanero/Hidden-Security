import { useState, useEffect, useCallback, useRef } from "react";
import axios from "axios";
import { UseTheme } from "../contexts/ThemeContext";
import { UseSession } from "../contexts/SessionContext";
import { Link } from "react-router-dom";
import { HS_SKILLS } from "../skills/Skills"; // ajustar esta ruta si difiere de la del CV Builder
import "./usersDataBase.css";

// --- Types --------------------------------------------------------------------
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

// Skills declaradas por el candidato -- mismo arbol que HS_SKILLS (skills.ts)
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
  // Skills otorgadas por completar un curso -- derivadas en el backend
  // directamente desde CourseProgress.isCompleted en Mongo (no vive en
  // ninguna claim de Firebase, ver usersDatabaseRouter.js).
  // Distinto de skillsCertifiedByHidden: esto es "vio el curso y aprobo
  // los quizzes", no un examen controlado de certificacion.
  modernSocSkills:         string[];
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

// -- Ramas de skills -- mismas 3 que en el CV Builder ------------------------
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

// Cuantas skills se muestran por pagina dentro de cada grupo del detalle
// del candidato -- el boton "Ver mas" suma de a este tamaño.
const SKILLS_PAGE_SIZE = 20;

// -- Planes Enterprise -- unicos habilitados para ver esta base -------------
const ENTERPRISE_PLANS = ["business", "enterprise"];

// Mismo criterio que Checkout.getActivePlan: un plan enterprise esta vigente
// si esta en purchases Y su fecha en purchaseExpiry todavia no vencio.
function hasActiveEnterprisePlan(purchases: string[], purchaseExpiry: Record<string, string>): boolean {
  if (!Array.isArray(purchases)) return false;
  const now = new Date();
  return purchases.some(planId => {
    if (!ENTERPRISE_PLANS.includes(planId)) return false;
    const expiryStr = purchaseExpiry?.[planId];
    if (!expiryStr) return false;
    return new Date(expiryStr) > now;
  });
}

// Aplana un catalogo { grupo: [items] } (como HS_SKILLS.AREAS_Y_ROLES) a un
// array plano de nombres -- se usa para saber a que rama (roles/habilidades/
// herramientas) pertenece cada skill que otorgo un curso, y para armar el
// catalogo de sugerencias del buscador general.
function flattenCatalog(catalog: Record<string, readonly string[]>): string[] {
  return Object.values(catalog).flat();
}

// Mapea cada skill a su subgrupo dentro de un catalogo (ej: "Linux" ->
// "Tecnologías") -- se usa para separar visualmente por "Fundamentos",
// "Operaciones SOC", etc. dentro de cada rama.
function buildSkillGroupMap(catalog: Record<string, readonly string[]>): Record<string, string> {
  const map: Record<string, string> = {};
  for (const [group, items] of Object.entries(catalog)) {
    for (const item of items) map[item] = group;
  }
  return map;
}

// Catalogo completo (las 3 ramas juntas, sin duplicados) -- solo para armar
// las sugerencias del buscador general por nombre de skill.
const ALL_SKILLS_SEARCHABLE: string[] = Array.from(
  new Set(CATEGORY_ORDER.flatMap(cat => flattenCatalog(CATEGORY_CATALOGS[cat])))
);

// Quita acentos y pasa a minusculas para comparar sin distinguir "gestion"
// de "gestión" -- se usa solo para filtrar las sugerencias del buscador en
// el frontend; el backend resuelve el mismo problema con su propio regex
// tolerante a acentos (buildFlexibleRegex en usersDatabaseRouter.js).
function normalizeForMatch(s: string): string {
  return s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
}

// Compat: candidatos guardados antes del cambio de estructura tenian
// "skills" como array plano. Todo lo que no reconocemos cae en "herramientas"
// para no perder data -- igual que hicimos en el CV Builder.
function normalizeSkills(raw: any): SkillsSelection {
  if (Array.isArray(raw)) return { roles: [], habilidades: [], herramientas: raw };
  return {
    roles:        raw?.roles        ?? [],
    habilidades:  raw?.habilidades  ?? [],
    herramientas: raw?.herramientas ?? [],
  };
}

// ==============================================================================
//  Sub-componente: chip de skill (declarada / certificada Hidden / curso SOC)
// ==============================================================================
// Tres estados posibles, no excluyentes entre si:
// - certified: examen controlado de Hidden Security (skillsCertifiedByHidden)
// - courseValidated: la skill fue otorgada por completar un curso
//   (modernSocSkills) -- sin importar si el candidato tambien la habia
//   declarado en su CV o si se agrego solo porque el curso la otorgo.
// Un skill puede tener ambos indicadores a la vez si coincide con las dos fuentes.
function SkillChip({ label, certified, courseValidated }: { label: string; certified?: boolean; courseValidated?: boolean }) {
  return (
    <span
      className={`udb-skill-chip${certified ? " udb-skill-chip--certified" : ""}${courseValidated ? " udb-skill-chip--course" : ""}`}
    >
      {certified && <span className="udb-skill-chip-icon" title="Certificado por examen de Hidden Security">✓</span>}
      {label}
    </span>
  );
}

// ==============================================================================
//  Sub-componente: dropdown de una rama de skills (Áreas/Habilidades/Herramientas)
//  Buscador propio (16px) arriba; sin busqueda activa, acordeon por subgrupo.
// ==============================================================================
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

  // Al cerrar el dropdown, reseteamos busqueda y subgrupo abierto
  useEffect(() => {
    if (!isOpen) { setQuery(""); setOpenSubgroup(null); }
  }, [isOpen]);

  const trimmed = normalizeForMatch(query.trim());
  const searchResults = trimmed.length === 0
    ? []
    : Object.entries(catalog).flatMap(([group, items]) =>
        items
          .filter(name => normalizeForMatch(name).includes(trimmed))
          .map(name => ({ group, name }))
      );

  return (
    <div className="udb-filter-dropdown" ref={ref}>
      <button
        className={`udb-filter-btn${selected.length > 0 ? " udb-filter-btn--active" : ""}${isOpen ? " udb-filter-btn--open" : ""}`}
        onClick={() => (isOpen ? onClose() : onOpen())}
        aria-expanded={isOpen}
      >
        {label.toUpperCase()}
        {selected.length > 0 && <span className="udb-filter-count">{selected.length}</span>}
        <span className="udb-filter-caret" aria-hidden="true">▾</span>
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
                        <span className="udb-skillgroup-chevron">{open ? "-" : "+"}</span>
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

// ==============================================================================
//  Sub-componente: panel de filtros
// ==============================================================================
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
  // Un solo estado de "cual dropdown de rama esta abierto" -- abrir uno cierra el resto
  const [openBranch, setOpenBranch] = useState<SkillCategory | "certified" | null>(null);
  const certifiedRef = useRef<HTMLDivElement>(null);

  // Sugerencias del buscador general -- muestra nombres de skills que
  // coinciden con lo tipeado, para que el reclutador pueda buscar por
  // skill puntual desde el mismo input de nombre/email/headline.
  const [showSearchSuggestions, setShowSearchSuggestions] = useState(false);
  const searchRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (openBranch === "certified" && certifiedRef.current && !certifiedRef.current.contains(e.target as Node)) {
        setOpenBranch(null);
      }
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
        setShowSearchSuggestions(false);
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

  const searchTrimmed = normalizeForMatch(filters.search.trim());
  const searchSuggestions = searchTrimmed.length === 0
    ? []
    : ALL_SKILLS_SEARCHABLE.filter(s => normalizeForMatch(s).includes(searchTrimmed)).slice(0, 60);

  return (
    <div className="udb-filters">
      <div className="udb-filters-row">

        {/* Busqueda general -- tambien busca por skill puntual, con
            sugerencias scrolleables mientras se tipea */}
        <div className="udb-search-wrap" ref={searchRef}>
          <input
            className="udb-search-input"
            placeholder="Buscar por nombre, email, headline o skill..."
            value={filters.search}
            onChange={(e) => { setFilters({ ...filters, search: e.target.value }); setShowSearchSuggestions(true); }}
            onFocus={() => setShowSearchSuggestions(true)}
          />
          {showSearchSuggestions && searchSuggestions.length > 0 && (
            <div className="udb-search-suggestions">
              {searchSuggestions.map(skill => (
                <button
                  key={skill}
                  type="button"
                  className="udb-search-suggestion-item"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => { setFilters({ ...filters, search: skill }); setShowSearchSuggestions(false); }}
                >
                  {skill}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Las 3 ramas de skills declaradas -- cada una con su propio buscador */}
        <span className="udb-filter-group-label">AUTODECLARADAS:</span>
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

        {/* Skills certificadas por Hidden -- se mantiene como antes */}
        <div className="udb-filter-dropdown" ref={certifiedRef}>
          <button
            className={`udb-filter-btn udb-filter-btn--gold${filters.certifiedSkills.length > 0 ? " udb-filter-btn--active" : ""}${openBranch === "certified" ? " udb-filter-btn--open" : ""}`}
            onClick={() => setOpenBranch(openBranch === "certified" ? null : "certified")}
            aria-expanded={openBranch === "certified"}
          >
            ✓ CERTIFICADAS HIDDEN
            {filters.certifiedSkills.length > 0 && (
              <span className="udb-filter-count">{filters.certifiedSkills.length}</span>
            )}
            <span className="udb-filter-caret" aria-hidden="true">▾</span>
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
          <span className="udb-unmatched-icon">!</span>
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

// ==============================================================================
//  Cursos de Hidden que otorgan skills -- un registro por curso.
//  Cuando se suba otro curso, se agrega una entrada con el campo que trae el
//  backend para ese curso y su titulo visible.
// ==============================================================================
const HIDDEN_COURSES: { id: string; title: string; getSkills: (c: CandidateCV) => string[] }[] = [
  { id: "modern-soc", title: "Modern SOC Operations", getSkills: c => c.modernSocSkills ?? [] },
];

// Cuantas skills validadas por curso se muestran por pagina en el arbol
const COURSE_PAGE_SIZE = 24;

// Ubica una skill en el catalogo: rama (roles/habilidades/herramientas) y
// subgrupo. Lo que no esta en el catalogo cae en "Otros".
const BRANCH_INDEX: { branch: SkillCategory; groupMap: Record<string, string>; groupOrder: string[] }[] =
  CATEGORY_ORDER.map(branch => ({
    branch,
    groupMap:   buildSkillGroupMap(CATEGORY_CATALOGS[branch]),
    groupOrder: Object.keys(CATEGORY_CATALOGS[branch]),
  }));

function locateSkill(skill: string): { branch: SkillCategory | "otros"; branchIdx: number; group: string; groupIdx: number } {
  for (let i = 0; i < BRANCH_INDEX.length; i++) {
    const b = BRANCH_INDEX[i];
    const group = b.groupMap[skill];
    if (group) return { branch: b.branch, branchIdx: i, group, groupIdx: b.groupOrder.indexOf(group) };
  }
  return { branch: "otros", branchIdx: 99, group: "Otros", groupIdx: 0 };
}

// Ordena por rama -> subgrupo -> nombre, igual que el catalogo
function sortByCatalog(skills: string[]): string[] {
  return [...skills].sort((a, b) => {
    const la = locateSkill(a), lb = locateSkill(b);
    if (la.branchIdx !== lb.branchIdx) return la.branchIdx - lb.branchIdx;
    if (la.groupIdx  !== lb.groupIdx)  return la.groupIdx  - lb.groupIdx;
    return a.localeCompare(b);
  });
}

// Parte una lista ya ordenada en bloques contiguos rama/subgrupo, para
// mostrar cada titulo una sola vez
function segmentByGroup(skills: string[]) {
  const segments: { branchLabel: string; group: string; skills: string[] }[] = [];
  skills.forEach(skill => {
    const loc = locateSkill(skill);
    const branchLabel = loc.branch === "otros" ? "Otros" : CATEGORY_LABELS[loc.branch];
    const last = segments[segments.length - 1];
    if (last && last.branchLabel === branchLabel && last.group === loc.group) last.skills.push(skill);
    else segments.push({ branchLabel, group: loc.group, skills: [skill] });
  });
  return segments;
}

// ==============================================================================
//  Sub-componente: curso de Hidden con su arbol de skills validadas
//  Boton desplegable con el nombre del curso -> arbol paginado.
// ==============================================================================
function ValidatedCourse({ title, skills }: { title: string; skills: string[] }) {
  const [open, setOpen] = useState(false);
  const [page, setPage] = useState(0);

  const sorted     = sortByCatalog(skills);
  const totalPages = Math.max(1, Math.ceil(sorted.length / COURSE_PAGE_SIZE));
  const pageItems  = sorted.slice(page * COURSE_PAGE_SIZE, (page + 1) * COURSE_PAGE_SIZE);
  const segments   = segmentByGroup(pageItems);

  // Resumen por rama para el boton cerrado: "12 roles · 30 habilidades · 8 herramientas"
  const branchCounts = CATEGORY_ORDER
    .map(cat => ({ cat, n: skills.filter(s => locateSkill(s).branch === cat).length }))
    .filter(x => x.n > 0);

  let lastBranch = "";

  return (
    <div className={`udb-vcourse${open ? " open" : ""}`}>
      <button
        type="button"
        className="udb-vcourse-head"
        onClick={() => setOpen(o => !o)}
        aria-expanded={open}
      >
        <span className="udb-vcourse-icon" aria-hidden="true">▸</span>
        <span className="udb-vcourse-info">
          <span className="udb-vcourse-kicker">CURSO COMPLETADO EN HIDDEN SECURITY</span>
          <span className="udb-vcourse-title">{title}</span>
          <span className="udb-vcourse-meta">
            {skills.length} skills validadas
            {branchCounts.length > 0 && " · " + branchCounts.map(b => `${b.n} ${CATEGORY_LABELS[b.cat].toLowerCase()}`).join(" · ")}
          </span>
        </span>
        <span className="udb-vcourse-action">{open ? "OCULTAR" : "VER SKILLS"}</span>
      </button>

      {open && (
        <div className="udb-vcourse-body">
          <p className="udb-vcourse-note">
            Skills que el candidato demostró al completar el curso y aprobar sus evaluaciones.
          </p>

          {segments.map((seg, i) => {
            const showBranch = seg.branchLabel !== lastBranch;
            lastBranch = seg.branchLabel;
            return (
              <div key={`${seg.branchLabel}-${seg.group}-${i}`} className="udb-vcourse-seg">
                {showBranch && <span className="udb-vcourse-branch">{seg.branchLabel}</span>}
                <span className="udb-skill-subgroup-title">{seg.group}</span>
                <div className="udb-skills-row">
                  {seg.skills.map(s => (
                    <span key={s} className="udb-skill-chip udb-skill-chip--course">{s}</span>
                  ))}
                </div>
              </div>
            );
          })}

          {totalPages > 1 && (
            <div className="udb-vcourse-pager">
              <button type="button" className="udb-page-btn" disabled={page === 0} onClick={() => setPage(p => p - 1)}>
                ← ANTERIOR
              </button>
              <span className="udb-page-info">Página {page + 1} / {totalPages}</span>
              <button type="button" className="udb-page-btn" disabled={page >= totalPages - 1} onClick={() => setPage(p => p + 1)}>
                SIGUIENTE →
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ==============================================================================
//  Sub-componente: una rama de skills autodeclaradas (acordeon)
// ==============================================================================
function DeclaredBranch({
  category, items, candidate,
}: {
  category: SkillCategory;
  items: string[];
  candidate: CandidateCV;
}) {
  const [open,    setOpen]    = useState(false);
  const [visible, setVisible] = useState(SKILLS_PAGE_SIZE);

  const sorted    = sortByCatalog(items);
  const shown     = sorted.slice(0, visible);
  const remaining = sorted.length - visible;
  const segments  = segmentByGroup(shown);
  const validated = new Set([...candidate.skillsCertifiedByHidden, ...(candidate.modernSocSkills ?? [])]);

  return (
    <div className={`udb-dbranch${open ? " open" : ""}`}>
      <button
        type="button"
        className="udb-dbranch-head"
        onClick={() => setOpen(o => !o)}
        aria-expanded={open}
      >
        <span className="udb-dbranch-icon" aria-hidden="true">▸</span>
        <span className="udb-dbranch-title">{CATEGORY_LABELS[category]}</span>
        <span className="udb-dbranch-count">{items.length} skills</span>
        <span className="udb-dbranch-action">{open ? "OCULTAR" : "VER"}</span>
      </button>

      {open && (
        <div className="udb-dbranch-body">
          {segments.map((seg, i) => (
            <div key={`${seg.group}-${i}`} className="udb-skill-subgroup">
              <span className="udb-skill-subgroup-title">{seg.group}</span>
              <div className="udb-skills-row">
                {seg.skills.map(s => (
                  <SkillChip
                    key={s}
                    label={s}
                    certified={candidate.skillsCertifiedByHidden.includes(s)}
                    courseValidated={!candidate.skillsCertifiedByHidden.includes(s) && validated.has(s)}
                  />
                ))}
              </div>
            </div>
          ))}

          {remaining > 0 && (
            <button
              type="button"
              className="udb-skill-more-btn"
              onClick={() => setVisible(v => v + SKILLS_PAGE_SIZE)}
            >
              Ver {Math.min(SKILLS_PAGE_SIZE, remaining)} más ({remaining} restantes)
            </button>
          )}
        </div>
      )}
    </div>
  );
}

// ==============================================================================
//  Sub-componente: desglose del candidato (panel expandido)
//  Orden: perfil -> VALIDADO POR HIDDEN -> AUTODECLARADO -> resto del CV
// ==============================================================================
function CandidateDetail({ candidate, onDownload }: { candidate: CandidateCV; onDownload: () => void }) {
  const p = candidate.personalInfo;

  const certs   = candidate.skillsCertifiedByHidden ?? [];
  const courses = HIDDEN_COURSES
    .map(c => ({ ...c, skills: c.getSkills(candidate) }))
    .filter(c => c.skills.length > 0);
  const hasValidated = certs.length > 0 || courses.length > 0;

  const declaredBranches = CATEGORY_ORDER
    .map(cat => ({ cat, items: candidate.skills[cat] ?? [] }))
    .filter(b => b.items.length > 0);
  const hasValidatedInDeclared = declaredBranches.some(b =>
    b.items.some(s => certs.includes(s) || (candidate.modernSocSkills ?? []).includes(s))
  );

  return (
    <div className="udb-detail">

      {/* Perfil */}
      {p.summary && (
        <div className="udb-detail-section">
          <span className="udb-detail-section-title">// PERFIL PROFESIONAL</span>
          <p className="udb-detail-text">{p.summary}</p>
        </div>
      )}

      {/* ── VALIDADO POR HIDDEN SECURITY ─────────────────────────────── */}
      <div className="udb-validated">
        <div className="udb-validated-head">
          <span className="udb-validated-title">VALIDADO POR HIDDEN SECURITY</span>
          <span className="udb-validated-sub">Comprobado por nosotros</span>
        </div>

        {!hasValidated ? (
          <p className="udb-validated-empty">
            Este candidato todavía no tiene certificaciones ni cursos completados en Hidden Security.
          </p>
        ) : (
          <>
            {certs.length > 0 && (
              <div className="udb-validated-group">
                <span className="udb-validated-label udb-validated-label--gold">
                  Certificaciones · examen controlado y cronometrado
                </span>
                <div className="udb-cert-cards">
                  {certs.map(c => (
                    <div key={c} className="udb-cert-card">
                      <span className="udb-cert-card-mark" aria-hidden="true">✓</span>
                      <span className="udb-cert-card-text">
                        <strong>{c}</strong>
                        <span>Certificación Hidden Security</span>
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {courses.length > 0 && (
              <div className="udb-validated-group">
                <span className="udb-validated-label udb-validated-label--course">
                  Cursos completados · skills validadas por evaluaciones
                </span>
                {courses.map(c => (
                  <ValidatedCourse key={c.id} title={c.title} skills={c.skills} />
                ))}
              </div>
            )}
          </>
        )}
      </div>

      {/* ── AUTODECLARADO EN EL CV ───────────────────────────────────── */}
      <div className="udb-declared">
        <div className="udb-declared-head">
          <span className="udb-declared-title">SKILLS AUTODECLARADAS EN SU CV</span>
          <span className="udb-declared-sub">
            Las cargó el candidato. Hidden Security no las verificó. Tocá cada categoría para ver el detalle.
          </span>
        </div>

        {declaredBranches.length === 0 ? (
          <p className="udb-detail-empty">El candidato no declaró skills en su CV.</p>
        ) : (
          <>
            {declaredBranches.map(b => (
              <DeclaredBranch key={b.cat} category={b.cat} items={b.items} candidate={candidate} />
            ))}
            {hasValidatedInDeclared && (
              <p className="udb-detail-hint">
                Las que aparecen en dorado o celeste también están validadas por Hidden Security.
              </p>
            )}
          </>
        )}
      </div>

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

      {/* Certificaciones declaradas (externas) */}
      {candidate.certifications.length > 0 && (
        <div className="udb-detail-section">
          <span className="udb-detail-section-title">// OTRAS CERTIFICACIONES (DECLARADAS)</span>
          {candidate.certifications.map((c, i) => (
            <div key={i} className="udb-entry">
              <div className="udb-entry-header">
                <div>
                  <strong>{c.name}</strong>
                  <span className="udb-entry-sub"> · {c.issuer}</span>
                  {c.url && <> · <a className="udb-entry-link" href={c.url} target="_blank" rel="noreferrer">Ver certificación</a></>}
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

// ==============================================================================
//  Sub-componente: fila de candidato
// ==============================================================================
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
          {(() => {
            const certs   = candidate.skillsCertifiedByHidden ?? [];
            const courses = HIDDEN_COURSES.filter(c => c.getSkills(candidate).length > 0);
            return (
              <>
                {certs.length > 0 && (
                  <span
                    className="udb-skill-chip udb-skill-chip--certified udb-skill-chip--sm"
                    title={`Certificaciones: ${certs.join(", ")}`}
                  >
                    CERTIFICADO
                  </span>
                )}
                {courses.length > 0 && (
                  <span
                    className="udb-skill-chip udb-skill-chip--course udb-skill-chip--sm"
                    title={`Cursos: ${courses.map(c => c.title).join(", ")}`}
                  >
                    CURSOS COMPLETADOS
                  </span>
                )}
              </>
            );
          })()}
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

// ==============================================================================
//  Sub-componente: pantalla de acceso restringido (sin plan enterprise activo)
// ==============================================================================
function EnterpriseBlockedScreen({ isLight, isEnterprise }: { isLight: boolean; isEnterprise: boolean }) {
  return (
    <div className={`udb-wrap${isLight ? " light" : ""}`}>
      <div className="udb-blocked">
        <span className="udb-blocked-mark" aria-hidden="true"></span>
        <span className="udb-eyebrow">// ACCESO_RESTRINGIDO</span>
        <h1 className="udb-title">
          SOLO PARA CUENTAS <span className="udb-accent">BUSINESS / ENTERPRISE</span>
        </h1>
        <p className="udb-subtitle udb-blocked-text">
          La búsqueda de candidatos es una funcionalidad exclusiva de los planes Business y Enterprise
          de Hidden Security.
          {isEnterprise
            ? " Tu plan venció — renovalo para recuperar el acceso."
            : " Contactanos para activar tu cuenta enterprise."}
        </p>
        <Link to="/pricing?tipo=empresas" className="udb-blocked-cta">
          {isEnterprise ? "Renovar plan" : "Ver planes corporativos"}
        </Link>
      </div>
    </div>
  );
}

// ==============================================================================
//  COMPONENTE PRINCIPAL
// ==============================================================================
export default function UsersDatabase() {
  const { theme } = UseTheme();
  const { user }  = UseSession();
  const isLight = theme === "light";

  // -- Chequeo de plan Business/Enterprise vigente --------------------------
  // Mismo criterio que Checkout.getActivePlan: el flag isEnterprise puede
  // seguir en true en claims viejas aunque el plan ya haya vencido, por eso
  // se valida tambien contra purchaseExpiry y no solo contra el flag.
  const purchases        = (user as any)?.purchases      ?? [];
  const purchaseExpiry   = (user as any)?.purchaseExpiry ?? {};
  const isEnterprise     = !!(user as any)?.isEnterprise;
  // El flag isEnterprise decide que planes puede COMPRAR un usuario (ver
  // paymentsRouter.js), no si tiene acceso HOY a esta funcionalidad. El
  // acceso depende unicamente de tener un plan business/enterprise vigente
  // en purchases + purchaseExpiry -- por eso NO se exige isEnterprise aca.
  // isEnterprise se sigue usando mas abajo solo para elegir el texto del
  // mensaje en la pantalla de bloqueo.
  const enterpriseActive = hasActiveEnterprisePlan(purchases, purchaseExpiry);

  const [candidates,      setCandidates]      = useState<CandidateCV[]>([]);
  const [meta,            setMeta]            = useState<ApiResponse["meta"]>({ total: 0, page: 1, limit: 15, totalPages: 0 });
  const [unmatchedSkills, setUnmatchedSkills] = useState<{ declared: string[]; certified: string[] }>({ declared: [], certified: [] });
  const [skillsSummary,   setSkillsSummary]   = useState<SkillsSummary | null>(null);
  const [loading,         setLoading]         = useState(true);
  const [expandedId,      setExpandedId]      = useState<string | null>(null);
  const [page,            setPage]            = useState(1);

  const [filters, setFilters] = useState<FiltersState>(EMPTY_FILTERS);

  // -- Cargar resumen de skills (una sola vez) -- solo con plan vigente ----
  useEffect(() => {
    if (!enterpriseActive) return;
    axios
      .get(`${import.meta.env.VITE_API_URL}/api/users-database/skills-summary`, { withCredentials: true })
      .then(({ data }) => setSkillsSummary(data))
      .catch(() => setSkillsSummary({ declaredSkills: [], certifiedSkills: [] }));
  }, [enterpriseActive]);

  // -- Cargar candidatos (filtros + paginacion) -- solo con plan vigente ---
  const fetchCandidates = useCallback(() => {
    if (!enterpriseActive) return;
    setLoading(true);
    const params: Record<string, string> = { page: String(page), limit: "15" };

    // El backend matchea por nombre de skill sin importar la categoria,
    // asi que juntamos las 3 ramas seleccionadas en un solo CSV -- igual
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
        // Normalizamos "skills" por candidato (compat con el formato viejo).
        // modernSocSkills ya viene como array plano desde el backend -- no
        // necesita normalizacion, solo un fallback a [] por si falta.
        const normalized: CandidateCV[] = data.data.map((c: any) => ({
          ...c,
          skills: normalizeSkills(c.skills),
          modernSocSkills: c.modernSocSkills ?? [],
        }));
        setCandidates(normalized);
        setMeta(data.meta);
        setUnmatchedSkills(data.unmatchedSkills);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [page, filters, enterpriseActive]);

  useEffect(() => { fetchCandidates(); }, [fetchCandidates]);

  // Resetear a pagina 1 cuando cambian los filtros
  useEffect(() => { setPage(1); }, [filters]);

  // -- Descarga de CV en PDF --------------------------------------------------
  // Formato corto y jerarquico: primero lo validado por Hidden (resumido, sin
  // listar las decenas de skills del curso), despues el CV y al final las
  // skills autodeclaradas como texto compacto.
  const handleDownload = (candidate: CandidateCV) => {
    const p        = candidate.personalInfo;
    const filename = `CV_${(`${p.firstName ?? ""}_${p.lastName ?? ""}`).replace(/\s+/g, "_")}`;

    // Todo lo que escribe el candidato se escapa: el HTML se abre en una
    // ventana del mismo origen que la plataforma.
    const esc = (v: unknown) => String(v ?? "")
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
    const safeUrl = (u: string) => (/^https?:\/\//i.test(u ?? "") ? esc(u) : "");

    const dates = (start: string, end: string, current: boolean) =>
      esc(`${start ?? ""}${start ? " — " : ""}${current ? "Actualidad" : (end ?? "")}`);

    const section = (title: string, content: string, note = "") => !content.trim() ? "" : `
      <section class="sec">
        <div class="sec-head"><h2>${title}</h2><span class="rule"></span></div>
        ${note ? `<p class="sec-note">${note}</p>` : ""}
        ${content}
      </section>`;

    // ── Validado por Hidden ──────────────────────────────────────────────
    const certs   = candidate.skillsCertifiedByHidden ?? [];
    const courses = HIDDEN_COURSES
      .map(c => ({ title: c.title, skills: c.getSkills(candidate) }))
      .filter(c => c.skills.length > 0);

    const courseAreas = (skills: string[]) => {
      const counts = new Map<string, number>();
      skills.forEach(s => {
        const g = locateSkill(s).group;
        counts.set(g, (counts.get(g) ?? 0) + 1);
      });
      const list = [...counts.entries()].sort((a, b) => b[1] - a[1]);
      const top  = list.slice(0, 6).map(([g, n]) => `${esc(g)} (${n})`).join(" · ");
      return list.length > 6 ? `${top} · +${list.length - 6} áreas más` : top;
    };

    const validatedHTML = (certs.length || courses.length) ? `
      <div class="validated">
        <div class="validated-head">
          <span class="validated-title">VALIDADO POR HIDDEN SECURITY</span>
          <span class="validated-sub">Comprobado por la plataforma, no declarado por el candidato</span>
        </div>
        ${certs.map(c => `
          <div class="vrow">
            <span class="vtag vtag--cert">✓ CERTIFICACIÓN</span>
            <div><strong>${esc(c)}</strong><span class="vdesc">Examen controlado y cronometrado</span></div>
          </div>`).join("")}
        ${courses.map(c => `
          <div class="vrow">
            <span class="vtag vtag--course">CURSO</span>
            <div>
              <strong>${esc(c.title)}</strong><span class="vdesc">${c.skills.length} skills validadas por evaluaciones</span>
              <div class="vareas">${courseAreas(c.skills)}</div>
            </div>
          </div>`).join("")}
      </div>` : "";

    // ── Experiencia / educación ─────────────────────────────────────────
    const experienceHTML = candidate.experience.map(e => `
      <div class="entry">
        <div class="entry-head">
          <div><strong>${esc(e.position)}</strong><span class="entry-sub"> · ${esc(e.company)}${e.location ? `, ${esc(e.location)}` : ""}</span></div>
          <span class="entry-date">${dates(e.startDate, e.endDate, e.current)}</span>
        </div>
        ${e.description ? `<p class="entry-text">${esc(e.description)}</p>` : ""}
      </div>`).join("");

    const educationHTML = candidate.education.map(e => `
      <div class="entry">
        <div class="entry-head">
          <div><strong>${esc(e.degree)}${e.field ? ` — ${esc(e.field)}` : ""}</strong><span class="entry-sub"> · ${esc(e.institution)}</span></div>
          <span class="entry-date">${dates(e.startDate, e.endDate, e.current)}</span>
        </div>
      </div>`).join("");

    // ── Skills autodeclaradas: texto compacto por rama ───────────────────
    const MAX_PER_BRANCH = 30;
    const declaredHTML = CATEGORY_ORDER
      .map(cat => {
        const items = sortByCatalog(candidate.skills[cat] ?? []);
        if (items.length === 0) return "";
        const shown = items.slice(0, MAX_PER_BRANCH).map(esc).join(", ");
        const extra = items.length > MAX_PER_BRANCH ? ` <em class="more">+${items.length - MAX_PER_BRANCH} más</em>` : "";
        return `
          <div class="drow">
            <span class="dlabel">${CATEGORY_LABELS[cat]} <b>${items.length}</b></span>
            <p class="dtext">${shown}${extra}</p>
          </div>`;
      })
      .join("");

    // ── Otras certificaciones / proyectos ────────────────────────────────
    const certsHTML = candidate.certifications.map(c => `
      <div class="entry entry--tight">
        <div class="entry-head">
          <div><strong>${esc(c.name)}</strong><span class="entry-sub"> · ${esc(c.issuer)}</span>
            ${c.credentialId ? `<span class="entry-sub"> · ID ${esc(c.credentialId)}</span>` : ""}</div>
          <span class="entry-date">${esc(c.date)}</span>
        </div>
      </div>`).join("");

    const projectsHTML = candidate.projects.map(proj => `
      <div class="entry entry--tight">
        <div class="entry-head">
          <div><strong>${esc(proj.name)}</strong>
            ${proj.technologies.length ? `<span class="entry-sub"> · ${proj.technologies.map(esc).join(", ")}</span>` : ""}</div>
          <span class="entry-date">${[safeUrl(proj.url) && "DEMO", safeUrl(proj.repoUrl) && "REPO"].filter(Boolean).join(" · ")}</span>
        </div>
        ${proj.description ? `<p class="entry-text">${esc(proj.description)}</p>` : ""}
      </div>`).join("");

    // ── Idiomas + disponibilidad en una sola franja ──────────────────────
    const wp = candidate.workPreferences ?? ({} as WorkPreferences);
    const salary = (wp.salaryMin || wp.salaryMax)
      ? `${esc(wp.currency ?? "USD")} ${wp.salaryMin?.toLocaleString("es-AR") ?? ""}${wp.salaryMin && wp.salaryMax ? " — " : ""}${wp.salaryMax?.toLocaleString("es-AR") ?? ""}`
      : "";
    const factsHTML = `
      <div class="facts">
        ${candidate.languages.length ? `<div class="fact"><span class="fact-label">IDIOMAS</span><span>${candidate.languages.map(l => `${esc(l.language)} <i>(${esc(l.level)})</i>`).join(" · ")}</span></div>` : ""}
        ${candidate.availability ? `<div class="fact"><span class="fact-label">DISPONIBILIDAD</span><span>${esc(candidate.availability)}</span></div>` : ""}
        ${wp.modality?.length ? `<div class="fact"><span class="fact-label">MODALIDAD</span><span>${wp.modality.map(esc).join(" · ")}</span></div>` : ""}
        ${wp.contractType?.length ? `<div class="fact"><span class="fact-label">CONTRATACIÓN</span><span>${wp.contractType.map(esc).join(" · ")}</span></div>` : ""}
        ${salary ? `<div class="fact"><span class="fact-label">PRETENSIÓN</span><span>${salary}</span></div>` : ""}
      </div>`;

    const contacts = [p.email, p.phone, p.location, p.linkedin, p.github, p.portfolio]
      .filter(Boolean).map(esc).join("<i>|</i>");

    const generated = new Date().toLocaleDateString("es-AR", { day: "2-digit", month: "2-digit", year: "numeric" });

    const html = `<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8"/><title>${esc(filename)}</title>
      <link href="https://fonts.googleapis.com/css2?family=Montserrat:wght@500;600;700;800;900&family=JetBrains+Mono:wght@600;700;800&display=swap" rel="stylesheet"/>
      <style>
        *{margin:0;padding:0;box-sizing:border-box;}
        body{background:#fff;color:#111;font-family:'Montserrat',sans-serif;font-size:11px;line-height:1.55;}
        @page{size:A4;margin:14mm 14mm 16mm;}
        @media print{body{-webkit-print-color-adjust:exact;print-color-adjust:exact;}.no-print{display:none!important;}}
        .page{max-width:780px;margin:0 auto;padding:28px 24px 60px;}
        .mono{font-family:'JetBrains Mono',monospace;}

        header{display:flex;justify-content:space-between;gap:20px;align-items:flex-start;padding-bottom:14px;border-bottom:3px solid #000;margin-bottom:16px;}
        h1{font-size:28px;font-weight:900;letter-spacing:-1px;text-transform:uppercase;line-height:1;}
        .headline{font-size:12px;font-weight:700;color:#444;margin-top:6px;}
        .contacts{font-size:9.5px;font-weight:600;color:#555;margin-top:8px;line-height:1.7;}
        .contacts i{margin:0 7px;color:#bbb;font-style:normal;}
        .photo{width:74px;height:74px;object-fit:cover;border:2px solid #000;flex-shrink:0;}

        .validated{border:2px solid #000;padding:12px 14px;margin-bottom:18px;page-break-inside:avoid;}
        .validated-head{display:flex;justify-content:space-between;align-items:baseline;gap:10px;flex-wrap:wrap;margin-bottom:8px;}
        .validated-title{font-family:'JetBrains Mono',monospace;font-size:10px;font-weight:800;letter-spacing:2px;}
        .validated-sub{font-size:8.5px;font-weight:600;color:#777;}
        .vrow{display:flex;gap:12px;align-items:flex-start;padding:7px 0;border-top:1px solid #e5e5e5;}
        .vtag{font-family:'JetBrains Mono',monospace;font-size:8px;font-weight:800;letter-spacing:1px;padding:3px 7px;white-space:nowrap;min-width:96px;text-align:center;}
        .vtag--cert{background:#000;color:#fff;}
        .vtag--course{border:1.5px solid #000;color:#000;}
        .vrow strong{font-size:12px;font-weight:900;text-transform:uppercase;}
        .vdesc{font-size:9.5px;font-weight:600;color:#666;margin-left:8px;}
        .vareas{font-size:9px;font-weight:600;color:#555;margin-top:3px;}

        .sec{margin-bottom:16px;}
        .sec-head{display:flex;align-items:center;gap:10px;margin-bottom:8px;page-break-after:avoid;}
        .sec-head h2{font-family:'JetBrains Mono',monospace;font-size:9.5px;font-weight:800;letter-spacing:2.5px;white-space:nowrap;}
        .rule{flex:1;height:1.5px;background:#000;}
        .sec-note{font-size:8.5px;font-weight:600;color:#888;margin:-3px 0 8px;}

        .summary{font-size:11px;font-weight:500;color:#222;}
        .entry{margin-bottom:10px;page-break-inside:avoid;}
        .entry--tight{margin-bottom:6px;}
        .entry-head{display:flex;justify-content:space-between;gap:12px;align-items:baseline;}
        .entry-head strong{font-size:11.5px;font-weight:900;text-transform:uppercase;}
        .entry-sub{font-size:10px;font-weight:600;color:#555;}
        .entry-date{font-family:'JetBrains Mono',monospace;font-size:8.5px;font-weight:700;color:#777;white-space:nowrap;}
        .entry-text{font-size:10px;font-weight:500;color:#333;margin-top:3px;white-space:pre-line;}

        .drow{display:grid;grid-template-columns:120px 1fr;gap:12px;padding:6px 0;border-top:1px solid #eee;page-break-inside:avoid;}
        .drow:first-of-type{border-top:none;}
        .dlabel{font-family:'JetBrains Mono',monospace;font-size:8.5px;font-weight:800;letter-spacing:1px;text-transform:uppercase;}
        .dlabel b{color:#888;margin-left:4px;}
        .dtext{font-size:10px;font-weight:600;color:#333;}
        .more{font-style:normal;color:#888;font-weight:700;}

        .facts{display:grid;grid-template-columns:1fr 1fr;gap:8px 20px;page-break-inside:avoid;}
        .fact{display:flex;flex-direction:column;gap:1px;font-size:10.5px;font-weight:700;}
        .fact i{font-style:normal;color:#777;font-weight:600;}
        .fact-label{font-family:'JetBrains Mono',monospace;font-size:8px;font-weight:800;letter-spacing:1.5px;color:#888;}

        footer{margin-top:22px;padding-top:8px;border-top:1px solid #ddd;font-family:'JetBrains Mono',monospace;font-size:8px;color:#999;letter-spacing:1px;}
      </style>
    </head><body><div class="page">
      <header>
        <div>
          <h1>${esc(p.firstName)} ${esc(p.lastName)}</h1>
          ${p.headline ? `<p class="headline">${esc(p.headline)}</p>` : ""}
          ${contacts ? `<p class="contacts">${contacts}</p>` : ""}
        </div>
        ${safeUrl(p.photo) ? `<img class="photo" src="${safeUrl(p.photo)}" alt=""/>` : ""}
      </header>

      ${validatedHTML}
      ${p.summary ? section("PERFIL", `<p class="summary">${esc(p.summary)}</p>`) : ""}
      ${section("EXPERIENCIA", experienceHTML)}
      ${section("EDUCACIÓN", educationHTML)}
      ${section("SKILLS AUTODECLARADAS", declaredHTML, "Cargadas por el candidato en su CV. No verificadas por Hidden Security.")}
      ${section("OTRAS CERTIFICACIONES (DECLARADAS)", certsHTML)}
      ${section("PROYECTOS", projectsHTML)}
      ${section("IDIOMAS Y PREFERENCIAS", factsHTML.replace(/\s/g, "") === '<divclass="facts"></div>' ? "" : factsHTML)}

      <footer>CV GENERADO DESDE HIDDEN SECURITY · ${generated}</footer>
    </div>
    <div class="no-print" style="position:fixed;bottom:24px;right:24px;">
      <button onclick="window.print()" style="background:#000;border:none;color:#fff;font-family:'Montserrat',sans-serif;font-size:11px;font-weight:900;letter-spacing:2px;text-transform:uppercase;padding:14px 28px;cursor:pointer;">↓ GUARDAR PDF</button>
    </div></body></html>`;

    const win = window.open("", "_blank");
    if (!win) return;
    win.document.write(html);
    win.document.close();
  };

  // -- Guard: sin plan Business/Enterprise vigente, no se renderiza nada de
  // la base de candidatos ni se disparan los fetches --------------------
  if (!enterpriseActive) {
    return <EnterpriseBlockedScreen isLight={isLight} isEnterprise={isEnterprise} />;
  }

  return (
    <div className={`udb-wrap${isLight ? " light" : ""}`}>

      {/* Header */}
      <div className="udb-header">
        <span className="udb-eyebrow">// BASE_DE_CANDIDATOS</span>
        <h1 className="udb-title">
          BÚSQUEDA DE <span className="udb-accent">TALENTO</span>
        </h1>
        <p className="udb-subtitle">
          Explorá los perfiles de los candidatos. Tocá una fila para ver el detalle y descargar su CV.
        </p>

        {/* Referencia de colores */}
        <div className="udb-legend">
          <span className="udb-legend-item">
            <span className="udb-skill-chip udb-skill-chip--certified udb-skill-chip--sm">✓ Dorado</span>
            Certificado por examen de Hidden
          </span>
          <span className="udb-legend-item">
            <span className="udb-skill-chip udb-skill-chip--course udb-skill-chip--sm">Celeste</span>
            Validado al completar un curso de Hidden
          </span>
          <span className="udb-legend-item">
            <span className="udb-skill-chip udb-skill-chip--sm">Gris</span>
            Autodeclarado por el candidato en su CV
          </span>
        </div>
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