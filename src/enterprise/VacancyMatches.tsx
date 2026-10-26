import { useState } from "react";
import axios from "axios";
import "./vacancyMatches.css";

/* ══════════════════════════════════════════════════════════════
   VacancyMatches — compatibilidad candidato ↔ vacante
   Piezas que usa PostuladosTab:
   - fetchVacancyMatches: GET /api/cv/matches/:vacancyId
   - ScoreBadge:      columna de puntaje en la fila (abre el detalle)
   - MatchBreakdown:  qué skills tiene y cuáles le faltan
   - RequestedSkills: lo que pide la vacante (desplegable)
   - SuggestedTalent: pestaña desplegable con los NO postulados, paginada
   El mínimo de compatibilidad del talento sugerido vive en el backend
   (MIN_MATCH_SCORE en cvRouter.js) y llega acá como data.minScore.
══════════════════════════════════════════════════════════════ */

export type Category = "roles" | "habilidades" | "herramientas";

export interface MatchedSkill { skill: string; verified: boolean }

export interface CategoryBreakdown {
  required: number;
  matched:  MatchedSkill[];
  missing:  string[];
}

export interface MatchResult {
  score:           number;
  coverage:        number;
  totalMatched:    number;
  totalRequired:   number;
  breakdown:       Record<Category, CategoryBreakdown>;
  verifiedMatches: string[];
  modalityMatch:   boolean;
  contractMatch:   boolean;
}

export interface MatchCandidate {
  userId:    string;
  name:      string;
  headline:  string | null;
  photo:     string | null;
  location:  string | null;
  match:     MatchResult | null;
  hasCv?:    boolean;
}

export interface MatchesData {
  vacancy: {
    id:           string;
    title:        string;
    skills:       Record<Category, string[]>;
    modality:     string;
    contractType: string;
  };
  hasRequirements: boolean;
  minScore?:       number;
  applicants:      MatchCandidate[];
  suggestions:     MatchCandidate[];
}

// Sugeridos por página dentro de la pestaña
const SUGGESTIONS_PAGE_SIZE = 5;

export async function fetchVacancyMatches(vacancyId: string): Promise<MatchesData | null> {
  const { data } = await axios.get(
    `${import.meta.env.VITE_API_URL}/api/cv/matches/${vacancyId}`,
    { withCredentials: true }
  );
  return data?.data ?? null;
}

const CATEGORIES: Category[] = ["roles", "habilidades", "herramientas"];

const CATEGORY_LABELS: Record<Category, string> = {
  roles:        "Áreas y roles",
  habilidades:  "Habilidades",
  herramientas: "Herramientas",
};

export const scoreTone = (score: number | null | undefined) =>
  score == null ? "none" : score >= 75 ? "high" : score >= 50 ? "mid" : "low";

const initials = (name: string) =>
  name.split(/\s+/).filter(Boolean).slice(0, 2).map(w => w.charAt(0).toUpperCase()).join("") || "?";

const safeImg = (u: string | null) => (u && /^(https?:\/\/|data:image\/)/i.test(u) ? u : null);

// ─── Columna de puntaje (botón que abre el detalle) ───────────────────────────
export function ScoreBadge({
  candidate, loading, open, onToggle,
}: {
  candidate?: MatchCandidate | null;
  loading?:   boolean;
  open?:      boolean;
  onToggle?:  () => void;
}) {
  if (loading) {
    return <div className="vm-score vm-score--none"><span className="vm-score-value">…</span><span className="vm-score-label">Calculando</span></div>;
  }
  const m = candidate?.match;
  if (!m) {
    return (
      <div className="vm-score vm-score--none" title="No se puede calcular la compatibilidad">
        <span className="vm-score-value">—</span>
        <span className="vm-score-label">{candidate?.hasCv === false ? "Sin CV" : "Sin datos"}</span>
      </div>
    );
  }

  return (
    <button
      type="button"
      className={`vm-score vm-score--${scoreTone(m.score)}${open ? " is-open" : ""}`}
      onClick={onToggle}
      aria-expanded={!!open}
      title={open ? "Ocultar detalle de compatibilidad" : "Ver detalle de compatibilidad"}
    >
      <span className="vm-score-value">{m.score}%</span>
      <span className="vm-score-bar" aria-hidden="true"><span style={{ width: `${m.score}%` }} /></span>
      <span className="vm-score-label">
        Compatible <span className="pp-chevron" aria-hidden="true" />
      </span>
    </button>
  );
}

