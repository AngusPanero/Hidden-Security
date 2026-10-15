import { useEffect, useState } from "react";
import axios from "axios";
import { Link } from "react-router-dom";
import { UseSession } from "../contexts/SessionContext";
import "./enterpriseDashboard.css";
import "./postuladosPlanBlocked.css";
import "./postuladosPlanBlocked.css";
import { HS_SKILLS } from "../skills/Skills"; 

// ─── Types ────────────────────────────────────────────────────────────────────
interface Applicant {
  userId:    string;
  status:    string;
  appliedAt: string;
}

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

const DECLARED_PAGE_SIZE = 20;
const COURSE_PAGE_SIZE   = 24;

// ─── Chip de skill dentro del modal ───────────────────────────────────────────
function CvChip({ label, kind }: { label: string; kind: "plain" | "cert" | "course" }) {
  return <span className={`hs-cvx-chip hs-cvx-chip--${kind}`}>{kind === "cert" ? "✓ " : ""}{label}</span>;
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
    <div className={`hs-cvx-course${open ? " open" : ""}`}>
      <button type="button" className="hs-cvx-course-head" onClick={() => setOpen(o => !o)} aria-expanded={open}>
        <span className="hs-cvx-arrow hs-cvx-arrow--course" aria-hidden="true">▸</span>
        <span className="hs-cvx-course-info">
          <span className="hs-cvx-course-kicker">CURSO COMPLETADO EN HIDDEN SECURITY</span>
          <span className="hs-cvx-course-title">{title}</span>
          <span className="hs-cvx-course-meta">
            {skills.length} skills validadas
            {branchCounts.length > 0 && " · " + branchCounts.map(b => `${b.n} ${CATEGORY_LABELS[b.cat].toLowerCase()}`).join(" · ")}
          </span>
        </span>
        <span className="hs-cvx-action hs-cvx-action--course">{open ? "OCULTAR" : "VER SKILLS"}</span>
      </button>

      {open && (
        <div className="hs-cvx-course-body">
          <p className="hs-cvx-note">Skills que el postulante demostró al completar el curso y aprobar sus evaluaciones.</p>

          {segments.map((seg, i) => {
            const showBranch = seg.branchLabel !== lastBranch;
            lastBranch = seg.branchLabel;
            return (
              <div key={`${seg.branchLabel}-${seg.group}-${i}`} className="hs-cvx-seg">
                {showBranch && <span className="hs-cvx-branch">{seg.branchLabel}</span>}
                <span className="hs-cvx-subgroup">{seg.group}</span>
                <div className="hs-cvx-chips">
                  {seg.skills.map(s => <CvChip key={s} label={s} kind="course" />)}
                </div>
              </div>
            );
          })}

          {totalPages > 1 && (
            <div className="hs-cvx-pager">
              <button type="button" className="hs-action-btn" disabled={page === 0} onClick={() => setPage(p => p - 1)}>← ANTERIOR</button>
              <span className="hs-cvx-pager-info">Página {page + 1} / {totalPages}</span>
              <button type="button" className="hs-action-btn" disabled={page >= totalPages - 1} onClick={() => setPage(p => p + 1)}>SIGUIENTE →</button>
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
    <div className={`hs-cvx-branchbox${open ? " open" : ""}`}>
      <button type="button" className="hs-cvx-branchbox-head" onClick={() => setOpen(o => !o)} aria-expanded={open}>
        <span className="hs-cvx-arrow" aria-hidden="true">▸</span>
        <span className="hs-cvx-branchbox-title">{CATEGORY_LABELS[category]}</span>
        <span className="hs-cvx-branchbox-count">{items.length} skills</span>
        <span className="hs-cvx-action">{open ? "OCULTAR" : "VER"}</span>
      </button>

      {open && (
        <div className="hs-cvx-branchbox-body">
          {segments.map((seg, i) => (
            <div key={`${seg.group}-${i}`} className="hs-cvx-seg">
              <span className="hs-cvx-subgroup">{seg.group}</span>
              <div className="hs-cvx-chips">
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
            <button type="button" className="hs-action-btn hs-cvx-more" onClick={() => setVisible(v => v + DECLARED_PAGE_SIZE)}>
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
    <div className="hs-pp-blocked">
      <span className="hs-pp-blocked-mark" aria-hidden="true"></span>
      <span className="hs-mono">// SIN_PLAN_ACTIVO</span>
      <h2 className="hs-pp-blocked-title">
        SOLO PARA CUENTAS <span className="hs-pp-blocked-accent">BUSINESS / ENTERPRISE</span>
      </h2>
      <p className="hs-pp-blocked-text">
        Necesitás un plan de empresa activo para ver y gestionar postulantes.
        {planExpired && " Tu plan venció — renovalo para volver a gestionar postulantes."}
      </p>
      <Link to="/pricing?tipo=empresas" className="hs-pp-blocked-cta">
        {planExpired ? "Renovar plan" : "Ver planes corporativos"}
      </Link>
    </div>
  );
}

// ─── Tab: Postulados ──────────────────────────────────────────────────────────
export default function PostuladosTab() {
  const { user } = UseSession();

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

  // Aplana todos los postulantes con referencia a su vacante para los filtros globales
  type FlatApplicant = Applicant & { vacancyId: string; vacancyTitle: string };
  const allFlat: FlatApplicant[] = vacancies.flatMap((v) =>
    (v.applicants ?? []).map((a) => ({ ...a, vacancyId: v._id, vacancyTitle: v.title }))
  );

  const filteredFlat = allFlat.filter((a) => {
    const name  = (a as any).applicantName  ?? "";
    const email = (a as any).applicantEmail ?? "";
    if (filterStatus && a.status !== filterStatus) return false;
    if (filterSearch) {
      const q = filterSearch.toLowerCase();
      if (!name.toLowerCase().includes(q) && !email.toLowerCase().includes(q)) return false;
    }
    return true;
  });

  const hasFilters = filterStatus || filterSearch;

  // Sin plan activo: solo el bloque con el link a /pricing, nada más
  if (!hasActivePlan) return (
    <div className="hs-postulados">
      <PostuladosNoPlanBlock planExpired={planExpired} />
    </div>
  );

  if (loading) return (
    <div className="hs-postulados-loading">
      <span className="hs-live-dot" /> Cargando postulaciones...
    </div>
  );

  // ── Render de una fila de postulante ──────────────────────────
  const renderApplicantRow = (applicant: any, vacancyId: string, index: number, showVacancy = false) => {
    const statusInfo  = APPLICANT_STATUS_LABELS[applicant.status] ?? APPLICANT_STATUS_LABELS.pending;
    const isUpdating  = updatingStatus === `${vacancyId}-${applicant.userId}`;
    const isDeleting  = deletingId    === `${vacancyId}-${applicant.userId}`;
    const name        = applicant.applicantName  || applicant.userId;
    const email       = applicant.applicantEmail || "";
    const phone       = applicant.applicantPhone || "";
    const isRejected  = applicant.status === "rejected";

    return (
      <div key={`${vacancyId}-${applicant.userId}`} className="hs-postulados-applicant-row">
        <span className="hs-postulados-applicant-num">#{index + 1}</span>

        <div className="hs-postulados-applicant-info">
          <span className="hs-postulados-applicant-uid">{name}</span>
          {showVacancy && (
            <span style={{ fontSize: "0.62rem", opacity: 0.45, letterSpacing: 1 }}>
              {applicant.vacancyTitle}
            </span>
          )}
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 2 }}>
            {email && <span className="hs-postulados-applicant-date">{email}</span>}
            {phone && <span className="hs-postulados-applicant-date">{phone}</span>}
            {applicant.appliedAt && (
              <span className="hs-postulados-applicant-date">
                {new Date(applicant.appliedAt).toLocaleDateString("es-AR", { day: "2-digit", month: "short", year: "numeric" })}
              </span>
            )}
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 6, flexShrink: 0, flexWrap: "wrap" }}>
          <button
            className="hs-action-btn hs-action-btn--accent"
            style={{ fontSize: "0.58rem", padding: "4px 9px" }}
            onClick={() => openCV(applicant.userId, name)}
          >
            VER CV
          </button>
          <button
            className="hs-action-btn"
            style={{ fontSize: "0.58rem", padding: "4px 9px" }}
            onClick={() => downloadCV(applicant.userId, name)}
          >
            ↓ PDF
          </button>
          {isRejected && (
            <button
              className="hs-action-btn"
              style={{ fontSize: "0.58rem", padding: "4px 9px", borderColor: "rgba(244,63,94,0.5)", color: "#f43f5e", opacity: isDeleting ? 0.4 : 1 }}
              disabled={isDeleting}
              onClick={() => handleDelete(vacancyId, applicant.userId)}
            >
              {isDeleting ? "..." : "ELIMINAR"}
            </button>
          )}
        </div>

        <div className="hs-postulados-applicant-status">
          <span className="hs-postulados-status-dot" style={{ background: statusInfo.color }} />
          <select
            className="hs-postulados-status-select"
            value={applicant.status}
            disabled={isUpdating}
            onChange={(e) => handleStatusChange(vacancyId, applicant.userId, e.target.value)}
            style={{ borderColor: statusInfo.color, color: statusInfo.color, opacity: isUpdating ? 0.5 : 1 }}
          >
            {Object.entries(APPLICANT_STATUS_LABELS).map(([val, { label }]) => (
              <option key={val} value={val}>{label}</option>
            ))}
          </select>
        </div>
      </div>
    );
  };

  return (
    <div className="hs-postulados">

      {/* Stats */}
      <div className="hs-postulados-summary">
        <div className="hs-postulados-stat">
          <span className="hs-mono hs-eyebrow" style={{ marginBottom: 4 }}>// TOTAL</span>
          <span className="hs-postulados-stat-value">{totalApplicants >= 100 ? "+99" : totalApplicants}</span>
          <span className="hs-postulados-stat-label">postulaciones</span>
        </div>
        <div className="hs-postulados-stat">
          <span className="hs-mono hs-eyebrow" style={{ marginBottom: 4 }}>// VACANTES</span>
          <span className="hs-postulados-stat-value">{withApplicants.length}</span>
          <span className="hs-postulados-stat-label">con postulados</span>
        </div>
        {Object.entries(APPLICANT_STATUS_LABELS).map(([key, { label, color }]) => {
          const count = allFlat.filter((a) => a.status === key).length;
          if (count === 0) return null;
          return (
            <div
              key={key}
              className="hs-postulados-stat"
              style={{ cursor: "pointer", borderColor: filterStatus === key ? color : undefined }}
              onClick={() => setFilterStatus(filterStatus === key ? "" : key)}
            >
              <span className="hs-mono hs-eyebrow" style={{ marginBottom: 4, color }}>// {key.toUpperCase()}</span>
              <span className="hs-postulados-stat-value" style={{ color }}>{count}</span>
              <span className="hs-postulados-stat-label">{label.toLowerCase()}</span>
            </div>
          );
        })}
      </div>

      {/* Filtros */}
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 20, alignItems: "center" }}>
        <input
          className="hs-filter-input"
          placeholder="Buscar por nombre o email..."
          value={filterSearch}
          onChange={(e) => setFilterSearch(e.target.value)}
          style={{ flex: 1, minWidth: 200 }}
        />
        <select
          className="hs-filter-select"
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value)}
        >
          <option value="">Todos los estados</option>
          {Object.entries(APPLICANT_STATUS_LABELS).map(([val, { label }]) => (
            <option key={val} value={val}>{label}</option>
          ))}
        </select>
        {hasFilters && (
          <button
            className="hs-action-btn"
            style={{ fontSize: "0.6rem" }}
            onClick={() => { setFilterStatus(""); setFilterSearch(""); }}
          >
            LIMPIAR
          </button>
        )}
        {hasFilters && (
          <span style={{ fontSize: "0.65rem", opacity: 0.5 }}>
            {filteredFlat.length} resultado{filteredFlat.length !== 1 ? "s" : ""}
          </span>
        )}
      </div>

      {/* Vista filtrada — muestra todos flat con nombre de vacante */}
      {hasFilters ? (
        filteredFlat.length === 0 ? (
          <div className="hs-postulados-empty">
            <span className="hs-mono">// SIN_RESULTADOS</span>
            <p>Ningún postulante coincide con los filtros aplicados.</p>
          </div>
        ) : (
          <div className="hs-postulados-list">
            <div className="hs-postulados-card" style={{ padding: "12px 0" }}>
              <div className="hs-postulados-applicants" style={{ maxHeight: "none", padding: "0 22px" }}>
                {filteredFlat.map((a, i) => renderApplicantRow(a, a.vacancyId, i, true))}
              </div>
            </div>
          </div>
        )
      ) : (
        /* Vista normal — agrupada por vacante */
        withApplicants.length === 0 ? (
          <div className="hs-postulados-empty">
            <span className="hs-mono">// SIN_POSTULACIONES_AÚN</span>
            <p>Cuando alguien se postule a una de tus vacantes, aparecerá acá.</p>
          </div>
        ) : (
          <div className="hs-postulados-list">
            {withApplicants.map((v) => {
              const isOpen = expanded === v._id;
              const count  = v.applicants?.length ?? 0;
              return (
                <div key={v._id} className="hs-postulados-card">
                  <div className="hs-postulados-card-header" onClick={() => setExpanded(isOpen ? null : v._id)}>
                    <div className="hs-postulados-card-left">
                      <span className="hs-mono" style={{ fontSize: "0.6rem", letterSpacing: 2 }}>// POSICIÓN</span>
                      <h3 className="hs-postulados-card-title">{v.title}</h3>
                    </div>
                    <div className="hs-postulados-card-right">
                      <span className="hs-postulados-count">
                        {count >= 100 ? "+99" : count} postulado{count !== 1 ? "s" : ""}
                      </span>
                      <span className="hs-postulados-chevron">{isOpen ? "▲" : "▼"}</span>
                    </div>
                  </div>
                  {isOpen && (
                    <div className="hs-postulados-applicants">
                      {v.applicants.map((applicant, i) => renderApplicantRow(applicant, v._id, i, false))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )
      )}

      {/* Modal ver CV */}
      {cvModal && (
        <div className="hs-postulados-cv-overlay" onClick={() => setCvModal(null)}>
          <div className="hs-postulados-cv-modal" onClick={(e) => e.stopPropagation()}>
            <div className="hs-postulados-cv-modal-header">
              <div>
                <span className="hs-mono" style={{ fontSize: "0.6rem", letterSpacing: 2 }}>// CV_POSTULANTE</span>
                <h3 className="hs-postulados-card-title" style={{ marginTop: 4 }}>{cvModal.name}</h3>
              </div>
              <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                <button
                  className="hs-action-btn"
                  style={{ fontSize: "0.65rem" }}
                  onClick={() => downloadCV(cvModal.userId, cvModal.name)}
                  disabled={!cvData}
                >
                  ↓ DESCARGAR PDF
                </button>
                <button className="hs-postulados-cv-close" onClick={() => setCvModal(null)}>×</button>
              </div>
            </div>
            <div className="hs-postulados-cv-body">
              {loadingCv ? (
                <div className="hs-postulados-loading"><span className="hs-live-dot" /> Cargando CV...</div>
              ) : !cvData ? (
                <p style={{ opacity: 0.4, fontSize: "0.8rem" }}>Este postulante no tiene CV completo.</p>
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

                return (
                  <div className="hs-cv-view">
                    {/* Encabezado */}
                    <div className="hs-cv-header">
                      {photo && <img src={p.photo} alt={p.firstName} className="hs-cv-photo" />}
                      <div className="hs-cv-header-info">
                        <h2 className="hs-cv-name">{p.firstName} {p.lastName}</h2>
                        {p.headline && <p className="hs-cv-headline">{p.headline}</p>}
                        {hasValidated && (
                          <div className="hs-cvx-badges">
                            {v.certified.length > 0 && <span className="hs-cvx-chip hs-cvx-chip--cert">✓ CERTIFICADO</span>}
                            {v.courses.length > 0 && <span className="hs-cvx-chip hs-cvx-chip--course">CURSOS COMPLETADOS</span>}
                          </div>
                        )}
                        <div className="hs-cv-contacts">
                          {p.email    && <span>{p.email}</span>}
                          {p.phone    && <span>{p.phone}</span>}
                          {p.location && <span>{p.location}</span>}
                          {p.linkedin && <span>{p.linkedin}</span>}
                          {p.github   && <span>{p.github}</span>}
                        </div>
                      </div>
                    </div>

                    {p.summary && (
                      <div className="hs-cv-section">
                        <span className="hs-cv-section-title">// PERFIL</span>
                        <p className="hs-cv-text">{p.summary}</p>
                      </div>
                    )}

                    {/* ── VALIDADO POR HIDDEN SECURITY ── */}
                    <div className="hs-cvx-validated">
                      <div className="hs-cvx-block-head">
                        <span className="hs-cvx-block-title">VALIDADO POR HIDDEN SECURITY</span>
                        <span className="hs-cvx-block-sub">Comprobado por nosotros, no declarado por el postulante</span>
                      </div>

                      {!hasValidated ? (
                        <p className="hs-cvx-empty">
                          Este postulante todavía no tiene certificaciones ni cursos completados en Hidden Security.
                        </p>
                      ) : (
                        <>
                          {v.certified.length > 0 && (
                            <div className="hs-cvx-group">
                              <span className="hs-cvx-label hs-cvx-label--cert">Certificaciones · examen controlado y cronometrado</span>
                              <div className="hs-cvx-certs">
                                {v.certified.map(c => (
                                  <div key={c} className="hs-cvx-cert">
                                    <span className="hs-cvx-cert-mark" aria-hidden="true">✓</span>
                                    <span className="hs-cvx-cert-text">
                                      <strong>{c}</strong>
                                      <span>Certificación Hidden Security</span>
                                    </span>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}

                          {v.courses.length > 0 && (
                            <div className="hs-cvx-group">
                              <span className="hs-cvx-label hs-cvx-label--course">Cursos completados · skills validadas por evaluaciones</span>
                              {v.courses.map(c => <ValidatedCourse key={c.id} title={c.title} skills={c.skills} />)}
                            </div>
                          )}
                        </>
                      )}
                    </div>

                    {/* ── AUTODECLARADO EN EL CV ── */}
                    <div className="hs-cvx-declared">
                      <div className="hs-cvx-block-head">
                        <span className="hs-cvx-block-title hs-cvx-block-title--plain">SKILLS AUTODECLARADAS EN SU CV</span>
                        <span className="hs-cvx-block-sub">
                          Las cargó el postulante. Hidden Security no las verificó. Tocá cada categoría para ver el detalle.
                        </span>
                      </div>

                      {declaredBranches.length === 0 ? (
                        <p className="hs-cvx-empty">El postulante no declaró skills en su CV.</p>
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
                            <p className="hs-cvx-note">Las que aparecen en dorado o celeste también están validadas por Hidden Security.</p>
                          )}
                        </>
                      )}
                    </div>

                    {(cvData.experience ?? []).length > 0 && (
                      <div className="hs-cv-section">
                        <span className="hs-cv-section-title">// EXPERIENCIA</span>
                        {cvData.experience.map((e: any, i: number) => (
                          <div key={i} className="hs-cv-entry">
                            <div className="hs-cv-entry-header">
                              <div><strong>{e.position}</strong> <span style={{ opacity: 0.6 }}>· {e.company}{e.location ? `, ${e.location}` : ""}</span></div>
                              <span style={{ fontSize: "0.72rem", opacity: 0.4 }}>{e.startDate}{e.startDate && " — "}{e.current ? "Actualidad" : e.endDate}</span>
                            </div>
                            {e.description && <p className="hs-cv-text">{e.description}</p>}
                          </div>
                        ))}
                      </div>
                    )}

                    {(cvData.education ?? []).length > 0 && (
                      <div className="hs-cv-section">
                        <span className="hs-cv-section-title">// EDUCACIÓN</span>
                        {cvData.education.map((e: any, i: number) => (
                          <div key={i} className="hs-cv-entry">
                            <div className="hs-cv-entry-header">
                              <div><strong>{e.degree}{e.field ? ` — ${e.field}` : ""}</strong> <span style={{ opacity: 0.6 }}>· {e.institution}</span></div>
                              <span style={{ fontSize: "0.72rem", opacity: 0.4 }}>{e.startDate}{e.startDate && " — "}{e.current ? "Actualidad" : e.endDate}</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}

                    {(cvData.certifications ?? []).length > 0 && (
                      <div className="hs-cv-section">
                        <span className="hs-cv-section-title">// OTRAS CERTIFICACIONES (DECLARADAS)</span>
                        {cvData.certifications.map((c: any, i: number) => (
                          <div key={i} className="hs-cv-entry">
                            <div className="hs-cv-entry-header">
                              <div>
                                <strong>{c.name}</strong> <span style={{ opacity: 0.6 }}>· {c.issuer}</span>
                                {/^https?:\/\//i.test(c.url ?? "") && (
                                  <> · <a className="hs-cvx-link" href={c.url} target="_blank" rel="noreferrer">Ver certificación</a></>
                                )}
                              </div>
                              <span style={{ fontSize: "0.72rem", opacity: 0.4 }}>{c.date}</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}

                    {(cvData.projects ?? []).length > 0 && (
                      <div className="hs-cv-section">
                        <span className="hs-cv-section-title">// PROYECTOS</span>
                        {cvData.projects.map((proj: any, i: number) => (
                          <div key={i} className="hs-cv-entry">
                            <div className="hs-cv-entry-header">
                              <strong>{proj.name}</strong>
                              <div style={{ display: "flex", gap: 8 }}>
                                {/^https?:\/\//i.test(proj.url ?? "")     && <a href={proj.url}     target="_blank" rel="noreferrer" className="hs-cvx-link">Demo</a>}
                                {/^https?:\/\//i.test(proj.repoUrl ?? "") && <a href={proj.repoUrl} target="_blank" rel="noreferrer" className="hs-cvx-link">Repo</a>}
                              </div>
                            </div>
                            {proj.description && <p className="hs-cv-text">{proj.description}</p>}
                          </div>
                        ))}
                      </div>
                    )}

                    {(cvData.languages ?? []).length > 0 && (
                      <div className="hs-cv-section">
                        <span className="hs-cv-section-title">// IDIOMAS</span>
                        <div style={{ display: "flex", gap: 24, flexWrap: "wrap", marginTop: 8 }}>
                          {cvData.languages.map((l: any, i: number) => (
                            <div key={i}>
                              <div style={{ fontWeight: 900, fontSize: "0.85rem", textTransform: "uppercase" }}>{l.language}</div>
                              <div style={{ fontSize: "0.68rem", opacity: 0.5, letterSpacing: 1 }}>{l.level}</div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {cvData.availability && (
                      <div className="hs-cv-section">
                        <span className="hs-cv-section-title">// DISPONIBILIDAD</span>
                        <p className="hs-cv-text" style={{ color: "var(--h-accent)" }}>
                          {cvData.availability}
                          {cvData.workPreferences?.modality?.length > 0 && ` · ${cvData.workPreferences.modality.join(", ")}`}
                          {(cvData.workPreferences?.salaryMin || cvData.workPreferences?.salaryMax) &&
                            ` · ${cvData.workPreferences.currency} ${cvData.workPreferences.salaryMin?.toLocaleString("es-AR") ?? ""}${cvData.workPreferences.salaryMin && cvData.workPreferences.salaryMax ? " — " : ""}${cvData.workPreferences.salaryMax?.toLocaleString("es-AR") ?? ""}`}
                        </p>
                      </div>
                    )}
                  </div>
                );
              })()}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}