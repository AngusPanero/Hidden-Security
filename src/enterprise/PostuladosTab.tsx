import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import axios from "axios";
import { Link } from "react-router-dom";
import { UseSession } from "../contexts/SessionContext";
import { UseTheme } from "../contexts/ThemeContext";
import { HS_SKILLS } from "../skills/Skills";
import "./postuladosTab.css";
import {
  fetchVacancyMatches, ScoreBadge, MatchBreakdown, RequestedSkills, SuggestedTalent,
  type MatchCandidate, type MatchesData,
} from "./VacancyMatches";

// ─── Types ────────────────────────────────────────────────────────────────────
interface Applicant {
  userId:          string;
  status:          string;
  appliedAt:       string;
  applicantName?:  string;
  applicantEmail?: string;
  applicantPhone?: string;
}

// Compatibilidad por vacante: se pide al abrirla y queda en memoria
type MatchState = { status: "loading" } | { status: "error" } | { status: "ok"; data: MatchesData };

interface VacancySummary {
  _id:        string;
  title:      string;
  applicants: Applicant[];
  status:     string;
}

// ─── Constantes ───────────────────────────────────────────────────────────────
const APPLICANT_STATUS_LABELS: Record<string, { label: string; color: string }> = {
  pending:    { label: "Pendiente",          color: "#94a3b8" },
  cv_read:    { label: "CV Leído",           color: "#38bdf8" },
  filter_1:   { label: "Filtro 1 ✓",        color: "#a78bfa" },
  filter_2:   { label: "Filtro 2 ✓",        color: "#818cf8" },
  filter_3:   { label: "Filtro 3 ✓",        color: "#6366f1" },
  contact:    { label: "Te contactaremos",   color: "#22c55e" },
  rejected:   { label: "No seleccionado",    color: "#f43f5e" },
};