// ─── Detalle: skills que tiene / que le faltan ────────────────────────────────
export function MatchBreakdown({ m }: { m: MatchResult }) {
  return (
    <div className="vm-breakdown">
      <div className="vm-breakdown-grid">
        {CATEGORIES.filter(cat => m.breakdown[cat].required > 0).map(cat => (
          <div key={cat} className="vm-breakdown-col">
            <span className="vm-label">
              {CATEGORY_LABELS[cat]}
              <b>{m.breakdown[cat].matched.length}/{m.breakdown[cat].required}</b>
            </span>
            <div className="vm-chips">
              {m.breakdown[cat].matched.map(s => (
                <span key={s.skill} className={`vm-chip vm-chip--ok${s.verified ? " vm-chip--verified" : ""}`}>
                  {s.verified ? "✓ " : ""}{s.skill}
                </span>
              ))}
              {m.breakdown[cat].missing.map(s => (
                <span key={s} className="vm-chip vm-chip--missing">{s}</span>
              ))}
            </div>
          </div>
        ))}
      </div>

      <div className="vm-breakdown-foot">
        <span className="vm-legend-item"><i className="vm-dot vm-dot--ok" />Tiene</span>
        <span className="vm-legend-item"><i className="vm-dot vm-dot--verified" />Validada por Hidden</span>
        <span className="vm-legend-item"><i className="vm-dot vm-dot--missing" />Le falta</span>
        <span className="vm-sep" aria-hidden="true" />
        <span className={m.modalityMatch ? "is-yes" : "is-no"}>Modalidad {m.modalityMatch ? "✓" : "✕"}</span>
        <span className={m.contractMatch ? "is-yes" : "is-no"}>Contrato {m.contractMatch ? "✓" : "✕"}</span>
      </div>
    </div>
  );
}

