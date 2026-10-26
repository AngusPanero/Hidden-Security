import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { createPortal } from "react-dom"
import { UseTheme } from "../contexts/ThemeContext"
import "./learningProgress.css"

/* ══════════════════════════════════════════════════════════════
   LearningProgress — panel admin: alumnos en cursos y certificaciones
   Muestra progreso, intentos, mejor calificación y estado.
══════════════════════════════════════════════════════════════ */

// ─── Tipos (forma esperada de la respuesta del backend) ───
interface Attempt {
  id:          string
  startedAt:   string
  finishedAt?: string | null
  score:       number | null   // 0-100; null si quedó sin terminar
  passed:      boolean
  // passed | failed | expired | violation | in_progress | pending_close
  result?:            string | null
  terminationReason?: string | null
  durationSeconds?:   number | null
  // Solo intentos en curso
  expiresAt?:      string | null
  answered?:       number
  totalQuestions?: number
  focusStrikes?:   number
}

interface QuizSummary {
  module:   number
  score:    number | null      // 0-100
  passed:   boolean
  attempts: number
}

type Kind   = "course" | "certification"
type Status = "not_started" | "in_progress" | "completed" | "passed" | "failed"

interface Enrollment {
  uid:            string
  email:          string
  displayName?:   string
  programId:      string        // ej: "modernSoc", "socAnalyst"
  programName:    string        // ej: "SOC Operations", "SOC Analyst"
  kind:           Kind
  status?:        Status        // si no viene, se deriva en el front
  progress?:      number        // 0-100 (cursos)
  modulesDone?:   number
  modulesTotal?:  number
  attempts:       Attempt[]
  attemptsCount?: number        // total de intentos (en cursos: suma de quizzes)
  quizzes?:       QuizSummary[] // cursos: resultado por módulo
  bestScore?:     number | null // si no viene, se calcula de attempts
  passingScore?:  number        // por defecto 80
  enrolledAt:     string
  lastActivityAt?: string | null
}

// ─── Fuente de datos: cambiá solo esta función si tu auth/endpoint es otro ───
const API_URL = import.meta.env.VITE_API_URL ?? ""

async function fetchLearningProgress(signal?: AbortSignal): Promise<Enrollment[]> {
  const res = await fetch(`${API_URL}/admin/learning-progress`, {
    credentials: "include",
    signal,
  })
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  const data = await res.json()
  return Array.isArray(data) ? data : (data?.enrollments ?? [])
}

// ─── Constantes ───
const PAGE_SIZE        = 15
const DEFAULT_PASSING  = 80
const DISMISS_DISTANCE = 110

const KIND_LABELS: Record<Kind, string> = {
  course:        "Cursos",
  certification: "Certificaciones",
}

const STATUS_LABELS: Record<Status, string> = {
  not_started: "Sin iniciar",
  in_progress: "En curso",
  completed:   "Completado",
  passed:      "Aprobado",
  failed:      "Reprobado",
}

// Estados que tienen sentido en cada pestaña
const STATUS_BY_KIND: Record<Kind, Status[]> = {
  course:        ["in_progress", "completed", "not_started"],
  certification: ["in_progress", "passed", "failed", "not_started"],
}

type SortKey = "activity" | "score" | "attempts" | "progress" | "enrolled"
type SortDir = "desc" | "asc"

const SORT_LABELS: Record<SortKey, string> = {
  activity: "Última actividad",
  score:    "Mejor nota",
  attempts: "Intentos",
  progress: "Progreso",
  enrolled: "Inscripción",
}

const SORT_BY_KIND: Record<Kind, SortKey[]> = {
  course:        ["activity", "progress", "score", "attempts", "enrolled"],
  certification: ["activity", "score", "attempts", "enrolled"],
}

// ─── Helpers ───
const toTime = (d?: string | null) => {
  if (!d) return 0
  const t = new Date(d).getTime()
  return isNaN(t) ? 0 : t
}