// ─── Helpers del CV ───────────────────────────────────────────────────────────
// Escapa texto del postulante antes de meterlo en el HTML del PDF.
// La ventana del PDF comparte origen con la app, así que un <script> en la
// descripción de un CV se ejecutaría con la sesión de la empresa.
const esc = (v: unknown): string =>
  String(v ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

// Solo URLs http(s) o imágenes en base64 para la foto
const safeImgSrc = (u: unknown): string =>
  typeof u === "string" && /^(https?:\/\/|data:image\/)/i.test(u) ? esc(u) : "";

// ─── Catálogo de skills (mismo árbol que el CV Builder) ───────────────────────
type SkillCategory = "roles" | "habilidades" | "herramientas";

const CATEGORY_ORDER: SkillCategory[] = ["roles", "habilidades", "herramientas"];

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

// Skills del CV: formato nuevo { roles, habilidades, herramientas } o array
// viejo (lo que no se reconoce cae en herramientas, igual que en el CV Builder)
function normalizeCvSkills(raw: any): Record<SkillCategory, string[]> {
  if (Array.isArray(raw)) return { roles: [], habilidades: [], herramientas: raw };
  return {
    roles:        Array.isArray(raw?.roles)        ? raw.roles        : [],
    habilidades:  Array.isArray(raw?.habilidades)  ? raw.habilidades  : [],
    herramientas: Array.isArray(raw?.herramientas) ? raw.herramientas : [],
  };
}

// Ubica una skill en el catálogo: rama y subgrupo (lo que no está, "Otros")
const BRANCH_INDEX = CATEGORY_ORDER.map(branch => {
  const groupMap: Record<string, string> = {};
  for (const [group, items] of Object.entries(CATEGORY_CATALOGS[branch])) {
    for (const item of items) groupMap[item] = group;
  }
  return { branch, groupMap, groupOrder: Object.keys(CATEGORY_CATALOGS[branch]) };
});

function locateSkill(skill: string): { branch: SkillCategory | "otros"; branchIdx: number; group: string; groupIdx: number } {
  for (let i = 0; i < BRANCH_INDEX.length; i++) {
    const b = BRANCH_INDEX[i];
    const group = b.groupMap[skill];
    if (group) return { branch: b.branch, branchIdx: i, group, groupIdx: b.groupOrder.indexOf(group) };
  }
  return { branch: "otros", branchIdx: 99, group: "Otros", groupIdx: 0 };
}

function sortByCatalog(skills: string[]): string[] {
  return [...skills].sort((a, b) => {
    const la = locateSkill(a), lb = locateSkill(b);
    if (la.branchIdx !== lb.branchIdx) return la.branchIdx - lb.branchIdx;
    if (la.groupIdx  !== lb.groupIdx)  return la.groupIdx  - lb.groupIdx;
    return a.localeCompare(b);
  });
}

// Bloques contiguos rama/subgrupo para mostrar cada título una sola vez
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

// ─── Validaciones de Hidden ───────────────────────────────────────────────────
// Las agrega el backend al CV (no viven en el documento CV):
// - skillsCertifiedByHidden: examen controlado
// - modernSocSkills (y futuros cursos): skills validadas al completar un curso
const strArr = (v: unknown): string[] =>
  Array.isArray(v) ? v.filter((s): s is string => typeof s === "string") : [];

// Un registro por curso. Cuando se suba otro curso, se agrega su entrada
// con el campo que trae el backend.
const HIDDEN_COURSES: { id: string; title: string; getSkills: (cv: any) => string[] }[] = [
  { id: "modern-soc", title: "Modern SOC Operations", getSkills: cv => strArr(cv?.modernSocSkills) },
];

function getValidations(cv: any) {
  const certified = strArr(cv?.skillsCertifiedByHidden);
  const courses   = HIDDEN_COURSES
    .map(c => ({ id: c.id, title: c.title, skills: c.getSkills(cv) }))
    .filter(c => c.skills.length > 0);
  const courseSkills = new Set(courses.flatMap(c => c.skills));
  return { certified, courses, courseSkills };
}

// Preferencia "ocultar no seleccionados" — persiste en este navegador
const HIDE_REJECTED_KEY = "hs_pp_hide_rejected";

const readHideRejected = () => {
  try { return localStorage.getItem(HIDE_REJECTED_KEY) === "1"; } catch { return false; }
};

const DECLARED_PAGE_SIZE = 20;
const COURSE_PAGE_SIZE   = 24;

// ─── Chip de skill dentro del CV ──────────────────────────────────────────────
function CvChip({ label, kind }: { label: string; kind: "plain" | "cert" | "course" }) {
  return <span className={`pp-chip pp-chip--${kind}`}>{kind === "cert" ? "✓ " : ""}{label}</span>;
}

// ─── Curso validado: botón con el nombre → árbol de skills paginado ──────────
function ValidatedCourse({ title, skills }: { title: string; skills: string[] }) {
  const [open, setOpen] = useState(false);
  const [page, setPage] = useState(0);

  const sorted     = sortByCatalog(skills);
  const totalPages = Math.max(1, Math.ceil(sorted.length / COURSE_PAGE_SIZE));
  const segments   = segmentByGroup(sorted.slice(page * COURSE_PAGE_SIZE, (page + 1) * COURSE_PAGE_SIZE));

  const branchCounts = CATEGORY_ORDER
    .map(cat => ({ cat, n: skills.filter(s => locateSkill(s).branch === cat).length }))
    .filter(x => x.n > 0);

  let lastBranch = "";

  return (
    <div className={`pp-course${open ? " open" : ""}`}>
      <button type="button" className="pp-course-head" onClick={() => setOpen(o => !o)} aria-expanded={open}>
        <span className="pp-course-info">
          <span className="pp-course-kicker">Curso completado en Hidden Security</span>
          <span className="pp-course-title">{title}</span>
          <span className="pp-course-meta">
            {skills.length} skills validadas
            {branchCounts.length > 0 && " · " + branchCounts.map(b => `${b.n} ${CATEGORY_LABELS[b.cat].toLowerCase()}`).join(" · ")}
          </span>
        </span>
        <span className="pp-toggle">{open ? "Ocultar" : "Ver skills"}<span className="pp-chevron" aria-hidden="true" /></span>
      </button>

      {open && (
        <div className="pp-course-body">
          <p className="pp-note">Skills que el postulante demostró al completar el curso y aprobar sus evaluaciones.</p>

          {segments.map((seg, i) => {
            const showBranch = seg.branchLabel !== lastBranch;
            lastBranch = seg.branchLabel;
            return (
              <div key={`${seg.branchLabel}-${seg.group}-${i}`} className="pp-seg">
                {showBranch && <span className="pp-branch">{seg.branchLabel}</span>}
                <span className="pp-subgroup">{seg.group}</span>
                <div className="pp-chips">
                  {seg.skills.map(s => <CvChip key={s} label={s} kind="course" />)}
                </div>
              </div>
            );
          })}

          {totalPages > 1 && (
            <div className="pp-pager">
              <button type="button" className="pp-btn pp-btn--sm" disabled={page === 0} onClick={() => setPage(p => p - 1)}>← Anterior</button>
              <span className="pp-pager-info">{page + 1} / {totalPages}</span>
              <button type="button" className="pp-btn pp-btn--sm" disabled={page >= totalPages - 1} onClick={() => setPage(p => p + 1)}>Siguiente →</button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Rama de skills autodeclaradas (acordeón) ─────────────────────────────────
function DeclaredBranch({
  category, items, certified, courseSkills,
}: {
  category: SkillCategory;
  items: string[];
  certified: string[];
  courseSkills: Set<string>;
}) {
  const [open,    setOpen]    = useState(false);
  const [visible, setVisible] = useState(DECLARED_PAGE_SIZE);

  const sorted    = sortByCatalog(items);
  const remaining = sorted.length - visible;
  const segments  = segmentByGroup(sorted.slice(0, visible));

  return (
    <div className={`pp-declared${open ? " open" : ""}`}>
      <button type="button" className="pp-declared-head" onClick={() => setOpen(o => !o)} aria-expanded={open}>
        <span className="pp-declared-title">{CATEGORY_LABELS[category]}</span>
        <span className="pp-declared-count">{items.length}</span>
        <span className="pp-toggle">{open ? "Ocultar" : "Ver"}<span className="pp-chevron" aria-hidden="true" /></span>
      </button>

      {open && (
        <div className="pp-declared-body">
          {segments.map((seg, i) => (
            <div key={`${seg.group}-${i}`} className="pp-seg">
              <span className="pp-subgroup">{seg.group}</span>
              <div className="pp-chips">
                {seg.skills.map(s => (
                  <CvChip
                    key={s}
                    label={s}
                    kind={certified.includes(s) ? "cert" : courseSkills.has(s) ? "course" : "plain"}
                  />
                ))}
              </div>
            </div>
          ))}
          {remaining > 0 && (
            <button type="button" className="pp-btn pp-btn--sm pp-more" onClick={() => setVisible(v => v + DECLARED_PAGE_SIZE)}>
              Ver {Math.min(DECLARED_PAGE_SIZE, remaining)} más ({remaining} restantes)
            </button>
          )}
        </div>
      )}
    </div>
  );
}

// ─── PDF del CV ───────────────────────────────────────────────────────────────
// Formato corto: primero lo validado por Hidden (resumido), después el CV y al
// final las skills autodeclaradas como texto compacto. Solo Montserrat.
function buildCvHtml(cv: any, name: string): string {
  const p        = cv.personalInfo ?? {};
  const filename = `CV_${name.replace(/\s+/g, "_")}`;
  const { certified, courses } = getValidations(cv);
  const declaredByCat = normalizeCvSkills(cv.skills);

  const dates = (start: string, end: string, current: boolean) =>
    esc(`${start ?? ""}${start ? " — " : ""}${current ? "Actualidad" : (end ?? "")}`);

  const section = (title: string, content: string, note = "") => !content.trim() ? "" : `
    <section class="sec">
      <div class="sec-head"><h2>${title}</h2><span class="rule"></span></div>
      ${note ? `<p class="sec-note">${note}</p>` : ""}
      ${content}
    </section>`;

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

  const validatedHTML = (certified.length || courses.length) ? `
    <div class="validated">
      <div class="validated-head">
        <span class="validated-title">VALIDADO POR HIDDEN SECURITY</span>
        <span class="validated-sub">Comprobado por la plataforma, no declarado por el postulante</span>
      </div>
      ${certified.map(c => `
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

  const experienceHTML = (cv.experience ?? []).map((e: any) => `
    <div class="entry">
      <div class="entry-head">
        <div><strong>${esc(e.position)}</strong><span class="entry-sub"> · ${esc(e.company)}${e.location ? `, ${esc(e.location)}` : ""}</span></div>
        <span class="entry-date">${dates(e.startDate, e.endDate, e.current)}</span>
      </div>
      ${e.description ? `<p class="entry-text">${esc(e.description)}</p>` : ""}
    </div>`).join("");

  const educationHTML = (cv.education ?? []).map((e: any) => `
    <div class="entry">
      <div class="entry-head">
        <div><strong>${esc(e.degree)}${e.field ? ` — ${esc(e.field)}` : ""}</strong><span class="entry-sub"> · ${esc(e.institution)}</span></div>
        <span class="entry-date">${dates(e.startDate, e.endDate, e.current)}</span>
      </div>
    </div>`).join("");

  const MAX_PER_BRANCH = 30;
  const declaredHTML = CATEGORY_ORDER.map(cat => {
    const items = sortByCatalog(declaredByCat[cat]);
    if (items.length === 0) return "";
    const shown = items.slice(0, MAX_PER_BRANCH).map(esc).join(", ");
    const extra = items.length > MAX_PER_BRANCH ? ` <span class="more">+${items.length - MAX_PER_BRANCH} más</span>` : "";
    return `
      <div class="drow">
        <span class="dlabel">${CATEGORY_LABELS[cat]} <b>${items.length}</b></span>
        <p class="dtext">${shown}${extra}</p>
      </div>`;
  }).join("");

  const certsHTML = (cv.certifications ?? []).map((c: any) => `
    <div class="entry entry--tight">
      <div class="entry-head">
        <div><strong>${esc(c.name)}</strong><span class="entry-sub"> · ${esc(c.issuer)}</span>
          ${c.credentialId ? `<span class="entry-sub"> · ID ${esc(c.credentialId)}</span>` : ""}</div>
        <span class="entry-date">${esc(c.date)}</span>
      </div>
    </div>`).join("");

  const projectsHTML = (cv.projects ?? []).map((proj: any) => `
    <div class="entry entry--tight">
      <div class="entry-head">
        <div><strong>${esc(proj.name)}</strong>
          ${(proj.technologies ?? []).length ? `<span class="entry-sub"> · ${proj.technologies.map(esc).join(", ")}</span>` : ""}</div>
        <span class="entry-date">${[proj.url && "DEMO", proj.repoUrl && "REPO"].filter(Boolean).join(" · ")}</span>
      </div>
      ${proj.description ? `<p class="entry-text">${esc(proj.description)}</p>` : ""}
    </div>`).join("");

  const wp = cv.workPreferences ?? {};
  const salary = (wp.salaryMin || wp.salaryMax)
    ? `${esc(wp.currency ?? "USD")} ${wp.salaryMin?.toLocaleString("es-AR") ?? ""}${wp.salaryMin && wp.salaryMax ? " — " : ""}${wp.salaryMax?.toLocaleString("es-AR") ?? ""}`
    : "";
  const facts = [
    (cv.languages ?? []).length ? `<div class="fact"><span class="fact-label">IDIOMAS</span><span>${cv.languages.map((l: any) => `${esc(l.language)} <i>(${esc(l.level)})</i>`).join(" · ")}</span></div>` : "",
    cv.availability ? `<div class="fact"><span class="fact-label">DISPONIBILIDAD</span><span>${esc(cv.availability)}</span></div>` : "",
    wp.modality?.length ? `<div class="fact"><span class="fact-label">MODALIDAD</span><span>${wp.modality.map(esc).join(" · ")}</span></div>` : "",
    wp.contractType?.length ? `<div class="fact"><span class="fact-label">CONTRATACIÓN</span><span>${wp.contractType.map(esc).join(" · ")}</span></div>` : "",
    salary ? `<div class="fact"><span class="fact-label">PRETENSIÓN</span><span>${salary}</span></div>` : "",
  ].join("");

  const contacts = [p.email, p.phone, p.location, p.linkedin, p.github, p.portfolio]
    .filter(Boolean).map(esc).join("<i>|</i>");
  const photo     = safeImgSrc(p.photo);
  const generated = new Date().toLocaleDateString("es-AR", { day: "2-digit", month: "2-digit", year: "numeric" });

  return `<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8"/><title>${esc(filename)}</title>
    <link href="https://fonts.googleapis.com/css2?family=Montserrat:wght@500;600;700;800;900&display=swap" rel="stylesheet"/>
    <style>
      *{margin:0;padding:0;box-sizing:border-box;}
      body{background:#fff;color:#111;font-family:'Montserrat',Arial,sans-serif;font-size:11px;line-height:1.55;}
      @page{size:A4;margin:14mm 14mm 16mm;}
      @media print{body{-webkit-print-color-adjust:exact;print-color-adjust:exact;}.no-print{display:none!important;}}
      .page{max-width:780px;margin:0 auto;padding:28px 24px 60px;}

      header{display:flex;justify-content:space-between;gap:20px;align-items:flex-start;padding-bottom:14px;border-bottom:3px solid #000;margin-bottom:16px;}
      h1{font-size:28px;font-weight:900;letter-spacing:-1px;text-transform:uppercase;line-height:1;}
      .headline{font-size:12px;font-weight:700;color:#444;margin-top:6px;}
      .contacts{font-size:9.5px;font-weight:600;color:#555;margin-top:8px;line-height:1.7;}
      .contacts i{margin:0 7px;color:#bbb;font-style:normal;}
      .photo{width:74px;height:74px;object-fit:cover;border:2px solid #000;flex-shrink:0;}

      .validated{border:2px solid #000;padding:12px 14px;margin-bottom:18px;page-break-inside:avoid;}
      .validated-head{display:flex;justify-content:space-between;align-items:baseline;gap:10px;flex-wrap:wrap;margin-bottom:8px;}
      .validated-title{font-size:10px;font-weight:900;letter-spacing:2px;}
      .validated-sub{font-size:8.5px;font-weight:600;color:#777;}
      .vrow{display:flex;gap:12px;align-items:flex-start;padding:7px 0;border-top:1px solid #e5e5e5;}
      .vtag{font-size:8px;font-weight:900;letter-spacing:1px;padding:3px 7px;white-space:nowrap;min-width:96px;text-align:center;}
      .vtag--cert{background:#000;color:#fff;}
      .vtag--course{border:1.5px solid #000;color:#000;}
      .vrow strong{font-size:12px;font-weight:900;text-transform:uppercase;}
      .vdesc{font-size:9.5px;font-weight:600;color:#666;margin-left:8px;}
      .vareas{font-size:9px;font-weight:600;color:#555;margin-top:3px;}

      .sec{margin-bottom:16px;}
      .sec-head{display:flex;align-items:center;gap:10px;margin-bottom:8px;page-break-after:avoid;}
      .sec-head h2{font-size:9.5px;font-weight:900;letter-spacing:2.5px;white-space:nowrap;}
      .rule{flex:1;height:1.5px;background:#000;}
      .sec-note{font-size:8.5px;font-weight:600;color:#888;margin:-3px 0 8px;}

      .summary{font-size:11px;font-weight:500;color:#222;white-space:pre-line;}
      .entry{margin-bottom:10px;page-break-inside:avoid;}
      .entry--tight{margin-bottom:6px;}
      .entry-head{display:flex;justify-content:space-between;gap:12px;align-items:baseline;}
      .entry-head strong{font-size:11.5px;font-weight:900;text-transform:uppercase;}
      .entry-sub{font-size:10px;font-weight:600;color:#555;}
      .entry-date{font-size:8.5px;font-weight:700;color:#777;white-space:nowrap;letter-spacing:0.5px;}
      .entry-text{font-size:10px;font-weight:500;color:#333;margin-top:3px;white-space:pre-line;}

      .drow{display:grid;grid-template-columns:120px 1fr;gap:12px;padding:6px 0;border-top:1px solid #eee;page-break-inside:avoid;}
      .drow:first-of-type{border-top:none;}
      .dlabel{font-size:8.5px;font-weight:900;letter-spacing:1px;text-transform:uppercase;}
      .dlabel b{color:#888;margin-left:4px;}
      .dtext{font-size:10px;font-weight:600;color:#333;}
      .more{color:#888;font-weight:700;}

      .facts{display:grid;grid-template-columns:1fr 1fr;gap:8px 20px;page-break-inside:avoid;}
      .fact{display:flex;flex-direction:column;gap:1px;font-size:10.5px;font-weight:700;}
      .fact i{font-style:normal;color:#777;font-weight:600;}
      .fact-label{font-size:8px;font-weight:900;letter-spacing:1.5px;color:#888;}

      footer{margin-top:22px;padding-top:8px;border-top:1px solid #ddd;font-size:8px;font-weight:700;color:#999;letter-spacing:1px;}
    </style>
  </head><body><div class="page">
    <header>
      <div>
        <h1>${esc(p.firstName)} ${esc(p.lastName)}</h1>
        ${p.headline ? `<p class="headline">${esc(p.headline)}</p>` : ""}
        ${contacts ? `<p class="contacts">${contacts}</p>` : ""}
      </div>
      ${photo ? `<img class="photo" src="${photo}" alt=""/>` : ""}
    </header>

    ${validatedHTML}
    ${p.summary ? section("PERFIL", `<p class="summary">${esc(p.summary)}</p>`) : ""}
    ${section("EXPERIENCIA", experienceHTML)}
    ${section("EDUCACIÓN", educationHTML)}
    ${section("SKILLS AUTODECLARADAS", declaredHTML, "Cargadas por el postulante en su CV. No verificadas por Hidden Security.")}
    ${section("OTRAS CERTIFICACIONES (DECLARADAS)", certsHTML)}
    ${section("PROYECTOS", projectsHTML)}
    ${facts ? section("IDIOMAS Y PREFERENCIAS", `<div class="facts">${facts}</div>`) : ""}

    <footer>CV GENERADO DESDE HIDDEN SECURITY · ${generated}</footer>
  </div>
  <div class="no-print" style="position:fixed;bottom:24px;right:24px;">
    <button onclick="window.print()" style="background:#000;border:none;color:#fff;font-family:'Montserrat',Arial,sans-serif;font-size:11px;font-weight:900;letter-spacing:2px;text-transform:uppercase;padding:14px 28px;cursor:pointer;">↓ GUARDAR PDF</button>
  </div></body></html>`;
}

// Mensaje simple dentro de la ventana del PDF (cargando / error)
const windowMessage = (msg: string) =>
  `<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8"/><title>CV</title></head>` +
  `<body style="font-family:Montserrat,Arial,sans-serif;padding:32px;color:#333;">${esc(msg)}</body></html>`;

// ─── Bloque sin plan activo (misma estética que VacancyManager / UsersDatabase) ──
function PostuladosNoPlanBlock({ planExpired }: { planExpired: boolean }) {
  return (
    <div className="pp-blocked">
      <span className="pp-blocked-mark" aria-hidden="true"></span>
      <span className="pp-eyebrow">Sin plan activo</span>
      <h2 className="pp-blocked-title">
        Solo para cuentas <span className="pp-accent">Business / Enterprise</span>
      </h2>
      <p className="pp-blocked-text">
        Necesitás un plan de empresa activo para ver y gestionar postulantes.
        {planExpired && " Tu plan venció — renovalo para volver a gestionar postulantes."}
      </p>
      <Link to="/pricing?tipo=empresas" className="pp-blocked-cta">
        {planExpired ? "Renovar plan" : "Ver planes corporativos"}
      </Link>
    </div>
  );
}

// ─── Sheet: bottom sheet en mobile, modal centrado en desktop ─────────────────
// Se cierra deslizando la cabecera hacia abajo, tocando el fondo, con la ✕ o
// con Escape. El arrastre solo funciona desde la cabecera: scrollear el CV
// nunca lo cierra sin querer.
const DISMISS_DISTANCE = 110;

function Sheet({ onClose, labelId, header, footer, children }: {
  onClose: () => void;
  labelId: string;
  header: ReactNode;
  footer?: ReactNode;
  children: ReactNode;
}) {
  const startY = useRef<number | null>(null);
  const [dragY, setDragY] = useState(0);

  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
    };
  }, [onClose]);

  const onTouchStart = (e: React.TouchEvent) => { startY.current = e.touches[0].clientY; };
  const onTouchMove  = (e: React.TouchEvent) => {
    if (startY.current === null) return;
    setDragY(Math.max(0, e.touches[0].clientY - startY.current));
  };
  const onTouchEnd   = () => {
    if (startY.current === null) return;
    startY.current = null;
    if (dragY > DISMISS_DISTANCE) onClose();
    else setDragY(0);
  };

  return (
    <div className="pp-sheet-root" onClick={onClose}>
      <div
        className="pp-sheet"
        role="dialog"
        aria-modal="true"
        aria-labelledby={labelId}
        onClick={(e) => e.stopPropagation()}
        style={dragY ? { transform: `translateY(${dragY}px)`, transition: "none" } : undefined}
      >
        <div className="pp-sheet-drag" onTouchStart={onTouchStart} onTouchMove={onTouchMove} onTouchEnd={onTouchEnd}>
          <span className="pp-sheet-handle" aria-hidden="true" />
          <div className="pp-sheet-header">
            <div className="pp-sheet-heading">{header}</div>
            <button type="button" className="pp-sheet-close" onClick={onClose} aria-label="Cerrar">✕</button>
          </div>
        </div>
        <div className="pp-sheet-body">{children}</div>
        {footer && <div className="pp-sheet-footer">{footer}</div>}
      </div>
    </div>
  );
}

const fmtDate = (iso: string) =>
  new Date(iso).toLocaleDateString("es-AR", { day: "2-digit", month: "short", year: "numeric" });

const initials = (name: string) =>
  name.split(/\s+/).filter(Boolean).slice(0, 2).map(w => w.charAt(0).toUpperCase()).join("") || "?";

// ─── Tab: Postulados ──────────────────────────────────────────────────────────
export default function PostuladosTab() {
  const { user }  = UseSession();
  const { theme } = UseTheme();

  // ── Plan B2B activo — mismo criterio que VacancyManager ──────
  const enterprisePlan   = (user as any)?.enterprisePlan       ?? null;
  const planExpiryStr    = (user as any)?.enterprisePlanExpiry ?? null;
  const hasActivePlan    = !!enterprisePlan && !!planExpiryStr && new Date(planExpiryStr) > new Date();
  // Tuvo un plan que ya venció (para mostrar "Renovar plan" en vez de "Ver planes")
  const planExpired      = !hasActivePlan && !!enterprisePlan && !!planExpiryStr;

  const [vacancies,      setVacancies]      = useState<VacancySummary[]>([]);
  const [loading,        setLoading]        = useState(true);
  const [expanded,       setExpanded]       = useState<string | null>(null);
  const [updatingStatus, setUpdatingStatus] = useState<string | null>(null);
  const [deletingId,     setDeletingId]     = useState<string | null>(null);
  const [cvModal,        setCvModal]        = useState<{ userId: string; name: string } | null>(null);
  const [cvData,         setCvData]         = useState<any | null>(null);
  const [loadingCv,      setLoadingCv]      = useState(false);

  // Filtros globales
  const [filterStatus,   setFilterStatus]   = useState(""); // "" = todos
  const [filterSearch,   setFilterSearch]   = useState(""); // nombre / email
  // Ocultar postulados en estado "No seleccionado" (guardado en localStorage)
  const [hideRejected,   setHideRejected]   = useState<boolean>(readHideRejected);

  const toggleHideRejected = () => {
    setHideRejected(prev => {
      const next = !prev;
      try { localStorage.setItem(HIDE_REJECTED_KEY, next ? "1" : "0"); } catch { /* modo privado */ }
      return next;
    });
  };

  // Compatibilidad: { vacancyId: estado } · orden de postulados dentro de la vacante
  const [matches,        setMatches]        = useState<Record<string, MatchState>>({});
  const [sortByMatch,    setSortByMatch]    = useState(true);
  // Fila con el detalle de compatibilidad abierto ("vacancyId-userId")
  const [detailKey,      setDetailKey]      = useState<string | null>(null);

  const matchesRef = useRef(matches);
  useEffect(() => { matchesRef.current = matches; }, [matches]);

  const loadMatches = useCallback((vacancyId: string, force = false) => {
    const current = matchesRef.current[vacancyId];
    if (!force && current && current.status !== "error") return; // ya está o se está pidiendo
    matchesRef.current = { ...matchesRef.current, [vacancyId]: { status: "loading" } };
    setMatches(p => ({ ...p, [vacancyId]: { status: "loading" } }));
    fetchVacancyMatches(vacancyId)
      .then(data => setMatches(p => ({
        ...p,
        [vacancyId]: data ? { status: "ok", data } : { status: "error" },
      })))
      .catch(() => setMatches(p => ({ ...p, [vacancyId]: { status: "error" } })));
  }, []);

  // Compatibilidad de un postulado (si ya se calculó la de su vacante)
  const getApplicantMatch = (vacancyId: string, userId: string): MatchCandidate | null | undefined => {
    const st = matches[vacancyId];
    if (!st || st.status !== "ok") return undefined;
    return st.data.applicants.find(a => a.userId === userId) ?? null;
  };

  const toggleVacancy = (vacancyId: string, isOpen: boolean) => {
    setExpanded(isOpen ? null : vacancyId);
    if (!isOpen) loadMatches(vacancyId);
  };

  const fetchVacancies = () => {
    axios
      .get(`${import.meta.env.VITE_API_URL}/api/vacancies`, { withCredentials: true })
      .then(({ data }) => setVacancies(Array.isArray(data.data) ? data.data : []))
      .catch(console.error)
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    if (!hasActivePlan) return; // sin plan no se piden datos
    fetchVacancies();
  }, [hasActivePlan]); // eslint-disable-line

  // ── Abrir CV ──────────────────────────────────────────────────
  const openCV = async (userId: string, name: string) => {
    setCvModal({ userId, name });
    setCvData(null);
    setLoadingCv(true);
    try {
      const { data } = await axios.get(
        `${import.meta.env.VITE_API_URL}/api/cv/user/${userId}`,
        { withCredentials: true }
      );
      setCvData(data.data);
    } catch { setCvData(null); }
    finally  { setLoadingCv(false); }
  };

  const closeCV = useCallback(() => setCvModal(null), []);

  // ── Descargar PDF ─────────────────────────────────────────────
  // Funciona desde la fila (sin abrir el modal) y desde el modal.
  // La ventana se abre en el mismo click, ANTES del await: si se abre después
  // de pedir el CV, el navegador la trata como popup y la bloquea.
  const downloadCV = async (userId: string, name: string) => {
    const win = window.open("", "_blank");
    if (!win) return;
    win.document.write(windowMessage("Generando CV..."));
    win.document.close();

    try {
      // Si el modal ya tiene cargado el CV de este postulante, se reusa
      let cv = cvModal?.userId === userId ? cvData : null;
      if (!cv) {
        const { data } = await axios.get(
          `${import.meta.env.VITE_API_URL}/api/cv/user/${userId}`,
          { withCredentials: true }
        );
        cv = data.data;
      }

      win.document.open();
      win.document.write(cv ? buildCvHtml(cv, name) : windowMessage("Este postulante no tiene CV completo."));
      win.document.close();
    } catch {
      win.document.open();
      win.document.write(windowMessage("No se pudo cargar el CV. Probá de nuevo."));
      win.document.close();
    }
  };

  // ── Cambiar estado ────────────────────────────────────────────
  const handleStatusChange = async (vacancyId: string, userId: string, newStatus: string) => {
    const key = `${vacancyId}-${userId}`;
    setUpdatingStatus(key);
    try {
      await axios.patch(
        `${import.meta.env.VITE_API_URL}/api/vacancy/${vacancyId}/applicants/${userId}/status`,
        { status: newStatus },
        { withCredentials: true }
      );
      setVacancies((prev) =>
        prev.map((v) =>
          v._id !== vacancyId ? v : {
            ...v,
            applicants: v.applicants.map((a) =>
              a.userId === userId ? { ...a, status: newStatus } : a
            ),
          }
        )
      );
    } catch (err) { console.error("Error actualizando estado:", err); }
    finally       { setUpdatingStatus(null); }
  };

  // ── Eliminar postulante ───────────────────────────────────────
  const handleDelete = async (vacancyId: string, userId: string) => {
    const key = `${vacancyId}-${userId}`;
    setDeletingId(key);
    try {
      await axios.delete(
        `${import.meta.env.VITE_API_URL}/api/vacancy/${vacancyId}/applicants/${userId}`,
        { withCredentials: true }
      );
      setVacancies((prev) =>
        prev.map((v) =>
          v._id !== vacancyId ? v : {
            ...v,
            applicants: v.applicants.filter((a) => a.userId !== userId),
          }
        )
      );
    } catch (err) { console.error("Error eliminando postulante:", err); }
    finally       { setDeletingId(null); }
  };

  // ── Cómputos ──────────────────────────────────────────────────
  const totalApplicants = vacancies.reduce((acc, v) => acc + (v.applicants?.length ?? 0), 0);
  const withApplicants  = vacancies.filter((v) => (v.applicants?.length ?? 0) > 0);
  // Se listan las que tienen postulados y también las activas sin postulados,
  // para poder ver talento sugerido aunque nadie se haya postulado todavía
  const visibleVacancies = vacancies.filter((v) => (v.applicants?.length ?? 0) > 0 || v.status === "active");

  // Aplana todos los postulantes con referencia a su vacante para los filtros globales
  type FlatApplicant = Applicant & { vacancyId: string; vacancyTitle: string };
  const allFlat: FlatApplicant[] = vacancies.flatMap((v) =>
    (v.applicants ?? []).map((a) => ({ ...a, vacancyId: v._id, vacancyTitle: v.title }))
  );

  const filteredFlat = allFlat.filter((a) => {
    const name  = (a as any).applicantName  ?? "";
    const email = (a as any).applicantEmail ?? "";
    if (filterStatus && a.status !== filterStatus) return false;
    if (hideRejected && filterStatus !== "rejected" && a.status === "rejected") return false;
    if (filterSearch) {
      const q = filterSearch.toLowerCase();
      if (!name.toLowerCase().includes(q) && !email.toLowerCase().includes(q)) return false;
    }
    return true;
  });

  const hasFilters    = filterStatus || filterSearch;
  const rejectedTotal = allFlat.filter((a) => a.status === "rejected").length;
  const themeClass = theme === "light" ? " light" : "";

  // Sin plan activo: solo el bloque con el link a /pricing, nada más
  if (!hasActivePlan) return (
    <div className={`pp-wrap${themeClass}`}>
      <PostuladosNoPlanBlock planExpired={planExpired} />
    </div>
  );

  if (loading) return (
    <div className={`pp-wrap${themeClass}`}>
      <div className="pp-loading"><span className="pp-live-dot" /> Cargando postulaciones…</div>
    </div>
  );

  // ── Fila de postulante ────────────────────────────────────────
  const renderApplicantRow = (applicant: any, vacancyId: string, index: number, showVacancy = false) => {
    const statusInfo  = APPLICANT_STATUS_LABELS[applicant.status] ?? APPLICANT_STATUS_LABELS.pending;
    const isUpdating  = updatingStatus === `${vacancyId}-${applicant.userId}`;
    const isDeleting  = deletingId    === `${vacancyId}-${applicant.userId}`;
    const name        = applicant.applicantName  || applicant.userId;
    const email       = applicant.applicantEmail || "";
    const phone       = applicant.applicantPhone || "";
    const isRejected  = applicant.status === "rejected";
    const matchState  = matches[vacancyId];
    const matchInfo   = getApplicantMatch(vacancyId, applicant.userId);
    const rowKey      = `${vacancyId}-${applicant.userId}`;
    const hasScore    = !!matchState && matchState.status !== "error";
    const detailOpen  = detailKey === rowKey && !!matchInfo?.match;

    return (
      <li
        key={rowKey}
        className={`pp-row${hasScore ? " vm-has-score" : ""}${detailOpen ? " vm-detail-open" : ""}`}
        style={{ "--pp-status": statusInfo.color } as React.CSSProperties}
      >
        <span className="pp-avatar" aria-hidden="true">{initials(applicant.applicantName || "")}</span>

        <div className="pp-row-info">
          <span className="pp-row-name">
            <span className="pp-row-num">#{index + 1}</span>{name}
          </span>
          {showVacancy && <span className="pp-row-vacancy">{applicant.vacancyTitle}</span>}
          <div className="pp-row-meta">
            {email && <a href={`mailto:${email}`} className="pp-row-link">{email}</a>}
            {phone && <a href={`tel:${phone}`} className="pp-row-link">{phone}</a>}
            {applicant.appliedAt && <span>Se postuló el {fmtDate(applicant.appliedAt)}</span>}
          </div>
        </div>

        {hasScore && (
          <ScoreBadge
            loading={matchState?.status === "loading"}
            candidate={matchInfo}
            open={detailOpen}
            onToggle={() => setDetailKey(detailOpen ? null : rowKey)}
          />
        )}

        <label className="pp-status">
          <span className="pp-visually-hidden">Estado de {name}</span>
          <span className="pp-status-dot" aria-hidden="true" />
          <select
            className="pp-status-select"
            value={applicant.status}
            disabled={isUpdating}
            onChange={(e) => handleStatusChange(vacancyId, applicant.userId, e.target.value)}
          >
            {Object.entries(APPLICANT_STATUS_LABELS).map(([val, { label }]) => (
              <option key={val} value={val}>{label}</option>
            ))}
          </select>
        </label>

        <div className="pp-row-actions">
          <button type="button" className="pp-btn pp-btn--accent" onClick={() => openCV(applicant.userId, name)}>
            Ver CV
          </button>
          <button type="button" className="pp-btn" onClick={() => downloadCV(applicant.userId, name)}>
            ↓ PDF
          </button>
          {isRejected && (
            <button
              type="button"
              className="pp-btn pp-btn--danger pp-btn--icon"
              disabled={isDeleting}
              onClick={() => handleDelete(vacancyId, applicant.userId)}
              aria-label={`Eliminar a ${name}`}
              title="Eliminar postulante"
            >
              {isDeleting ? "…" : (
                <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M3.5 5.5h13" />
                  <path d="M8 5.5V4a1 1 0 011-1h2a1 1 0 011 1v1.5" />
                  <path d="M5 5.5l.8 10.6a1.5 1.5 0 001.5 1.4h5.4a1.5 1.5 0 001.5-1.4L15 5.5" />
                  <path d="M8.5 9v5M11.5 9v5" />
                </svg>
              )}
            </button>
          )}
        </div>

        {detailOpen && matchInfo?.match && (
          <div className="vm-row-detail"><MatchBreakdown m={matchInfo.match} /></div>
        )}
      </li>
    );
  };

  const statusEntries = Object.entries(APPLICANT_STATUS_LABELS)
    .map(([key, info]) => ({ key, ...info, count: allFlat.filter((a) => a.status === key).length }));

  return (
    <div className={`pp-wrap${themeClass}`}>

      {/* ── Resumen ── */}
      <div className="pp-summary">
        <div className="pp-kpi">
          <span className="pp-kpi-value">{totalApplicants >= 100 ? "+99" : totalApplicants}</span>
          <span className="pp-kpi-label">Postulaciones</span>
        </div>
        <div className="pp-kpi">
          <span className="pp-kpi-value">{withApplicants.length}</span>
          <span className="pp-kpi-label">Vacantes con postulados</span>
        </div>
      </div>

      {/* Distribución por estado — tocá un estado para filtrar */}
      {totalApplicants > 0 && (
        <div className="pp-pipeline">
          {/* <div className="pp-pipeline-bar" aria-hidden="true">
            {statusEntries.filter(s => s.count > 0).map(s => (
              <span key={s.key} style={{ flexGrow: s.count, background: s.color }} />
            ))}
          </div> */}
          <div className="pp-pipeline-chips">
            {statusEntries.filter(s => s.count > 0).map(s => (
              <button
                key={s.key}
                type="button"
                className={`pp-pill${filterStatus === s.key ? " pp-pill--active" : ""}`}
                style={{ "--pp-status": s.color } as React.CSSProperties}
                onClick={() => setFilterStatus(filterStatus === s.key ? "" : s.key)}
                aria-pressed={filterStatus === s.key}
              >
                <span className="pp-pill-dot" aria-hidden="true" />
                {s.label}
                <b>{s.count}</b>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* ── Filtros ── */}
      <div className="pp-toolbar">
        <div className="pp-search">
          <span className="pp-search-icon" aria-hidden="true">⌕</span>
          <input
            className="pp-input pp-input--search"
            type="search"
            placeholder="Buscar por nombre o email"
            value={filterSearch}
            onChange={(e) => setFilterSearch(e.target.value)}
            aria-label="Buscar postulantes"
          />
        </div>
        <select
          className="pp-input pp-select"
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value)}
          aria-label="Filtrar por estado"
        >
          <option value="">Todos los estados</option>
          {Object.entries(APPLICANT_STATUS_LABELS).map(([val, { label }]) => (
            <option key={val} value={val}>{label}</option>
          ))}
        </select>
        <button
          type="button"
          className={`pp-btn pp-hide-toggle${hideRejected ? " is-active" : ""}`}
          onClick={toggleHideRejected}
          aria-pressed={hideRejected}
          title={hideRejected ? "Volver a mostrar los no seleccionados" : "Ocultar los postulados marcados como no seleccionados"}
        >
          <span className="pp-hide-box" aria-hidden="true" />
          Ocultar no seleccionados
          {rejectedTotal > 0 && <b>{rejectedTotal}</b>}
        </button>
      </div>

      {hasFilters && (
        <div className="pp-results">
          <span><b>{filteredFlat.length}</b> resultado{filteredFlat.length !== 1 ? "s" : ""}</span>
          <button type="button" className="pp-link" onClick={() => { setFilterStatus(""); setFilterSearch(""); }}>
            Limpiar filtros
          </button>
        </div>
      )}

      {/* ── Lista ── */}
      {hasFilters ? (
        filteredFlat.length === 0 ? (
          <div className="pp-empty">
            <span className="pp-empty-icon" aria-hidden="true">◫</span>
            <p className="pp-empty-title">Sin resultados</p>
            <p className="pp-empty-text">Ningún postulante coincide con los filtros aplicados.</p>
          </div>
        ) : (
          <ul className="pp-rows pp-rows--flat">
            {filteredFlat.map((a, i) => renderApplicantRow(a, a.vacancyId, i, true))}
          </ul>
        )
      ) : (
        visibleVacancies.length === 0 ? (
          <div className="pp-empty">
            <span className="pp-empty-icon" aria-hidden="true">◫</span>
            <p className="pp-empty-title">Sin postulaciones aún</p>
            <p className="pp-empty-text">Cuando publiques una vacante, vas a ver acá a los postulados y el talento sugerido.</p>
          </div>
        ) : (
          <div className="pp-groups">
            {visibleVacancies.map((v) => {
              const isOpen = expanded === v._id;
              const count  = v.applicants?.length ?? 0;
              const breakdown = statusEntries
                .map(s => ({ ...s, n: v.applicants.filter(a => a.status === s.key).length }))
                .filter(s => s.n > 0);
              const mState = matches[v._id];
              const mData  = mState?.status === "ok" ? mState.data : null;

              // Postulados ordenados por compatibilidad (los sin CV al final)
              const scoreOf = (userId: string) =>
                mData?.applicants.find(a => a.userId === userId)?.match?.score ?? -1;
              const sortedApplicants = sortByMatch && mData
                ? [...v.applicants].sort((a, b) => scoreOf(b.userId) - scoreOf(a.userId))
                : v.applicants;
              const orderedApplicants = hideRejected
                ? sortedApplicants.filter(a => a.status !== "rejected")
                : sortedApplicants;
              const hiddenCount = count - orderedApplicants.length;

              return (
                <section key={v._id} className={`pp-group${isOpen ? " open" : ""}`}>
                  <button type="button" className="pp-group-head" onClick={() => toggleVacancy(v._id, isOpen)} aria-expanded={isOpen}>
                    <span className="pp-group-info">
                      <span className="pp-eyebrow">Posición</span>
                      <span className="pp-group-title">{v.title}</span>
                      <span className="pp-group-breakdown">
                        {breakdown.map(s => (
                          <span key={s.key} className="pp-mini" title={s.label}>
                            <span style={{ background: s.color }} />{s.n}
                          </span>
                        ))}
                      </span>
                    </span>
                    <span className="pp-group-right">
                      <span className="pp-group-count">
                        <b>{count >= 100 ? "+99" : count}</b> postulado{count !== 1 ? "s" : ""}
                      </span>
                      <span className="pp-chevron pp-chevron--lg" aria-hidden="true" />
                    </span>
                  </button>
                  {isOpen && (
                    <>
                      {/* (1) Lo que pide la vacante */}
                      <div className="vm-section">
                        {mState?.status === "loading" && (
                          <div className="vm-state"><span className="pp-live-dot" /> Calculando compatibilidad…</div>
                        )}
                        {mState?.status === "error" && (
                          <div className="vm-state vm-state--error">
                            No se pudo calcular la compatibilidad.
                            <button type="button" className="pp-btn pp-btn--sm" onClick={() => loadMatches(v._id, true)}>Reintentar</button>
                          </div>
                        )}
                        {mData && <RequestedSkills data={mData} />}
                      </div>

                      {/* (2) Postulados: siempre todos, con cualquier porcentaje */}
                      <div className="vm-section">
                        <div className="vm-section-head">
                          <h4 className="vm-section-title">
                            Postulados <b>{orderedApplicants.length}</b>
                            {hiddenCount > 0 && (
                              <span className="pp-hidden-note">
                                · {hiddenCount} no seleccionado{hiddenCount !== 1 ? "s" : ""} oculto{hiddenCount !== 1 ? "s" : ""}
                              </span>
                            )}
                          </h4>
                          {orderedApplicants.length > 1 && mData?.hasRequirements && (
                            <div className="vm-sort">
                              <span className="vm-sort-label">Ordenar por</span>
                              <div className="vm-sort-group" role="group" aria-label="Ordenar postulados">
                                <button type="button" className={`vm-sort-btn${sortByMatch ? " is-active" : ""}`} aria-pressed={sortByMatch} onClick={() => setSortByMatch(true)}>Compatibilidad</button>
                                <button type="button" className={`vm-sort-btn${!sortByMatch ? " is-active" : ""}`} aria-pressed={!sortByMatch} onClick={() => setSortByMatch(false)}>Fecha</button>
                              </div>
                            </div>
                          )}
                        </div>

                        {orderedApplicants.length > 0 ? (
                          <ul className="pp-rows">
                            {orderedApplicants.map((applicant, i) => renderApplicantRow(applicant, v._id, i, false))}
                          </ul>
                        ) : count > 0 ? (
                          <p className="vm-note">
                            Todos los postulados de esta vacante están como no seleccionados.{" "}
                            <button type="button" className="pp-link" onClick={toggleHideRejected}>Mostrarlos</button>
                          </p>
                        ) : (
                          <p className="vm-note">Todavía nadie se postuló a esta vacante.</p>
                        )}
                      </div>

                      {/* (3) Talento sugerido: pestaña desplegable, aparte */}
                      {mData && (
                        <SuggestedTalent data={mData} onViewCv={openCV} onDownloadCv={downloadCV} />
                      )}
                    </>
                  )}
                </section>
              );
            })}
          </div>
        )
      )}

      {/* ── CV del postulante (bottom sheet en mobile, modal en desktop) ── */}
      {cvModal && (
        <Sheet
          onClose={closeCV}
          labelId="pp-cv-title"
          header={
            <>
              <span className="pp-eyebrow">CV del postulante</span>
              <h2 id="pp-cv-title" className="pp-sheet-title">{cvModal.name}</h2>
            </>
          }
          footer={
            <button
              type="button"
              className="pp-btn pp-btn--primary pp-btn--block"
              onClick={() => downloadCV(cvModal.userId, cvModal.name)}
              disabled={!cvData}
            >
              ↓ Descargar PDF
            </button>
          }
        >
          {loadingCv ? (
            <div className="pp-loading"><span className="pp-live-dot" /> Cargando CV…</div>
          ) : !cvData ? (
            <div className="pp-empty pp-empty--flat">
              <p className="pp-empty-title">CV incompleto</p>
              <p className="pp-empty-text">Este postulante todavía no completó su CV.</p>
            </div>
          ) : (() => {
            const p   = cvData.personalInfo ?? {};
            const v   = getValidations(cvData);
            const dec = normalizeCvSkills(cvData.skills);
            const declaredBranches = CATEGORY_ORDER
              .map(cat => ({ cat, items: dec[cat] }))
              .filter(b => b.items.length > 0);
            const hasValidated = v.certified.length > 0 || v.courses.length > 0;
            const hasValidatedInDeclared = declaredBranches.some(b =>
              b.items.some(s => v.certified.includes(s) || v.courseSkills.has(s))
            );
            const photo = safeImgSrc(p.photo);
            const wp    = cvData.workPreferences ?? {};

            return (
              <div className="pp-cv">
                {/* Encabezado */}
                <div className="pp-cv-header">
                  {photo
                    ? <img src={p.photo} alt={p.firstName} className="pp-cv-photo" />
                    : <span className="pp-cv-photo pp-cv-photo--placeholder">{initials(`${p.firstName ?? ""} ${p.lastName ?? ""}`)}</span>}
                  <div className="pp-cv-header-info">
                    <h3 className="pp-cv-name">{p.firstName} {p.lastName}</h3>
                    {p.headline && <p className="pp-cv-headline">{p.headline}</p>}
                    {hasValidated && (
                      <div className="pp-chips">
                        {v.certified.length > 0 && <span className="pp-chip pp-chip--cert">✓ Certificado</span>}
                        {v.courses.length > 0 && <span className="pp-chip pp-chip--course">Cursos completados</span>}
                      </div>
                    )}
                  </div>
                </div>

                {(p.email || p.phone || p.location || p.linkedin || p.github) && (
                  <div className="pp-cv-contacts">
                    {p.email    && <a href={`mailto:${p.email}`}>{p.email}</a>}
                    {p.phone    && <a href={`tel:${p.phone}`}>{p.phone}</a>}
                    {p.location && <span>{p.location}</span>}
                    {p.linkedin && <span>{p.linkedin}</span>}
                    {p.github   && <span>{p.github}</span>}
                  </div>
                )}

                {p.summary && (
                  <section className="pp-cv-section">
                    <h4 className="pp-cv-section-title">Perfil</h4>
                    <p className="pp-cv-text">{p.summary}</p>
                  </section>
                )}

                {/* ── VALIDADO POR HIDDEN SECURITY ── */}
                <section className="pp-validated">
                  <div className="pp-block-head">
                    <span className="pp-block-title">Validado por Hidden Security</span>
                    <span className="pp-block-sub">Comprobado por la plataforma, no declarado por el postulante</span>
                  </div>

                  {!hasValidated ? (
                    <p className="pp-note">Este postulante todavía no tiene certificaciones ni cursos completados en Hidden Security.</p>
                  ) : (
                    <>
                      {v.certified.length > 0 && (
                        <div className="pp-vgroup">
                          <span className="pp-vlabel pp-vlabel--cert">Certificaciones · examen controlado y cronometrado</span>
                          <div className="pp-certs">
                            {v.certified.map(c => (
                              <div key={c} className="pp-cert">
                                <span className="pp-cert-mark" aria-hidden="true">✓</span>
                                <span className="pp-cert-text">
                                  <strong>{c}</strong>
                                  <span>Certificación Hidden Security</span>
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {v.courses.length > 0 && (
                        <div className="pp-vgroup">
                          <span className="pp-vlabel pp-vlabel--course">Cursos completados · skills validadas por evaluaciones</span>
                          {v.courses.map(c => <ValidatedCourse key={c.id} title={c.title} skills={c.skills} />)}
                        </div>
                      )}
                    </>
                  )}
                </section>

                {/* ── AUTODECLARADO EN EL CV ── */}
                <section className="pp-declared-block">
                  <div className="pp-block-head">
                    <span className="pp-block-title pp-block-title--plain">Skills autodeclaradas</span>
                    <span className="pp-block-sub">Las cargó el postulante. Hidden Security no las verificó.</span>
                  </div>

                  {declaredBranches.length === 0 ? (
                    <p className="pp-note">El postulante no declaró skills en su CV.</p>
                  ) : (
                    <>
                      {declaredBranches.map(b => (
                        <DeclaredBranch
                          key={b.cat}
                          category={b.cat}
                          items={b.items}
                          certified={v.certified}
                          courseSkills={v.courseSkills}
                        />
                      ))}
                      {hasValidatedInDeclared && (
                        <p className="pp-note">Las que aparecen en dorado o celeste también están validadas por Hidden Security.</p>
                      )}
                    </>
                  )}
                </section>

                {(cvData.experience ?? []).length > 0 && (
                  <section className="pp-cv-section">
                    <h4 className="pp-cv-section-title">Experiencia</h4>
                    {cvData.experience.map((e: any, i: number) => (
                      <div key={i} className="pp-entry">
                        <div className="pp-entry-head">
                          <div className="pp-entry-main">
                            <strong>{e.position}</strong>
                            <span>{e.company}{e.location ? `, ${e.location}` : ""}</span>
                          </div>
                          <span className="pp-entry-date">{e.startDate}{e.startDate && " — "}{e.current ? "Actualidad" : e.endDate}</span>
                        </div>
                        {e.description && <p className="pp-cv-text">{e.description}</p>}
                      </div>
                    ))}
                  </section>
                )}

                {(cvData.education ?? []).length > 0 && (
                  <section className="pp-cv-section">
                    <h4 className="pp-cv-section-title">Educación</h4>
                    {cvData.education.map((e: any, i: number) => (
                      <div key={i} className="pp-entry">
                        <div className="pp-entry-head">
                          <div className="pp-entry-main">
                            <strong>{e.degree}{e.field ? ` — ${e.field}` : ""}</strong>
                            <span>{e.institution}</span>
                          </div>
                          <span className="pp-entry-date">{e.startDate}{e.startDate && " — "}{e.current ? "Actualidad" : e.endDate}</span>
                        </div>
                      </div>
                    ))}
                  </section>
                )}

                {(cvData.certifications ?? []).length > 0 && (
                  <section className="pp-cv-section">
                    <h4 className="pp-cv-section-title">Otras certificaciones (declaradas)</h4>
                    {cvData.certifications.map((c: any, i: number) => (
                      <div key={i} className="pp-entry">
                        <div className="pp-entry-head">
                          <div className="pp-entry-main">
                            <strong>{c.name}</strong>
                            <span>
                              {c.issuer}
                              {/^https?:\/\//i.test(c.url ?? "") && (
                                <> · <a className="pp-link" href={c.url} target="_blank" rel="noreferrer">Ver certificación</a></>
                              )}
                            </span>
                          </div>
                          <span className="pp-entry-date">{c.date}</span>
                        </div>
                      </div>
                    ))}
                  </section>
                )}

                {(cvData.projects ?? []).length > 0 && (
                  <section className="pp-cv-section">
                    <h4 className="pp-cv-section-title">Proyectos</h4>
                    {cvData.projects.map((proj: any, i: number) => (
                      <div key={i} className="pp-entry">
                        <div className="pp-entry-head">
                          <div className="pp-entry-main"><strong>{proj.name}</strong></div>
                          <div className="pp-entry-links">
                            {/^https?:\/\//i.test(proj.url ?? "")     && <a href={proj.url}     target="_blank" rel="noreferrer" className="pp-link">Demo</a>}
                            {/^https?:\/\//i.test(proj.repoUrl ?? "") && <a href={proj.repoUrl} target="_blank" rel="noreferrer" className="pp-link">Repo</a>}
                          </div>
                        </div>
                        {proj.description && <p className="pp-cv-text">{proj.description}</p>}
                      </div>
                    ))}
                  </section>
                )}

                {(cvData.languages ?? []).length > 0 && (
                  <section className="pp-cv-section">
                    <h4 className="pp-cv-section-title">Idiomas</h4>
                    <div className="pp-langs">
                      {cvData.languages.map((l: any, i: number) => (
                        <div key={i} className="pp-lang">
                          <strong>{l.language}</strong>
                          <span>{l.level}</span>
                        </div>
                      ))}
                    </div>
                  </section>
                )}

                {cvData.availability && (
                  <section className="pp-cv-section">
                    <h4 className="pp-cv-section-title">Disponibilidad</h4>
                    <p className="pp-cv-text pp-cv-text--accent">
                      {cvData.availability}
                      {wp.modality?.length > 0 && ` · ${wp.modality.join(", ")}`}
                      {(wp.salaryMin || wp.salaryMax) &&
                        ` · ${wp.currency} ${wp.salaryMin?.toLocaleString("es-AR") ?? ""}${wp.salaryMin && wp.salaryMax ? " — " : ""}${wp.salaryMax?.toLocaleString("es-AR") ?? ""}`}
                    </p>
                  </section>
                )}
              </div>
            );
          })()}
        </Sheet>
      )}
    </div>
  );
}