// ─── Lo que pide la vacante (desplegable) ─────────────────────────────────────
export function RequestedSkills({ data }: { data: MatchesData }) {
  const [open, setOpen] = useState(false);
  const total = CATEGORIES.reduce((n, cat) => n + (data.vacancy.skills?.[cat]?.length ?? 0), 0);

  if (!data.hasRequirements) {
    return (
      <p className="vm-note vm-note--warn">
        Esta vacante no tiene áreas, habilidades ni herramientas cargadas, así que no se puede calcular compatibilidad.
        Editala desde Vacantes y sumá las skills que buscás.
      </p>
    );
  }

  return (
    <div className={`vm-request${open ? " open" : ""}`}>
      <button type="button" className="vm-request-head" onClick={() => setOpen(o => !o)} aria-expanded={open}>
        <span className="vm-label">La vacante pide</span>
        <span className="vm-request-count">{total} skill{total === 1 ? "" : "s"}</span>
        <span className="pp-toggle">{open ? "Ocultar" : "Ver"}<span className="pp-chevron" aria-hidden="true" /></span>
      </button>
      {open && (
        <div className="vm-request-body">
          {CATEGORIES.filter(cat => (data.vacancy.skills?.[cat] ?? []).length > 0).map(cat => (
            <div key={cat} className="vm-request-group">
              <span className="vm-sublabel">{CATEGORY_LABELS[cat]}</span>
              <div className="vm-chips">
                {data.vacancy.skills[cat].map(s => <span key={s} className="vm-chip vm-chip--req">{s}</span>)}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Talento sugerido: pestaña desplegable + paginación ───────────────────────
export function SuggestedTalent({
  data, onViewCv, onDownloadCv,
}: {
  data: MatchesData;
  onViewCv:     (userId: string, name: string) => void;
  onDownloadCv: (userId: string, name: string) => void;
}) {
  const [open, setOpen]         = useState(false);
  const [page, setPage]         = useState(0);
  const [detailId, setDetailId] = useState<string | null>(null);

  if (!data.hasRequirements) return null;

  const list       = data.suggestions;
  const minScore   = data.minScore ?? 50;
  const totalPages = Math.max(1, Math.ceil(list.length / SUGGESTIONS_PAGE_SIZE));
  const safePage   = Math.min(page, totalPages - 1);
  const pageItems  = list.slice(safePage * SUGGESTIONS_PAGE_SIZE, (safePage + 1) * SUGGESTIONS_PAGE_SIZE);

  return (
    <section className={`vm-suggested${open ? " open" : ""}`}>
      <button type="button" className="vm-suggested-head" onClick={() => setOpen(o => !o)} aria-expanded={open}>
        <span className="vm-suggested-info">
          <span className="vm-eyebrow">Opcional · no postulados</span>
          <span className="vm-suggested-title">Talento sugerido</span>
          <span className="vm-suggested-sub">
            Usuarios con CV que superan el {minScore}% de compatibilidad y todavía no se postularon
          </span>
        </span>
        <span className="vm-suggested-right">
          <span className="vm-suggested-count"><b>{list.length}</b> candidato{list.length === 1 ? "" : "s"}</span>
          <span className="pp-chevron pp-chevron--lg" aria-hidden="true" />
        </span>
      </button>

      {open && (
        <div className="vm-suggested-body">
          {list.length === 0 ? (
            <p className="vm-note">Por ahora no hay CVs que superen el {minScore}% de compatibilidad con esta vacante.</p>
          ) : (
            <>
              <ul className="vm-list">
                {pageItems.map((c, i) => {
                  const photo  = safeImg(c.photo);
                  const isOpen = detailId === c.userId;
                  return (
                    <li key={c.userId} className={`vm-row${isOpen ? " is-open" : ""}`}>
                      <span className="vm-rank">#{safePage * SUGGESTIONS_PAGE_SIZE + i + 1}</span>
                      {photo
                        ? <img className="vm-avatar" src={photo} alt="" loading="lazy" />
                        : <span className="vm-avatar vm-avatar--initials" aria-hidden="true">{initials(c.name)}</span>}
                      <div className="vm-id">
                        <span className="vm-name">{c.name}</span>
                        <span className="vm-sub">{[c.headline, c.location].filter(Boolean).join(" · ") || "Sin titular"}</span>
                      </div>
                      <ScoreBadge
                        candidate={c}
                        open={isOpen}
                        onToggle={() => setDetailId(isOpen ? null : c.userId)}
                      />
                      <div className="vm-row-actions">
                        <button type="button" className="pp-btn pp-btn--accent" onClick={() => onViewCv(c.userId, c.name)}>Ver CV</button>
                        <button type="button" className="pp-btn" onClick={() => onDownloadCv(c.userId, c.name)}>↓ PDF</button>
                      </div>
                      {isOpen && c.match && <div className="vm-row-detail"><MatchBreakdown m={c.match} /></div>}
                    </li>
                  );
                })}
              </ul>

              {totalPages > 1 && (
                <div className="pp-pager">
                  <button type="button" className="pp-btn pp-btn--sm" disabled={safePage === 0}
                    onClick={() => { setPage(safePage - 1); setDetailId(null); }}>
                    ← Anterior
                  </button>
                  <span className="pp-pager-info">{safePage + 1} / {totalPages}</span>
                  <button type="button" className="pp-btn pp-btn--sm" disabled={safePage >= totalPages - 1}
                    onClick={() => { setPage(safePage + 1); setDetailId(null); }}>
                    Siguiente →
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      )}
    </section>
  );
}