const formatDate = (d?: string | null) => {
  const t = toTime(d)
  if (!t) return "—"
  return new Date(t).toLocaleDateString("es-AR", { day: "2-digit", month: "2-digit", year: "numeric" })
}

const formatDateTime = (d?: string | null) => {
  const t = toTime(d)
  if (!t) return "—"
  return new Date(t).toLocaleString("es-AR", {
    day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit",
  })
}

const formatRelative = (d?: string | null) => {
  const t = toTime(d)
  if (!t) return "Sin actividad"
  const min = Math.floor(Math.max(0, Date.now() - t) / 60_000)
  if (min < 1)  return "Recién"
  if (min < 60) return `Hace ${min} min`
  const h = Math.floor(min / 60)
  if (h < 24)   return `Hace ${h} h`
  const days = Math.floor(h / 24)
  if (days === 1) return "Ayer"
  if (days < 30)  return `Hace ${days} días`
  return formatDate(d)
}

const formatDuration = (a: Attempt) => {
  let min: number
  if (typeof a.durationSeconds === "number" && a.durationSeconds >= 0) {
    min = Math.round(a.durationSeconds / 60)
  } else {
    const start = toTime(a.startedAt)
    const end   = toTime(a.finishedAt)
    if (!start || !end || end < start) return "—"
    min = Math.round((end - start) / 60_000)
  }
  if (min < 60) return `${min} min`
  return `${Math.floor(min / 60)} h ${min % 60} min`
}

const normalize = (s?: string) =>
  (s ?? "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "")

const clampPct = (n?: number | null) =>
  typeof n === "number" && isFinite(n) ? Math.max(0, Math.min(100, Math.round(n))) : null

const getPassing = (e: Enrollment) => e.passingScore ?? DEFAULT_PASSING

const getAttemptsCount = (e: Enrollment) =>
  typeof e.attemptsCount === "number" ? e.attemptsCount : e.attempts.length

const getBestScore = (e: Enrollment): number | null => {
  if (typeof e.bestScore === "number") return e.bestScore
  const scores = e.attempts.map(a => a.score).filter((s): s is number => typeof s === "number")
  return scores.length ? Math.max(...scores) : null
}

const getProgress = (e: Enrollment): number | null => {
  if (typeof e.progress === "number") return clampPct(e.progress)
  if (e.modulesTotal && e.modulesTotal > 0)
    return clampPct(((e.modulesDone ?? 0) / e.modulesTotal) * 100)
  return null
}

// Si el backend no manda status, se deriva de los datos
const getStatus = (e: Enrollment): Status => {
  if (e.status) return e.status
  if (e.kind === "certification") {
    if (e.attempts.some(a => a.passed)) return "passed"
    if (e.attempts.some(a => !a.finishedAt)) return "in_progress"
    if (e.attempts.length > 0) return "failed"
    return "not_started"
  }
  const p = getProgress(e) ?? 0
  if (p >= 100) return "completed"
  if (p > 0 || e.attempts.length > 0) return "in_progress"
  return "not_started"
}

const statusTone = (s: Status) =>
  s === "passed" || s === "completed" ? "ok"
  : s === "failed" ? "error"
  : s === "in_progress" ? "warn"
  : "dim"

const enrollmentKey = (e: Enrollment) => `${e.uid}__${e.programId}`

// Etiqueta y color de cada rendición según el resultado guardado
const ATTEMPT_LABELS: Record<string, string> = {
  passed:        "APROBADO",
  failed:        "REPROBADO",
  expired:       "TIEMPO AGOTADO",
  violation:     "INFRACCIÓN",
  in_progress:   "EN CURSO",
  pending_close: "VENCIDO · SIN CERRAR",
}

const attemptResult = (a: Attempt) =>
  a.result ?? (!a.finishedAt ? "in_progress" : a.passed ? "passed" : "failed")

const attemptTone = (a: Attempt) => {
  const r = attemptResult(a)
  if (r === "passed") return "ok"
  if (r === "in_progress" || r === "pending_close") return "warn"
  return "error"
}

const attemptDetail = (a: Attempt) => {
  const r = attemptResult(a)
  if (r === "in_progress") {
    const parts: string[] = []
    if (a.totalQuestions) parts.push(`${a.answered ?? 0}/${a.totalQuestions} respondidas`)
    if (a.expiresAt) parts.push(`vence ${formatDateTime(a.expiresAt)}`)
    if (a.focusStrikes) parts.push(`${a.focusStrikes} salida${a.focusStrikes === 1 ? "" : "s"}`)
    return parts.join(" · ") || "Rindiendo ahora"
  }
  if (r === "violation" && a.terminationReason) return `Motivo: ${a.terminationReason}`
  return `Duración: ${formatDuration(a)}`
}

// ─── Barra (progreso o nota con marca de aprobación) ───
const Meter = ({ value, passing, tone }: { value: number | null; passing?: number; tone: string }) => (
  <div className="lp-meter" aria-hidden="true">
    <div className={`lp-meter-fill lp-meter-fill--${tone}`} style={{ width: `${value ?? 0}%` }} />
    {typeof passing === "number" && (
      <span className="lp-meter-mark" style={{ left: `${passing}%` }} />
    )}
  </div>
)

// ─── Detalle: bottom sheet en mobile, modal centrado en desktop ───
interface SheetProps {
  enrollment: Enrollment
  theme:      string
  onClose:    () => void
}

const EnrollmentSheet = ({ enrollment: e, theme, onClose }: SheetProps) => {
  const closeRef = useRef<HTMLButtonElement>(null)
  const startY   = useRef<number | null>(null)
  const [dragY, setDragY] = useState(0)

  useEffect(() => {
    const prev = document.body.style.overflow
    document.body.style.overflow = "hidden"
    const onKey = (ev: KeyboardEvent) => { if (ev.key === "Escape") onClose() }
    window.addEventListener("keydown", onKey)
    closeRef.current?.focus({ preventScroll: true })
    return () => {
      document.body.style.overflow = prev
      window.removeEventListener("keydown", onKey)
    }
  }, [onClose])

  const onTouchStart = (ev: React.TouchEvent) => { startY.current = ev.touches[0].clientY }
  const onTouchMove  = (ev: React.TouchEvent) => {
    if (startY.current === null) return
    setDragY(Math.max(0, ev.touches[0].clientY - startY.current))
  }
  const onTouchEnd   = () => {
    if (dragY > DISMISS_DISTANCE) onClose()
    else setDragY(0)
    startY.current = null
  }

  const status   = getStatus(e)
  const tone     = statusTone(status)
  const best     = getBestScore(e)
  const passing  = getPassing(e)
  const progress = getProgress(e)
  const isCert   = e.kind === "certification"
  const quizzes  = !isCert && e.quizzes?.length ? e.quizzes : null

  // Intentos del más nuevo al más viejo, numerados en orden cronológico
  const attempts = [...e.attempts]
    .sort((a, b) => toTime(a.startedAt) - toTime(b.startedAt))
    .map((a, i) => ({ ...a, n: i + 1 }))
    .reverse()

  return createPortal(
    <div className={`lp-modal-root ${theme}`} onClick={onClose}>
      <div
        className="lp-sheet"
        role="dialog"
        aria-modal="true"
        aria-labelledby="lp-sheet-title"
        onClick={ev => ev.stopPropagation()}
        style={dragY ? { transform: `translateY(${dragY}px)`, transition: "none" } : undefined}
      >
        <div className="lp-sheet-drag" onTouchStart={onTouchStart} onTouchMove={onTouchMove} onTouchEnd={onTouchEnd}>
          <span className="lp-sheet-handle" aria-hidden="true" />
          <header className="lp-sheet-header">
            <div className="lp-sheet-heading">
              <div className="lp-sheet-badges">
                <span className={`lp-kind lp-kind--${e.kind}`}>{e.programName}</span>
                <span className={`lp-status lp-status--${tone}`}>{STATUS_LABELS[status]}</span>
              </div>
              <h3 id="lp-sheet-title" className="lp-sheet-email">{e.email}</h3>
              {e.displayName && <span className="lp-sheet-sub">{e.displayName}</span>}
            </div>
            <button ref={closeRef} type="button" className="lp-sheet-close" onClick={onClose} aria-label="Cerrar detalle">
              ✕
            </button>
          </header>
        </div>

        <div className="lp-sheet-body">
          <div className="lp-detail">
            <div className="lp-detail-block">
              <span className="lp-detail-title">{isCert ? "Certificación" : "Progreso"}</span>
              {!isCert && (
                <>
                  <div className="lp-detail-meter">
                    <Meter value={progress} tone={tone} />
                    <strong>{progress !== null ? `${progress}%` : "—"}</strong>
                  </div>
                  {typeof e.modulesTotal === "number" && (
                    <div className="lp-detail-row"><span>Módulos</span><strong>{e.modulesDone ?? 0} / {e.modulesTotal}</strong></div>
                  )}
                </>
              )}
              <div className="lp-detail-row"><span>Inscripción</span><strong>{formatDateTime(e.enrolledAt)}</strong></div>
              <div className="lp-detail-row"><span>Última actividad</span><strong>{formatRelative(e.lastActivityAt)}</strong></div>
              <div className={`lp-detail-row lp-tone-text--${tone}`}><span>Estado</span><strong>{STATUS_LABELS[status]}</strong></div>
            </div>

            <div className="lp-detail-block">
              <span className="lp-detail-title">Calificación</span>
              <div className="lp-detail-meter">
                <Meter value={clampPct(best)} passing={isCert ? passing : undefined} tone={best !== null && best >= passing ? "ok" : best !== null ? "error" : "dim"} />
                <strong>{best !== null ? `${clampPct(best)}%` : "—"}</strong>
              </div>
              <div className="lp-detail-row"><span>Intentos</span><strong>{getAttemptsCount(e)}</strong></div>
              <div className="lp-detail-row"><span>{isCert ? "Mejor nota" : "Promedio quizzes"}</span><strong>{best !== null ? `${clampPct(best)}%` : "—"}</strong></div>
              {!isCert && <div className="lp-detail-row"><span>Nota mínima por quiz</span><strong>{passing}%</strong></div>}
              {isCert && <div className="lp-detail-row"><span>Nota de aprobación</span><strong>{passing}%</strong></div>}
            </div>

            <div className="lp-attempts">
              <span className="lp-detail-title">{quizzes ? "Quizzes por módulo" : "Historial de intentos"}</span>
              {quizzes ? (
                <ul className="lp-attempts-list">
                  {quizzes.map(q => {
                    const qTone = q.attempts === 0 ? "dim" : q.passed ? "ok" : "error"
                    return (
                      <li key={q.module} className={`lp-attempt lp-attempt--${qTone}`}>
                        <span className="lp-attempt-n">M{q.module}</span>
                        <div className="lp-attempt-info">
                          <strong>Módulo {q.module}</strong>
                          <span>{q.attempts} {q.attempts === 1 ? "intento" : "intentos"}</span>
                        </div>
                        <span className="lp-attempt-score">
                          {typeof q.score === "number" ? `${clampPct(q.score)}%` : "—"}
                        </span>
                        <span className={`lp-status lp-status--${qTone}`}>
                          {q.attempts === 0 ? "PENDIENTE" : q.passed ? "APROBADO" : "REPROBADO"}
                        </span>
                      </li>
                    )
                  })}
                </ul>
              ) : attempts.length === 0 ? (
                <p className="lp-attempts-empty">Todavía no hay intentos registrados.</p>
              ) : (
                <ul className="lp-attempts-list">
                  {attempts.map(a => {
                    const aTone = attemptTone(a)
                    return (
                      <li key={a.id} className={`lp-attempt lp-attempt--${aTone}`}>
                        <span className="lp-attempt-n">#{a.n}</span>
                        <div className="lp-attempt-info">
                          <strong>{formatDateTime(a.startedAt)}</strong>
                          <span>{attemptDetail(a)}</span>
                        </div>
                        <span className="lp-attempt-score">
                          {typeof a.score === "number" ? `${clampPct(a.score)}%` : "—"}
                        </span>
                        <span className={`lp-status lp-status--${aTone}`}>
                          {ATTEMPT_LABELS[attemptResult(a)] ?? "REPROBADO"}
                        </span>
                      </li>
                    )
                  })}
                </ul>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>,
    document.body
  )
}

// ─── Componente principal ───
const LearningProgress = () => {
  const { theme } = UseTheme()

  const [data, setData]       = useState<Enrollment[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError]     = useState<string | null>(null)
  const [reloadKey, setReloadKey] = useState(0)

  const [kind, setKind]           = useState<Kind>("course")
  const [program, setProgram]     = useState<string>("all")
  const [statuses, setStatuses]   = useState<Set<Status>>(new Set(STATUS_BY_KIND.course))
  const [search, setSearch]       = useState("")
  const [sortKey, setSortKey]     = useState<SortKey>("activity")
  const [sortDir, setSortDir]     = useState<SortDir>("desc")
  const [page, setPage]           = useState(1)
  const [selectedKey, setSelectedKey] = useState<string | null>(null)

  useEffect(() => {
    const ctrl = new AbortController()
    setLoading(true)
    setError(null)
    fetchLearningProgress(ctrl.signal)
      .then(setData)
      .catch(err => { if (err?.name !== "AbortError") setError("No se pudo cargar el progreso de los alumnos.") })
      .finally(() => { if (!ctrl.signal.aborted) setLoading(false) })
    return () => ctrl.abort()
  }, [reloadKey])

  // Al cambiar de pestaña se resetean los filtros que dependen del tipo
  const changeKind = (k: Kind) => {
    setKind(k)
    setProgram("all")
    setStatuses(new Set(STATUS_BY_KIND[k]))
    if (!SORT_BY_KIND[k].includes(sortKey)) setSortKey("activity")
  }

  const byKind = useMemo(() => data.filter(e => e.kind === kind), [data, kind])

  const programs = useMemo(() => {
    const map = new Map<string, string>()
    for (const e of byKind) map.set(e.programId, e.programName)
    return [...map.entries()]
  }, [byKind])

  const byProgram = useMemo(
    () => (program === "all" ? byKind : byKind.filter(e => e.programId === program)),
    [byKind, program]
  )

  // ── Resumen ──
  const stats = useMemo(() => {
    const students = new Set(byProgram.map(e => e.uid)).size
    let active = 0, done = 0, failed = 0, sumMetric = 0, nMetric = 0
    for (const e of byProgram) {
      const s = getStatus(e)
      if (s === "in_progress") active++
      if (s === "completed" || s === "passed") done++
      if (s === "failed") failed++
      const metric = kind === "course" ? getProgress(e) : getBestScore(e)
      if (typeof metric === "number") { sumMetric += metric; nMetric++ }
    }
    return {
      students, active, done, failed,
      avg: nMetric ? Math.round(sumMetric / nMetric) : null,
    }
  }, [byProgram, kind])

  const statusCounts = useMemo(() => {
    const c: Record<Status, number> = { not_started: 0, in_progress: 0, completed: 0, passed: 0, failed: 0 }
    for (const e of byProgram) c[getStatus(e)]++
    return c
  }, [byProgram])

  // ── Filtro + búsqueda + orden ──
  const filtered = useMemo(() => {
    const q = normalize(search.trim())
    const list = byProgram.filter(e => {
      if (!statuses.has(getStatus(e))) return false
      if (!q) return true
      return [e.email, e.displayName, e.programName].some(f => normalize(f).includes(q))
    })
    const factor = sortDir === "desc" ? -1 : 1
    const val = (e: Enrollment): number => {
      switch (sortKey) {
        case "score":    return getBestScore(e) ?? -1
        case "attempts": return getAttemptsCount(e)
        case "progress": return getProgress(e) ?? -1
        case "enrolled": return toTime(e.enrolledAt)
        default:         return toTime(e.lastActivityAt)
      }
    }
    return list.sort((a, b) => factor * (val(a) - val(b)))
  }, [byProgram, statuses, search, sortKey, sortDir])

  useEffect(() => { setPage(1) }, [kind, program, statuses, search, sortKey, sortDir])

  const totalPages = Math.ceil(filtered.length / PAGE_SIZE)
  const pageItems  = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)

  const selected = selectedKey ? data.find(e => enrollmentKey(e) === selectedKey) ?? null : null
  const closeSheet = useCallback(() => setSelectedKey(null), [])

  const toggleStatus = (s: Status) => {
    setStatuses(prev => {
      const next = new Set(prev)
      if (next.has(s)) next.delete(s)
      else next.add(s)
      return next
    })
  }

  const isCert = kind === "certification"

  return (
    <div className={`lp-container ${theme}`}>

      {/* ── Pestañas Cursos / Certificaciones ── */}
      <div className="lp-kinds" role="tablist">
        {(["course", "certification"] as Kind[]).map(k => (
          <button
            key={k}
            type="button"
            role="tab"
            aria-selected={kind === k}
            className={`lp-kind-tab${kind === k ? " active" : ""}`}
            onClick={() => changeKind(k)}
          >
            {KIND_LABELS[k]}
            <span className="lp-kind-count">{data.filter(e => e.kind === k).length}</span>
          </button>
        ))}
      </div>

      {/* ── Resumen ── */}
      <div className="lp-stats">
        <div className="lp-stat">
          <span className="lp-stat-label">Alumnos</span>
          <span className="lp-stat-value">{stats.students}</span>
        </div>
        <div className="lp-stat lp-stat-accent">
          <span className="lp-stat-label">{isCert ? "Rindiendo" : "Cursando"}</span>
          <span className="lp-stat-value">{stats.active}</span>
        </div>
        <div className="lp-stat">
          <span className="lp-stat-label">{isCert ? "Aprobados" : "Completados"}</span>
          <span className="lp-stat-value lp-stat-value--ok">{stats.done}</span>
        </div>
        <div className="lp-stat">
          <span className="lp-stat-label">{isCert ? "Nota prom." : "Progreso prom."}</span>
          <span className="lp-stat-value">{stats.avg !== null ? `${stats.avg}%` : "—"}</span>
        </div>
      </div>

      {/* ── Programa ── */}
      {programs.length > 1 && (
        <div className="lp-programs">
          <button
            type="button"
            className={`lp-chip${program === "all" ? " active" : ""}`}
            onClick={() => setProgram("all")}
          >
            Todos
          </button>
          {programs.map(([id, name]) => (
            <button
              key={id}
              type="button"
              className={`lp-chip${program === id ? " active" : ""}`}
              onClick={() => setProgram(id)}
            >
              {name}
            </button>
          ))}
        </div>
      )}

      {/* ── Estados (multi-selección) ── */}
      <div className="lp-filters">
        {STATUS_BY_KIND[kind].map(s => (
          <button
            key={s}
            type="button"
            className={`lp-filter lp-filter--${statusTone(s)}${statuses.has(s) ? " active" : ""}`}
            onClick={() => toggleStatus(s)}
            aria-pressed={statuses.has(s)}
          >
            <span className="lp-filter-box" />
            {STATUS_LABELS[s]}
            <span className="lp-filter-count">{statusCounts[s]}</span>
          </button>
        ))}
      </div>

      {/* ── Búsqueda + orden ── */}
      <div className="lp-toolbar">
        <input
          type="search"
          className="lp-search-input"
          placeholder="Buscar por nombre, email o programa…"
          value={search}
          onChange={ev => setSearch(ev.target.value)}
          aria-label="Buscar alumnos"
        />
        <div className="lp-sort">
          <select
            className="lp-sort-select"
            value={sortKey}
            onChange={ev => setSortKey(ev.target.value as SortKey)}
            aria-label="Ordenar por"
          >
            {SORT_BY_KIND[kind].map(k => (
              <option key={k} value={k}>{SORT_LABELS[k]}</option>
            ))}
          </select>
          <button
            type="button"
            className="lp-sort-btn"
            onClick={() => setSortDir(d => (d === "desc" ? "asc" : "desc"))}
            aria-label={`Orden ${sortDir === "desc" ? "descendente" : "ascendente"}. Tocar para invertir.`}
            title="Invertir orden"
          >
            <span className={`lp-sort-arrow${sortDir === "asc" ? " lp-sort-arrow--up" : ""}`} aria-hidden="true">↓</span>
          </button>
        </div>
      </div>

      {/* ── Lista ── */}
      {loading ? (
        <div className="lp-empty-state"><span className="lp-loader" aria-hidden="true" /><p>CARGANDO_PROGRESO</p></div>
      ) : error ? (
        <div className="lp-empty-state lp-empty-state--error">
          <p>{error}</p>
          <button type="button" className="lp-btn" onClick={() => setReloadKey(k => k + 1)}>Reintentar</button>
        </div>
      ) : filtered.length === 0 ? (
        <div className="lp-empty-state">
          <span className="lp-empty-icon">◫</span>
          <p>NINGÚN_ALUMNO_COINCIDE</p>
        </div>
      ) : (
        <div className="lp-list">
          {pageItems.map(e => {
            const status   = getStatus(e)
            const tone     = statusTone(status)
            const best     = getBestScore(e)
            const passing  = getPassing(e)
            const progress = getProgress(e)
            const meterVal = isCert ? clampPct(best) : progress
            const meterTone = isCert
              ? (best === null ? "dim" : best >= passing ? "ok" : "error")
              : tone

            return (
              <div key={enrollmentKey(e)} className={`lp-wrapper lp-tone-${tone}`}>
                <button
                  type="button"
                  className="lp-row"
                  onClick={() => setSelectedKey(enrollmentKey(e))}
                  aria-haspopup="dialog"
                  aria-label={`Ver detalle de ${e.email} en ${e.programName}`}
                >
                  <div className="lp-row-main">
                    <span className="lp-row-email">{e.email}</span>
                    <span className="lp-row-meta">
                      {e.programName}
                      <span className="lp-row-sep" aria-hidden="true">·</span>
                      {formatRelative(e.lastActivityAt)}
                    </span>
                  </div>

                  <div className="lp-row-meter">
                    <Meter value={meterVal} passing={isCert ? passing : undefined} tone={meterTone} />
                    <span className="lp-row-meter-label">
                      {isCert
                        ? (best !== null ? `Mejor: ${clampPct(best)}%` : "Sin nota")
                        : (progress !== null ? `${progress}%` : "—")}
                    </span>
                  </div>

                  <div className="lp-row-right">
                    <span className="lp-pill">
                      {getAttemptsCount(e)} {getAttemptsCount(e) === 1 ? "intento" : "intentos"}
                    </span>
                    {!isCert && best !== null && (
                      <span className="lp-pill">Prom. {clampPct(best)}%</span>
                    )}
                    <span className={`lp-status lp-status--${tone}`}>{STATUS_LABELS[status]}</span>
                    <span className="lp-chevron" aria-hidden="true">›</span>
                  </div>
                </button>
              </div>
            )
          })}
        </div>
      )}

      {/* ── Paginación ── */}
      {!loading && !error && totalPages > 1 && (
        <div className="lp-pagination">
          <button type="button" className="lp-page-btn" onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}>
            ← Anterior
          </button>
          <span className="lp-page-info">
            {page} / {totalPages}
            <span className="lp-page-total"> · {filtered.length} inscripciones</span>
          </span>
          <button type="button" className="lp-page-btn" onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages}>
            Siguiente →
          </button>
        </div>
      )}

      {selected && <EnrollmentSheet enrollment={selected} theme={theme} onClose={closeSheet} />}
    </div>
  )
}

export default LearningProgress