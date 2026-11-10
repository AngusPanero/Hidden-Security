import { useCallback, useEffect, useMemo, useState } from "react";
import axios from "axios";
import "./partnerPool.css";
import { UseTheme } from "../contexts/ThemeContext"; 

// ══════════════════════════════════════════════════════════════════════
//  PartnerPool — AdminDashboard
//  · MÉTRICAS: consumo en vivo de cursos externos por empresa
//  · LIQUIDACIONES: cálculo mensual PP_V1.2, aprobación, ajustes, pagos y auditoría
//  · DURACIONES: duración formativa por versión de curso (la estima el código,
//    la aprueba Hidden). Define la ponderación de cada curso en el reparto.
//  Todo lo calcula el backend; acá solo se muestra y se disparan acciones.
// ══════════════════════════════════════════════════════════════════════

const API_URL = import.meta.env.VITE_API_URL;
const BASE = `${API_URL}/api/external-courses/admin/partner-pool`;
const http = axios.create({ withCredentials: true });

// ─── Tipos: métricas en vivo ──────────────────────────────────────────
interface CourseMetrics {
    courseId: string;
    title: string;
    status: string;
    courseWeight: number;
    started: number;
    stepsCompleted: number;
    eligibleSteps: number;
    weightedUnits: number;
    completions: number;
    quizAttempts: number;
    quizPassed: number;
    avgQuizScore: number | null;
    allTimeStarted: number;
    allTimeCompleted: number;
}

interface PartnerMetrics {
    partnerId: string;
    slug: string;
    code: string;
    name: string;
    logoUrl: string;
    status: "ACTIVE" | "INACTIVE" | "SUSPENDED";
    poolEnabled: boolean;
    students: number;
    started: number;
    stepsCompleted: number;
    eligibleSteps: number;
    weightedUnits: number;
    completions: number;
    quizAttempts: number;
    quizPassed: number;
    avgQuizScore: number | null;
    allTimeStarted: number;
    allTimeCompleted: number;
    poolShare: number;
    courses: CourseMetrics[];
}

interface MetricsResponse {
    period: { from: string; to: string };
    totals: {
        partners: number;
        activePartners: number;
        students: number;
        eligibleSteps: number;
        weightedUnits: number;
        completions: number;
    };
    partners: PartnerMetrics[];
}

// ─── Tipos: liquidaciones ─────────────────────────────────────────────
type PeriodStatus = "OPEN" | "CALCULATING" | "CALCULATED" | "APPROVED" | "CLOSED";
type SettlementStatus = "DRAFT" | "CALCULATED" | "APPROVED" | "PAID" | "CANCELLED";

interface PeriodDoc {
    period: string;
    status: PeriodStatus;
    formulaVersion?: string;
    range: { from: string; to: string };
    configuration?: {
        maximumPoolRate: number;
        progressWeight: number;
        completionWeight: number;
        consumptionTargetRate: number;
        enablementStrategy: string;
    };
    financials?: {
        eligibleNetTrainingRevenue: number | null;
        maximumPoolAmount: number | null;
        enabledPoolAmount: number | null;
    };
    revenueBreakdown?: {
        activePlans: number;
        planCounts: Record<string, number>;
        discountedPlans: number;
        excludedFreePayments: number;
        excludedStaffPlans: number;
        basePlan: string;
        basePlanPrice: number | null;
        mpFeeRate: number | null;
        grossAmount: number | null;
        feesAmount: number | null;
    };
    durationWeighting?: {
        referenceHours: number | null;
        referenceCourses: { courseId: string; courseVersion: number; title: string; partnerName: string }[];
        courses: {
            courseId: string;
            courseVersion: number;
            title: string;
            partnerName: string;
            approvedHours: number | null;
            weightPct: number | null;
            baseScore: number;
            weightedScore: number;
            isReference: boolean;
        }[];
        totalBaseScore: number | null;
        totalWeightedScore: number | null;
        requiresReview: boolean;
        missingDurations: { courseId: string; courseVersion: number; title: string; partnerName?: string; reason: string }[];
    };
    metrics?: {
        eligibleSubscriptions: number;
        uniqueEligibleConsumers: number;
        participatingCourses: number;
        participatingPartners: number;
        totalConsumptionScore: number | null;
        consumptionTarget: number | null;
        enablementFactor: number | null;
    };
    calculatedAt?: string | null;
    approvedAt?: string | null;
    closedAt?: string | null;
}

interface Adjustment {
    adjustmentId: string;
    type: "CREDIT" | "DEBIT";
    amount: number;
    reason: string;
    createdBy: string;
    createdAt: string;
}

interface Settlement {
    settlementId: string;
    period: string;
    partnerId: string;
    partnerSnapshot: { code: string; name: string; email: string };
    courses: {
        courseId: string;
        courseVersion: number;
        title: string;
        enrollments: number;
        uniqueConsumers: number;
        completions: number;
        consumptionScore: number; // puntos base
        approvedHours?: number | null;
        weightPct?: number | null;
        weightedScore?: number | null;
    }[];
    partnerBaseScore?: number | null;
    partnerScore: number; // puntos ponderados (definen la participación)
    globalBaseScore?: number | null;
    globalScore: number; // ponderados de todos los partners
    referenceHours?: number | null;
    partnerShare: number;
    enabledPoolAmount: number;
    settlementAmount: number;
    adjustments: Adjustment[];
    finalAmount: number;
    status: SettlementStatus;
    paidAt: string | null;
    paymentReference: string | null;
    cancelReason: string | null;
}

interface AuditLog {
    logId: string;
    action: string;
    settlementId: string | null;
    adminEmail: string | null;
    adminUserId: string;
    metadata: Record<string, unknown>;
    occurredAt: string;
}

interface PeriodDetail {
    period: PeriodDoc;
    canCalculate: boolean;
    settlements: Settlement[];
    auditLogs: AuditLog[];
    warnings?: {
        unknownVersions: string[];
        nonEligibleEvents: number;
        excludedAccessEvents: number;
        missingDurations?: { courseId: string; courseVersion: number; title: string }[];
    };
}

interface PeriodSummary {
    period: string;
    status: PeriodStatus;
    enabledPoolAmount: number | null;
    settlements: number;
    paid: number;
    totalFinal: number | null;
}

// ─── Tipos: duraciones ────────────────────────────────────────────────
type DurationStatus =
    | "PENDING_MEASUREMENT"
    | "MEASURING"
    | "PENDING_REVIEW"
    | "APPROVED"
    | "REJECTED"
    | "MEASUREMENT_FAILED";

interface DurationEstimate {
    videoHours: number | null;
    readingHours: number | null;
    assessmentHours: number | null;
    practiceHours: number | null;
    totalHours: number | null;
    explanation?: string[];
    estimatedAt?: string | null;
}

interface DurationSummary {
    courseId: string;
    version: number;
    partnerSlug: string;
    title: string;
    status: DurationStatus;
    contentChanged: boolean;
    estimate: DurationEstimate;
    approved: { hours: number | null; source: string | null; justification: string | null; approvedByEmail: string | null; approvedAt: string | null };
    measured?: { totals: { videoSeconds: number; pages: number; words: number; questions: number; duplicates: number }; warnings: string[] };
    measurementError: string | null;
    isPublished: boolean;
    updatedAt: string;
}

interface DurationDetail extends DurationSummary {
    measured: {
        videos: { stepId: string; title: string; seconds: number | null; source: "MEASURED" | "DECLARED" | "UNKNOWN"; note: string | null }[];
        documents: { stepId: string; title: string; pages: number; words: number; duplicateOf: string | null; similarity: number | null; note: string | null }[];
        quizzes: { stepId: string; title: string; questions: number }[];
        totals: { videoSeconds: number; pages: number; words: number; questions: number; duplicates: number };
        warnings: string[];
        measuredAt: string | null;
    };
    history: { action: string; hours: number | null; byEmail: string | null; by: string; at: string; reason: string | null }[];
}

// ─── Helpers ──────────────────────────────────────────────────────────
const monthStr = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
const currentMonth = () => monthStr(new Date());
const previousMonth = () => {
    const d = new Date();
    d.setDate(1);
    d.setMonth(d.getMonth() - 1);
    return monthStr(d);
};

const monthRange = (month: string) => {
    const [y, m] = month.split("-").map(Number);
    return { from: new Date(y, m - 1, 1), to: new Date(y, m, 1) };
};

const monthLabel = (month: string) => {
    const [y, m] = month.split("-").map(Number);
    return new Date(y, m - 1, 1).toLocaleDateString("es-AR", { month: "long", year: "numeric" });
};

const fmtInt = (n: number | null | undefined) => (n == null ? "—" : n.toLocaleString("es-AR"));
const fmtPct = (n: number | null | undefined) => (n == null ? "—" : `${Math.round(n * 1000) / 10}%`);
const fmtScore = (n: number | null | undefined) =>
    n == null ? "—" : n.toLocaleString("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 4 });
const fmtMoney = (n: number | null | undefined) =>
    n == null
        ? "—"
        : n.toLocaleString("es-AR", { style: "currency", currency: "ARS", minimumFractionDigits: 2, maximumFractionDigits: 2 });
const fmtDate = (s: string | null | undefined) =>
    s ? new Date(s).toLocaleString("es-AR", { dateStyle: "short", timeStyle: "short" }) : "—";

const errMsg = (err: any, fallback: string) => err?.response?.data?.error ?? fallback;
const fmtHours = (n: number | null | undefined) =>
    n == null ? "—" : `${n.toLocaleString("es-AR", { minimumFractionDigits: 0, maximumFractionDigits: 2 })} h`;
const fmtMinutes = (sec: number | null | undefined) => (sec == null ? "—" : `${Math.round(sec / 60)} min`);

// Búsqueda por nombre de empresa o de curso: sin mayúsculas ni tildes.
// Filtra lo que ya está cargado en pantalla (no consulta al backend).
const normalizeSearch = (v: string | null | undefined) =>
    String(v ?? "")
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .trim();
const matchesSearch = (query: string, ...fields: (string | null | undefined)[]) => {
    const q = normalizeSearch(query);
    return !q || fields.some((f) => normalizeSearch(f).includes(q));
};

const PARTNER_STATUS: Record<PartnerMetrics["status"], string> = {
    ACTIVE: "ACTIVA",
    INACTIVE: "INACTIVA",
    SUSPENDED: "SUSPENDIDA",
};

const PERIOD_STATUS: Record<PeriodStatus, string> = {
    OPEN: "ABIERTO",
    CALCULATING: "CALCULANDO",
    CALCULATED: "CALCULADO",
    APPROVED: "APROBADO",
    CLOSED: "CERRADO",
};

const SETTLEMENT_STATUS: Record<SettlementStatus, string> = {
    DRAFT: "BORRADOR",
    CALCULATED: "CALCULADA",
    APPROVED: "APROBADA",
    PAID: "PAGADA",
    CANCELLED: "CANCELADA",
};

const AUDIT_LABEL: Record<string, string> = {
    CALCULATED: "Calculado",
    APPROVED: "Aprobado",
    ADJUSTED: "Ajuste",
    CLOSED: "Cerrado",
    PAID: "Pagado",
    REOPENED: "Reabierto",
    CANCELLED: "Cancelado",
    CONFIG_UPDATED: "Configuración",
    DURATION_MEASURED: "Duración medida",
    DURATION_MEASUREMENT_REQUESTED: "Medición pedida",
    DURATION_APPROVED: "Duración aprobada",
    DURATION_REJECTED: "Duración rechazada",
    DURATION_INHERITED: "Duración heredada",
    DURATION_CONTENT_CHANGED: "Contenido cambiado",
    DURATION_CONTENT_CONFIRMED: "Contenido confirmado",
};

const DURATION_STATUS: Record<DurationStatus, string> = {
    PENDING_MEASUREMENT: "POR MEDIR",
    MEASURING: "MIDIENDO",
    PENDING_REVIEW: "PARA REVISAR",
    APPROVED: "APROBADA",
    REJECTED: "RECHAZADA",
    MEASUREMENT_FAILED: "FALLÓ LA MEDICIÓN",
};

const HISTORY_LABEL: Record<string, string> = {
    REGISTERED: "Registrada",
    MEASURED: "Medida",
    MEASUREMENT_FAILED: "Falló la medición",
    MEASUREMENT_REQUESTED: "Medición pedida",
    APPROVED: "Aprobada",
    REJECTED: "Rechazada",
    INHERITED: "Heredada",
    CONTENT_CHANGED: "Cambió el contenido",
    CONTENT_CONFIRMED: "Contenido confirmado",
};

const SOURCE_LABEL: Record<string, string> = {
    ESTIMATE: "estimación del sistema",
    MODIFIED: "modificada por Hidden",
    INHERITED: "heredada de la versión anterior",
};

const Dots = () => (
    <div className="pp-loading">
        <span className="pp-loading-dot" />
        <span className="pp-loading-dot" />
        <span className="pp-loading-dot" />
    </div>
);

// ══════════════════════════════════════════════════════════════════════
//  VISTA: MÉTRICAS EN VIVO
// ══════════════════════════════════════════════════════════════════════
function MetricsView() {
    const [month, setMonth] = useState(currentMonth);
    const [search, setSearch] = useState("");
    const [data, setData] = useState<MetricsResponse | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [open, setOpen] = useState<Set<string>>(new Set());

    const fetchMetrics = useCallback(async () => {
        if (!month) return;
        setLoading(true);
        setError("");
        try {
            const { from, to } = monthRange(month);
            const { data: res } = await http.get<MetricsResponse>(BASE, {
                params: { from: from.toISOString(), to: to.toISOString() },
            });
            setData(res);
        } catch (err) {
            setData(null);
            setError(errMsg(err, "No se pudieron cargar las métricas."));
        } finally {
            setLoading(false);
        }
    }, [month]);

    useEffect(() => {
        fetchMetrics();
    }, [fetchMetrics]);

    const toggle = (id: string) =>
        setOpen((prev) => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
        });

    const visiblePartners = (data?.partners ?? []).filter(
        (p) =>
            matchesSearch(search, p.name, p.code, p.slug) ||
            p.courses.some((c) => matchesSearch(search, c.title, c.courseId))
    );

    return (
        <>
            <div className="pp-toolbar">
                <p className="pp-sub">Consumo de cursos externos por empresa · {monthLabel(month || currentMonth())}</p>
                <div className="pp-controls">
                    <label className="pp-field">
                        <span className="pp-field-label">// PERÍODO</span>
                        <input
                            type="month"
                            className="pp-input"
                            value={month}
                            max={currentMonth()}
                            onChange={(e) => setMonth(e.target.value)}
                        />
                    </label>
                    <label className="pp-field">
                        <span className="pp-field-label">// BUSCAR</span>
                        <input
                            type="search"
                            className="pp-input pp-search"
                            placeholder="Empresa o curso…"
                            maxLength={80}
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                        />
                    </label>
                    <button className="pp-btn pp-btn--ghost" onClick={fetchMetrics} disabled={loading}>
                        {loading ? "CARGANDO..." : "↻ ACTUALIZAR"}
                    </button>
                </div>
            </div>

            {loading && !data && <Dots />}
            {error && <div className="pp-error">{error}</div>}

            {data && (
                <>
                    <div className="pp-kpis">
                        <div className="pp-kpi">
                            <span className="pp-kpi-label">// EMPRESAS ACTIVAS</span>
                            <span className="pp-kpi-value">
                                {data.totals.activePartners}
                                <small>/{data.totals.partners}</small>
                            </span>
                        </div>
                        <div className="pp-kpi">
                            <span className="pp-kpi-label">// ALUMNOS</span>
                            <span className="pp-kpi-value">{fmtInt(data.totals.students)}</span>
                        </div>
                        <div className="pp-kpi">
                            <span className="pp-kpi-label">// PASOS ELEGIBLES</span>
                            <span className="pp-kpi-value">{fmtInt(data.totals.eligibleSteps)}</span>
                        </div>
                        <div className="pp-kpi">
                            <span className="pp-kpi-label">// CURSOS COMPLETADOS</span>
                            <span className="pp-kpi-value">{fmtInt(data.totals.completions)}</span>
                        </div>
                    </div>

                    <p className="pp-note">
                        Vista en vivo para seguir el mes. La participación se aproxima por pasos elegibles; el monto
                        real de cada empresa sale de la pestaña Liquidaciones, cuando se calcula el período cerrado.
                        Los accesos de administradores y de prueba no cuentan.
                    </p>

                    {data.partners.length === 0 ? (
                        <div className="pp-empty">Todavía no hay empresas partner cargadas.</div>
                    ) : (
                        <div className="pp-partners">
                            {visiblePartners.length === 0 && (
                                <div className="pp-empty">Ninguna empresa ni curso coincide con “{search}”.</div>
                            )}
                            {visiblePartners.map((p) => {
                                // Si la empresa coincide se ven todos sus cursos; si no, solo los que coinciden
                                const partnerHit = matchesSearch(search, p.name, p.code, p.slug);
                                const courses = partnerHit
                                    ? p.courses
                                    : p.courses.filter((c) => matchesSearch(search, c.title, c.courseId));
                                const isOpen = open.has(p.partnerId) || (!!search.trim() && !partnerHit);
                                return (
                                    <div
                                        key={p.partnerId}
                                        className={`pp-partner${isOpen ? " expanded" : ""}${p.poolEnabled ? "" : " disabled"}`}
                                    >
                                        <button className="pp-partner-header" onClick={() => toggle(p.partnerId)}>
                                            <span className="pp-partner-id">
                                                {p.logoUrl ? (
                                                    <img src={p.logoUrl} alt="" />
                                                ) : (
                                                    <span className="pp-partner-icon">▣</span>
                                                )}
                                                <span>
                                                    <span className="pp-partner-name">{p.name}</span>
                                                    <span className="pp-partner-code">
                                                        {p.code} · {PARTNER_STATUS[p.status]}
                                                        {!p.poolEnabled && " · FUERA DEL POOL"}
                                                    </span>
                                                </span>
                                            </span>
                                            <span className="pp-share">
                                                <span className="pp-share-value">{fmtPct(p.poolShare)}</span>
                                                <span className="pp-share-bar">
                                                    <span
                                                        className="pp-share-fill"
                                                        style={{ width: `${Math.round(p.poolShare * 100)}%` }}
                                                    />
                                                </span>
                                            </span>
                                            <span className="pp-chevron">{isOpen ? "▲" : "▼"}</span>
                                        </button>

                                        <div className="pp-stats">
                                            <Stat label="ALUMNOS" value={fmtInt(p.students)} />
                                            <Stat label="INSCRIPCIONES" value={fmtInt(p.started)} />
                                            <Stat
                                                label="PASOS ELEGIBLES"
                                                value={fmtInt(p.eligibleSteps)}
                                                small={`/${fmtInt(p.stepsCompleted)}`}
                                            />
                                            <Stat label="UNIDADES" value={fmtInt(p.weightedUnits)} />
                                            <Stat label="COMPLETADOS" value={fmtInt(p.completions)} />
                                            <Stat label="PROMEDIO QUIZ" value={fmtPct(p.avgQuizScore)} />
                                        </div>

                                        {isOpen && (
                                            <div className="pp-partner-body">
                                                <p className="pp-body-title">// CURSOS</p>
                                                {courses.length === 0 ? (
                                                    <p className="pp-muted">Sin cursos cargados.</p>
                                                ) : (
                                                    <div className="pp-table-wrap">
                                                        <table className="pp-table">
                                                            <thead>
                                                                <tr>
                                                                    <th>Curso</th>
                                                                    <th>Inscripciones</th>
                                                                    <th>Pasos elegibles</th>
                                                                    <th>Completados</th>
                                                                    <th>Quizzes aprobados</th>
                                                                    <th>Promedio quiz</th>
                                                                    <th>Histórico</th>
                                                                </tr>
                                                            </thead>
                                                            <tbody>
                                                                {courses.map((c) => (
                                                                    <tr key={c.courseId}>
                                                                        <td>
                                                                            <span className="pp-course-title">{c.title}</span>
                                                                            <span className="pp-course-id">
                                                                                {c.courseId}
                                                                                {c.status !== "ACTIVE" && ` · ${c.status}`}
                                                                            </span>
                                                                        </td>
                                                                        <td>{fmtInt(c.started)}</td>
                                                                        <td>
                                                                            {fmtInt(c.eligibleSteps)}
                                                                            <span className="pp-muted"> / {fmtInt(c.stepsCompleted)}</span>
                                                                        </td>
                                                                        <td>{fmtInt(c.completions)}</td>
                                                                        <td>
                                                                            {fmtInt(c.quizPassed)}
                                                                            <span className="pp-muted"> / {fmtInt(c.quizAttempts)} intentos</span>
                                                                        </td>
                                                                        <td>{fmtPct(c.avgQuizScore)}</td>
                                                                        <td>
                                                                            {fmtInt(c.allTimeCompleted)}
                                                                            <span className="pp-muted"> / {fmtInt(c.allTimeStarted)}</span>
                                                                        </td>
                                                                    </tr>
                                                                ))}
                                                            </tbody>
                                                        </table>
                                                    </div>
                                                )}
                                                <p className="pp-muted pp-legend">
                                                    Pasos elegibles / total completados · Quizzes aprobados / intentos ·
                                                    Histórico = egresados / inscriptos desde siempre.
                                                </p>
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </>
            )}
        </>
    );
}

const Stat = ({ label, value, small, accent }: { label: string; value: string; small?: string; accent?: boolean }) => (
    <div className={`pp-stat${accent ? " pp-stat--accent" : ""}`}>
        <span className="pp-stat-label">// {label}</span>
        <span className="pp-stat-value">
            {value}
            {small && <small>{small}</small>}
        </span>
    </div>
);

// ══════════════════════════════════════════════════════════════════════
//  VISTA: LIQUIDACIONES
// ══════════════════════════════════════════════════════════════════════
function SettlementsView() {
    const [month, setMonth] = useState(previousMonth);
    const [search, setSearch] = useState("");
    const [detail, setDetail] = useState<PeriodDetail | null>(null);
    const [history, setHistory] = useState<PeriodSummary[]>([]);
    const [loading, setLoading] = useState(true);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState("");
    const [notice, setNotice] = useState("");
    const [reopening, setReopening] = useState(false);
    const [reopenReason, setReopenReason] = useState("");
    const [open, setOpen] = useState<Set<string>>(new Set());

    const loadHistory = useCallback(async () => {
        try {
            const { data } = await http.get<{ periods: PeriodSummary[] }>(`${BASE}/periods`);
            setHistory(data.periods);
        } catch {
            /* el historial es secundario */
        }
    }, []);

    const loadDetail = useCallback(async () => {
        if (!month) return;
        setLoading(true);
        setError("");
        try {
            const { data } = await http.get<PeriodDetail>(`${BASE}/periods/${month}`);
            setDetail(data);
        } catch (err) {
            setDetail(null);
            setError(errMsg(err, "No se pudo cargar el período."));
        } finally {
            setLoading(false);
        }
    }, [month]);

    useEffect(() => {
        loadDetail();
        setReopening(false);
        setNotice("");
    }, [loadDetail]);

    useEffect(() => {
        loadHistory();
    }, [loadHistory]);

    // Todas las acciones devuelven el detalle actualizado del período
    const run = async (path: string, body?: unknown, confirmText?: string) => {
        if (busy) return false;
        if (confirmText && !window.confirm(confirmText)) return false;
        setBusy(true);
        setError("");
        setNotice("");
        try {
            const { data } = await http.post<PeriodDetail>(`${BASE}/${path}`, body ?? {});
            setDetail(data);
            loadHistory();
            const w = data.warnings;
            const notices: string[] = [];
            if (w?.unknownVersions?.length) {
                notices.push(`Hay eventos de versiones de curso desconocidas (${w.unknownVersions.join(", ")}); no se contaron.`);
            }
            if (w?.missingDurations?.length) {
                notices.push(
                    `Hay cursos con consumo y sin duración aprobada (${w.missingDurations
                        .map((m) => `${m.title} v${m.courseVersion}`)
                        .join(", ")}). Aprobalas en DURACIONES y recalculá.`
                );
            }
            if (notices.length) setNotice(notices.join(" "));
            return true;
        } catch (err) {
            setError(errMsg(err, "No se pudo completar la acción."));
            return false;
        } finally {
            setBusy(false);
        }
    };

    const p = detail?.period;
    const calculated = !!p && ["CALCULATED", "APPROVED", "CLOSED"].includes(p.status);
    const activeSettlements = useMemo(
        () => (detail?.settlements ?? []).filter((s) => s.status !== "CANCELLED"),
        [detail]
    );
    const totalFinal = activeSettlements.reduce((acc, s) => acc + s.finalAmount, 0);
    const visibleSettlements = (detail?.settlements ?? []).filter(
        (s) =>
            matchesSearch(search, s.partnerSnapshot.name, s.partnerSnapshot.code, s.settlementId) ||
            s.courses.some((c) => matchesSearch(search, c.title, c.courseId))
    );

    const toggle = (id: string) =>
        setOpen((prev) => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
        });

    return (
        <>
            <div className="pp-toolbar">
                <p className="pp-sub">Liquidación mensual del Partner Pool · fórmula PP_V1.2 (ponderación por duración formativa)</p>
                <div className="pp-controls">
                    <label className="pp-field">
                        <span className="pp-field-label">// PERÍODO</span>
                        <input
                            type="month"
                            className="pp-input"
                            value={month}
                            max={currentMonth()}
                            onChange={(e) => setMonth(e.target.value)}
                        />
                    </label>
                    <label className="pp-field">
                        <span className="pp-field-label">// BUSCAR</span>
                        <input
                            type="search"
                            className="pp-input pp-search"
                            placeholder="Empresa o curso…"
                            maxLength={80}
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                        />
                    </label>
                    <button className="pp-btn pp-btn--ghost" onClick={loadDetail} disabled={loading || busy}>
                        ↻ ACTUALIZAR
                    </button>
                </div>
            </div>

            {history.length > 0 && (
                <div className="pp-history">
                    {history.map((h) => (
                        <button
                            key={h.period}
                            className={`pp-history-item${h.period === month ? " active" : ""}`}
                            onClick={() => setMonth(h.period)}
                        >
                            <span className="pp-history-month">{monthLabel(h.period)}</span>
                            <span className={`pp-chip pp-chip--${h.status.toLowerCase()}`}>{PERIOD_STATUS[h.status]}</span>
                            <span className="pp-history-amount">{fmtMoney(h.totalFinal)}</span>
                            {h.settlements > 0 && (
                                <span className="pp-muted pp-history-paid">
                                    {h.paid}/{h.settlements} pagadas
                                </span>
                            )}
                        </button>
                    ))}
                </div>
            )}

            {loading && !detail && <Dots />}
            {error && <div className="pp-error">{error}</div>}
            {notice && <div className="pp-warning">{notice}</div>}

            {p && (
                <>
                    {/* Estado y acciones del período */}
                    <div className="pp-period">
                        <div className="pp-period-head">
                            <div>
                                <span className="pp-eyebrow">// PERÍODO {p.period}</span>
                                <h3 className="pp-period-title">{monthLabel(p.period)}</h3>
                                <span className={`pp-chip pp-chip--${p.status.toLowerCase()}`}>{PERIOD_STATUS[p.status]}</span>
                                {p.calculatedAt && (
                                    <span className="pp-muted pp-period-date"> · calculado {fmtDate(p.calculatedAt)}</span>
                                )}
                                {p.approvedAt && (
                                    <span className="pp-muted pp-period-date"> · aprobado {fmtDate(p.approvedAt)}</span>
                                )}
                                {p.closedAt && <span className="pp-muted pp-period-date"> · cerrado {fmtDate(p.closedAt)}</span>}
                            </div>

                            <div className="pp-actions">
                                {(p.status === "OPEN" || p.status === "CALCULATED") && (
                                    <button
                                        className="pp-btn pp-btn--accent"
                                        disabled={busy || !detail?.canCalculate}
                                        onClick={() => run(`periods/${p.period}/calculate`)}
                                    >
                                        {busy ? "PROCESANDO..." : p.status === "OPEN" ? "CALCULAR PERÍODO" : "RECALCULAR"}
                                    </button>
                                )}
                                {p.status === "CALCULATED" && (
                                    <button
                                        className="pp-btn pp-btn--ghost"
                                        disabled={busy || !!p.durationWeighting?.requiresReview}
                                        title={
                                            p.durationWeighting?.requiresReview
                                                ? "Hay cursos con consumo sin duración aprobada"
                                                : undefined
                                        }
                                        onClick={() =>
                                            run(
                                                `periods/${p.period}/approve`,
                                                undefined,
                                                `¿Aprobar ${monthLabel(p.period)}? Las liquidaciones quedan aprobadas por ${fmtMoney(totalFinal)} en total.`
                                            )
                                        }
                                    >
                                        ✓ APROBAR
                                    </button>
                                )}
                                {p.status === "APPROVED" && (
                                    <button
                                        className="pp-btn pp-btn--accent"
                                        disabled={busy}
                                        onClick={() =>
                                            run(
                                                `periods/${p.period}/close`,
                                                undefined,
                                                `¿Cerrar ${monthLabel(p.period)}? Ya no se podrá recalcular ni ajustar sin reabrir.`
                                            )
                                        }
                                    >
                                        CERRAR PERÍODO
                                    </button>
                                )}
                                {(p.status === "APPROVED" || p.status === "CLOSED") && !reopening && (
                                    <button className="pp-btn pp-btn--ghost" disabled={busy} onClick={() => setReopening(true)}>
                                        REABRIR
                                    </button>
                                )}
                            </div>
                        </div>

                        {p.status === "OPEN" && !detail?.canCalculate && (
                            <p className="pp-note">El mes todavía no terminó. El período se calcula cuando cierra el mes.</p>
                        )}

                        {reopening && (
                            <div className="pp-inline-form">
                                <input
                                    className="pp-input"
                                    placeholder="Motivo de la reapertura"
                                    value={reopenReason}
                                    onChange={(e) => setReopenReason(e.target.value)}
                                />
                                <button
                                    className="pp-btn pp-btn--danger"
                                    disabled={busy || reopenReason.trim().length < 5}
                                    onClick={async () => {
                                        if (await run(`periods/${p.period}/reopen`, { reason: reopenReason.trim() })) {
                                            setReopening(false);
                                            setReopenReason("");
                                        }
                                    }}
                                >
                                    CONFIRMAR REAPERTURA
                                </button>
                                <button className="pp-btn pp-btn--ghost" onClick={() => setReopening(false)}>
                                    CANCELAR
                                </button>
                            </div>
                        )}

                        {/* Números del período */}
                        {calculated && p.financials && p.metrics && (
                            <>
                                <div className="pp-flow">
                                    <Stat label="INGRESOS NETOS ELEGIBLES" value={fmtMoney(p.financials.eligibleNetTrainingRevenue)} />
                                    <Stat
                                        label={`POOL MÁXIMO (${fmtPct(p.configuration?.maximumPoolRate)})`}
                                        value={fmtMoney(p.financials.maximumPoolAmount)}
                                    />
                                    <Stat label="SUSCRIPCIONES ELEGIBLES" value={fmtInt(p.metrics.eligibleSubscriptions)} />
                                    <Stat
                                        label={`META DE CONSUMO (${fmtPct(p.configuration?.consumptionTargetRate)})`}
                                        value={fmtScore(p.metrics.consumptionTarget)}
                                    />
                                    <Stat label="CONSUMO TOTAL (PUNTOS)" value={fmtScore(p.metrics.totalConsumptionScore)} />
                                    <Stat label="ENABLEMENT FACTOR" value={fmtPct(p.metrics.enablementFactor)} />
                                    <Stat label="POOL HABILITADO" value={fmtMoney(p.financials.enabledPoolAmount)} accent />
                                </div>

                                {p.revenueBreakdown && (
                                    <p className="pp-note">
                                        {fmtInt(p.revenueBreakdown.activePlans)} alumnos con plan vigente en el mes (
                                        {["starter", "pro", "elite"]
                                            .map((pl) => `${fmtInt(p.revenueBreakdown!.planCounts?.[pl] ?? 0)} ${pl}`)
                                            .join(" · ")}
                                        ), todos valuados como {p.revenueBreakdown.basePlan} (
                                        {fmtMoney(p.revenueBreakdown.basePlanPrice)}) y prorrateados por día · bruto{" "}
                                        {fmtMoney(p.revenueBreakdown.grossAmount)} · comisión Mercado Pago{" "}
                                        {fmtPct(p.revenueBreakdown.mpFeeRate)} ({fmtMoney(p.revenueBreakdown.feesAmount)})
                                        {!!p.revenueBreakdown.discountedPlans &&
                                            ` · ${p.revenueBreakdown.discountedPlans} con cupón`}
                                        {!!p.revenueBreakdown.excludedFreePayments &&
                                            ` · ${p.revenueBreakdown.excludedFreePayments} con cupón 100% (no cuentan)`}
                                        {!!p.revenueBreakdown.excludedStaffPlans &&
                                            ` · ${p.revenueBreakdown.excludedStaffPlans} de cuentas admin/partner/enterprise (no cuentan)`}
                                        {" · "}
                                        {fmtInt(p.metrics.uniqueEligibleConsumers)} alumnos con consumo ·{" "}
                                        {fmtInt(p.metrics.participatingCourses)} cursos ·{" "}
                                        {fmtInt(p.metrics.participatingPartners)} empresas.
                                    </p>
                                )}

                                {p.durationWeighting && <WeightingBlock dw={p.durationWeighting} />}
                            </>
                        )}
                    </div>

                    {/* Liquidaciones */}
                    {calculated && (
                        <>
                            <div className="pp-section-head">
                                <span className="pp-eyebrow">// LIQUIDACIONES</span>
                                <span className="pp-section-total">
                                    {search.trim() && detail!.settlements.length > 0 && (
                                        <span className="pp-muted">
                                            {visibleSettlements.length} de {detail!.settlements.length} ·{" "}
                                        </span>
                                    )}
                                    Total a pagar <strong>{fmtMoney(totalFinal)}</strong>
                                </span>
                            </div>

                            {detail!.settlements.length === 0 ? (
                                <div className="pp-empty">No hubo consumo elegible en este período.</div>
                            ) : (
                                <div className="pp-partners">
                                    {visibleSettlements.length === 0 && (
                                        <div className="pp-empty">Ninguna liquidación coincide con “{search}”.</div>
                                    )}
                                    {visibleSettlements.map((s) => (
                                        <SettlementCard
                                            key={s.settlementId}
                                            s={s}
                                            periodStatus={p.status}
                                            isOpen={open.has(s.settlementId)}
                                            onToggle={() => toggle(s.settlementId)}
                                            busy={busy}
                                            run={run}
                                        />
                                    ))}
                                </div>
                            )}
                        </>
                    )}

                    {/* Auditoría */}
                    {detail!.auditLogs.length > 0 && (
                        <div className="pp-audit">
                            <p className="pp-body-title">// AUDITORÍA</p>
                            <ul className="pp-audit-list">
                                {detail!.auditLogs.map((a) => (
                                    <li key={a.logId} className="pp-audit-item">
                                        <span className="pp-audit-action">{AUDIT_LABEL[a.action] ?? a.action}</span>
                                        <span className="pp-audit-detail">
                                            {a.settlementId && <span className="pp-muted">{a.settlementId} · </span>}
                                            {typeof a.metadata?.reason === "string" && <>“{a.metadata.reason}” · </>}
                                            {typeof a.metadata?.amount === "number" && (
                                                <>
                                                    {a.metadata.type === "DEBIT" ? "−" : "+"}
                                                    {fmtMoney(a.metadata.amount)} ·{" "}
                                                </>
                                            )}
                                            {typeof a.metadata?.paymentReference === "string" && (
                                                <>Ref. {a.metadata.paymentReference} · </>
                                            )}
                                            {a.adminEmail || a.adminUserId}
                                        </span>
                                        <span className="pp-audit-date">{fmtDate(a.occurredAt)}</span>
                                    </li>
                                ))}
                            </ul>
                        </div>
                    )}
                </>
            )}
        </>
    );
}

// ── Ponderación por duración de un período (copia guardada al calcular) ──
function WeightingBlock({ dw }: { dw: NonNullable<PeriodDoc["durationWeighting"]> }) {
    return (
        <div className="pp-weighting">
            <p className="pp-body-title">// PONDERACIÓN POR DURACIÓN FORMATIVA</p>

            {dw.requiresReview && (
                <div className="pp-warning">
                    Estos cursos tuvieron consumo pero no tienen duración aprobada, así que no reciben ponderación y el
                    período no se puede aprobar: {dw.missingDurations.map((m) => `${m.title} v${m.courseVersion}`).join(", ")}.
                    Aprobá sus duraciones en DURACIONES y recalculá.
                </div>
            )}

            {dw.referenceHours == null ? (
                <p className="pp-note">Sin cursos con consumo válido: no hay referencia del 100% ni reparto.</p>
            ) : (
                <>
                    <p className="pp-note">
                        Referencia del mes (100%): <strong>{fmtHours(dw.referenceHours)}</strong> ·{" "}
                        {dw.referenceCourses.map((c) => `${c.title} v${c.courseVersion} (${c.partnerName})`).join(" · ")}. Cada
                        curso vale sus horas ÷ {fmtHours(dw.referenceHours)}; los puntos base se multiplican por ese % una
                        sola vez. Los puntos ponderados solo reparten el fondo: la habilitación usa puntos base.
                    </p>
                    <div className="pp-table-wrap">
                        <table className="pp-table">
                            <thead>
                                <tr>
                                    <th>Curso</th>
                                    <th>Empresa</th>
                                    <th>Duración aprobada</th>
                                    <th>Ponderación</th>
                                    <th>Puntos base</th>
                                    <th>Puntos ponderados</th>
                                </tr>
                            </thead>
                            <tbody>
                                {dw.courses.map((c) => (
                                    <tr key={`${c.courseId}-${c.courseVersion}`}>
                                        <td>
                                            <span className="pp-course-title">
                                                {c.title} {c.isReference && <span className="pp-chip pp-chip--approved">100%</span>}
                                            </span>
                                            <span className="pp-course-id">
                                                {c.courseId} · v{c.courseVersion}
                                            </span>
                                        </td>
                                        <td>{c.partnerName || "—"}</td>
                                        <td>{fmtHours(c.approvedHours)}</td>
                                        <td>{c.weightPct == null ? "SIN DURACIÓN" : fmtPct(c.weightPct)}</td>
                                        <td>{fmtScore(c.baseScore)}</td>
                                        <td>{fmtScore(c.weightedScore)}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                    <p className="pp-note">
                        Total: {fmtScore(dw.totalBaseScore)} puntos base · {fmtScore(dw.totalWeightedScore)} puntos ponderados.
                    </p>
                </>
            )}
        </div>
    );
}

// ══════════════════════════════════════════════════════════════════════
//  VISTA: DURACIONES (duración formativa por versión de curso)
// ══════════════════════════════════════════════════════════════════════
type DurationFilter = "all" | "pending" | "approved" | "issues";
const DURATION_FILTERS: { id: DurationFilter; label: string }[] = [
    { id: "all", label: "TODAS" },
    { id: "pending", label: "PARA REVISAR" },
    { id: "approved", label: "APROBADAS" },
    { id: "issues", label: "CON PROBLEMAS" },
];

const matchesDuration = (f: DurationFilter, d: DurationSummary) => {
    if (f === "all") return true;
    if (f === "approved") return d.status === "APPROVED" && !d.contentChanged;
    if (f === "pending") return ["PENDING_MEASUREMENT", "MEASURING", "PENDING_REVIEW"].includes(d.status);
    return ["REJECTED", "MEASUREMENT_FAILED"].includes(d.status) || d.contentChanged;
};

function DurationsView() {
    const [rows, setRows] = useState<DurationSummary[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [filter, setFilter] = useState<DurationFilter>("pending");
    const [search, setSearch] = useState("");
    const [openKey, setOpenKey] = useState<string | null>(null);

    const load = useCallback(async () => {
        setLoading(true);
        setError("");
        try {
            const { data } = await http.get<{ durations: DurationSummary[] }>(`${BASE}/durations`);
            setRows(data.durations);
        } catch (err) {
            setError(errMsg(err, "No se pudieron cargar las duraciones."));
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        load();
    }, [load]);

    const searched = rows.filter((d) => matchesSearch(search, d.title, d.courseId, d.partnerSlug));
    const visible = searched.filter((d) => matchesDuration(filter, d));
    const keyOf = (d: { courseId: string; version: number }) => `${d.courseId}|${d.version}`;

    return (
        <>
            <div className="pp-toolbar">
                <p className="pp-sub">
                    Duración formativa de cada versión de curso. La estima el sistema midiendo los videos, los PDFs y las
                    evaluaciones; Hidden la revisa y la aprueba. Solo la duración aprobada se usa en el Partner Pool, y un curso
                    nuevo no se publica hasta tenerla.
                </p>
                <div className="pp-controls">
                    <label className="pp-field">
                        <span className="pp-field-label">// BUSCAR</span>
                        <input
                            type="search"
                            className="pp-input pp-search"
                            placeholder="Empresa o curso…"
                            maxLength={80}
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                        />
                    </label>
                    <button className="pp-btn pp-btn--ghost" onClick={load} disabled={loading}>
                        ↻ ACTUALIZAR
                    </button>
                </div>
            </div>

            <div className="pp-filters" role="tablist" aria-label="Filtrar duraciones">
                {DURATION_FILTERS.map((f) => (
                    <button
                        key={f.id}
                        role="tab"
                        aria-selected={filter === f.id}
                        className={`pp-filter${filter === f.id ? " active" : ""}`}
                        onClick={() => setFilter(f.id)}
                    >
                        {f.label}
                        <span className="pp-filter-count">{searched.filter((d) => matchesDuration(f.id, d)).length}</span>
                    </button>
                ))}
            </div>

            {loading && !rows.length && <Dots />}
            {error && <div className="pp-error">{error}</div>}
            {!loading && !visible.length && !error && (
                <div className="pp-empty">
                    {search.trim() ? `Ningún curso ni empresa coincide con “${search}” en este filtro.` : "No hay cursos en este filtro."}
                </div>
            )}

            <div className="pp-partners">
                {visible.map((d) => (
                    <DurationCard
                        key={keyOf(d)}
                        summary={d}
                        isOpen={openKey === keyOf(d)}
                        onToggle={() => setOpenKey((k) => (k === keyOf(d) ? null : keyOf(d)))}
                        onChanged={load}
                    />
                ))}
            </div>
        </>
    );
}

function DurationCard({
    summary,
    isOpen,
    onToggle,
    onChanged,
}: {
    summary: DurationSummary;
    isOpen: boolean;
    onToggle: () => void;
    onChanged: () => void;
}) {
    const [detail, setDetail] = useState<DurationDetail | null>(null);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState("");
    const [hours, setHours] = useState("");
    const [justification, setJustification] = useState("");
    const [reason, setReason] = useState("");
    const [mode, setMode] = useState<"approve" | "reject" | "inherit" | "confirm" | null>(null);

    const path = `${BASE}/durations/${encodeURIComponent(summary.courseId)}/${summary.version}`;

    const loadDetail = useCallback(async () => {
        try {
            const { data } = await http.get<DurationDetail>(path);
            setDetail(data);
        } catch (err) {
            setError(errMsg(err, "No se pudo cargar el detalle."));
        }
    }, [path]);

    useEffect(() => {
        if (isOpen) loadDetail();
    }, [isOpen, loadDetail]);

    // Mientras mide en el servidor, se consulta cada 4 s
    const measuring = ["PENDING_MEASUREMENT", "MEASURING"].includes(detail?.status ?? summary.status);
    useEffect(() => {
        if (!isOpen || !measuring) return;
        const t = setInterval(loadDetail, 4000);
        return () => clearInterval(t);
    }, [isOpen, measuring, loadDetail]);

    useEffect(() => {
        if (detail?.estimate?.totalHours != null && !hours) setHours(String(detail.estimate.totalHours).replace(".", ","));
    }, [detail]); // eslint-disable-line react-hooks/exhaustive-deps

    const act = async (action: string, body: unknown, confirmText?: string) => {
        if (busy) return;
        if (confirmText && !window.confirm(confirmText)) return;
        setBusy(true);
        setError("");
        try {
            const { data } = await http.post<DurationDetail>(`${path}/${action}`, body ?? {});
            setDetail(data);
            setMode(null);
            setReason("");
            setJustification("");
            onChanged();
        } catch (err) {
            setError(errMsg(err, "No se pudo completar la acción."));
        } finally {
            setBusy(false);
        }
    };

    const d = detail ?? summary;
    const est = d.estimate || ({} as DurationEstimate);
    const hoursValue = Number(hours.replace(",", "."));
    const differs = est.totalHours == null || Math.abs(hoursValue - est.totalHours) > 0.005;
    const canApprove =
        Number.isFinite(hoursValue) && hoursValue >= 0.25 && (!differs || justification.trim().length >= 10);

    return (
        <div className={`pp-partner${isOpen ? " expanded" : ""}`}>
            <button className="pp-partner-header" onClick={onToggle}>
                <span className="pp-partner-id">
                    <span className="pp-partner-icon">{d.status === "APPROVED" && !d.contentChanged ? "✓" : "▣"}</span>
                    <span>
                        <span className="pp-partner-name">{d.title || d.courseId}</span>
                        <span className="pp-partner-code">
                            {d.partnerSlug} · {d.courseId} · v{d.version}
                            {!d.isPublished && " · versión anterior"} ·{" "}
                            <span className={`pp-chip pp-chip--dur-${d.status.toLowerCase()}`}>{DURATION_STATUS[d.status]}</span>
                            {d.contentChanged && <span className="pp-chip pp-chip--cancelled">CONTENIDO CAMBIADO</span>}
                        </span>
                    </span>
                </span>
                <span className="pp-share">
                    <span className="pp-share-value">{fmtHours(d.approved?.hours)}</span>
                    <span className="pp-share-money">aprobada · estimación {fmtHours(est.totalHours)}</span>
                </span>
                <span className="pp-chevron">{isOpen ? "▲" : "▼"}</span>
            </button>

            {isOpen && (
                <div className="pp-partner-body">
                    {!detail ? (
                        <Dots />
                    ) : (
                        <>
                            {measuring && <div className="pp-warning">Midiendo el contenido del curso… se actualiza solo.</div>}
                            {detail.measurementError && <div className="pp-error">{detail.measurementError}</div>}
                            {detail.contentChanged && (
                                <div className="pp-warning">
                                    El contenido (PDFs, videos o preguntas) cambió sin subir la versión del curso. La duración
                                    aprobada queda en revisión y los períodos con consumo de esta versión no se pueden aprobar.
                                    Lo correcto es subir "version" en course.config.js; si no, volvé a medir o confirmá que la
                                    duración sigue valiendo.
                                </div>
                            )}

                            <div className="pp-stats">
                                <Stat label="VIDEOS" value={fmtHours(est.videoHours)} />
                                <Stat label="LECTURA Y PRESENTACIONES" value={fmtHours(est.readingHours)} />
                                <Stat label="EVALUACIONES" value={fmtHours(est.assessmentHours)} />
                                <Stat label="PRÁCTICAS" value={fmtHours(est.practiceHours)} />
                                <Stat label="ESTIMACIÓN TOTAL" value={fmtHours(est.totalHours)} />
                                <Stat label="APROBADA" value={fmtHours(detail.approved?.hours)} accent />
                            </div>

                            {detail.approved?.hours != null && (
                                <p className="pp-note">
                                    Aprobada {fmtDate(detail.approved.approvedAt)} por {detail.approved.approvedByEmail || "admin"} ·{" "}
                                    {SOURCE_LABEL[detail.approved.source || ""] ?? detail.approved.source}
                                    {detail.approved.justification && <> · “{detail.approved.justification}”</>}
                                </p>
                            )}

                            {!!est.explanation?.length && (
                                <>
                                    <p className="pp-body-title pp-body-title--spaced">// CÓMO SE CALCULÓ</p>
                                    <ul className="pp-dur-list">
                                        {est.explanation.map((line, i) => (
                                            <li key={i}>{line}</li>
                                        ))}
                                    </ul>
                                </>
                            )}

                            {!!detail.measured?.warnings?.length && (
                                <div className="pp-warning">
                                    {detail.measured.warnings.map((w, i) => (
                                        <div key={i}>{w}</div>
                                    ))}
                                </div>
                            )}

                            {!!detail.measured?.documents?.length && (
                                <>
                                    <p className="pp-body-title pp-body-title--spaced">// PDFs</p>
                                    <div className="pp-table-wrap">
                                        <table className="pp-table">
                                            <thead>
                                                <tr>
                                                    <th>Material</th>
                                                    <th>Páginas</th>
                                                    <th>Palabras</th>
                                                    <th>Observación</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {detail.measured.documents.map((doc) => (
                                                    <tr key={doc.stepId} className={doc.duplicateOf ? "pp-row-muted" : ""}>
                                                        <td>
                                                            <span className="pp-course-title">{doc.title}</span>
                                                            <span className="pp-course-id">{doc.stepId}</span>
                                                        </td>
                                                        <td>{fmtInt(doc.pages)}</td>
                                                        <td>{fmtInt(doc.words)}</td>
                                                        <td>
                                                            {doc.duplicateOf
                                                                ? `Repetido de ${doc.duplicateOf} (${fmtPct(doc.similarity)}): no suma`
                                                                : doc.note || "—"}
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                </>
                            )}

                            {!!detail.measured?.videos?.length && (
                                <>
                                    <p className="pp-body-title pp-body-title--spaced">// VIDEOS</p>
                                    <div className="pp-table-wrap">
                                        <table className="pp-table">
                                            <thead>
                                                <tr>
                                                    <th>Video</th>
                                                    <th>Duración</th>
                                                    <th>Origen</th>
                                                    <th>Observación</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {detail.measured.videos.map((v) => (
                                                    <tr key={v.stepId}>
                                                        <td>
                                                            <span className="pp-course-title">{v.title}</span>
                                                            <span className="pp-course-id">{v.stepId}</span>
                                                        </td>
                                                        <td>{fmtMinutes(v.seconds)}</td>
                                                        <td>
                                                            {v.source === "MEASURED" ? "Medida" : v.source === "DECLARED" ? "Declarada" : "Sin dato"}
                                                        </td>
                                                        <td>{v.note || "—"}</td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                </>
                            )}

                            {!!detail.measured?.quizzes?.length && (
                                <p className="pp-note pp-body-title--spaced">
                                    Evaluaciones: {detail.measured.quizzes.map((q) => `${q.title} (${q.questions} preg.)`).join(" · ")}
                                </p>
                            )}

                            {error && <div className="pp-error">{error}</div>}

                            {/* Acciones */}
                            {!measuring && (
                                <>
                                    <p className="pp-body-title pp-body-title--spaced">// ACCIONES</p>
                                    {mode === null && (
                                        <div className="pp-inline-form">
                                            {!detail.contentChanged && (
                                                <button className="pp-btn pp-btn--accent" disabled={busy} onClick={() => setMode("approve")}>
                                                    {detail.status === "APPROVED" ? "MODIFICAR DURACIÓN" : "APROBAR"}
                                                </button>
                                            )}
                                            {["PENDING_REVIEW", "MEASUREMENT_FAILED"].includes(detail.status) && (
                                                <button className="pp-btn pp-btn--ghost" disabled={busy} onClick={() => setMode("reject")}>
                                                    RECHAZAR
                                                </button>
                                            )}
                                            {detail.isPublished && (detail.status !== "APPROVED" || detail.contentChanged) && (
                                                <button
                                                    className="pp-btn pp-btn--ghost"
                                                    disabled={busy}
                                                    onClick={() => act("measure", {}, "¿Volver a medir el contenido de esta versión?")}
                                                >
                                                    VOLVER A MEDIR
                                                </button>
                                            )}
                                            {detail.version > 1 && (
                                                <button className="pp-btn pp-btn--ghost" disabled={busy} onClick={() => setMode("inherit")}>
                                                    HEREDAR DE LA VERSIÓN ANTERIOR
                                                </button>
                                            )}
                                            {detail.contentChanged && (
                                                <button className="pp-btn pp-btn--ghost" disabled={busy} onClick={() => setMode("confirm")}>
                                                    CONFIRMAR QUE SIGUE VALIENDO
                                                </button>
                                            )}
                                        </div>
                                    )}

                                    {mode === "approve" && (
                                        <div className="pp-dur-form">
                                            <label className="pp-field">
                                                <span className="pp-field-label">// HORAS FORMATIVAS</span>
                                                <input
                                                    className="pp-input pp-input--sm"
                                                    inputMode="decimal"
                                                    value={hours}
                                                    onChange={(e) => setHours(e.target.value.replace(/[^\d.,]/g, ""))}
                                                />
                                            </label>
                                            <label className="pp-field pp-dur-grow">
                                                <span className="pp-field-label">
                                                    // JUSTIFICACIÓN {differs ? "(obligatoria: difiere de la estimación)" : "(opcional)"}
                                                </span>
                                                <input
                                                    className="pp-input"
                                                    maxLength={1000}
                                                    value={justification}
                                                    onChange={(e) => setJustification(e.target.value)}
                                                    placeholder="Ej: el laboratorio del módulo 3 lleva más tiempo del medido"
                                                />
                                            </label>
                                            <div className="pp-inline-form">
                                                <button
                                                    className="pp-btn pp-btn--accent"
                                                    disabled={busy || !canApprove}
                                                    onClick={() =>
                                                        act(
                                                            "approve",
                                                            { hours: hoursValue, justification: justification.trim() },
                                                            `¿Aprobar ${fmtHours(hoursValue)} para ${d.title} v${d.version}?`
                                                        )
                                                    }
                                                >
                                                    CONFIRMAR {fmtHours(Number.isFinite(hoursValue) ? hoursValue : null)}
                                                </button>
                                                <button className="pp-btn pp-btn--ghost" onClick={() => setMode(null)}>
                                                    CANCELAR
                                                </button>
                                            </div>
                                        </div>
                                    )}

                                    {(mode === "reject" || mode === "inherit" || mode === "confirm") && (
                                        <div className="pp-inline-form">
                                            <input
                                                className="pp-input"
                                                maxLength={1000}
                                                placeholder={
                                                    mode === "reject"
                                                        ? "Motivo del rechazo"
                                                        : mode === "inherit"
                                                          ? "Por qué la duración no cambió respecto de la versión anterior"
                                                          : "Por qué la duración aprobada sigue valiendo"
                                                }
                                                value={reason}
                                                onChange={(e) => setReason(e.target.value)}
                                            />
                                            <button
                                                className={`pp-btn ${mode === "reject" ? "pp-btn--danger" : "pp-btn--accent"}`}
                                                disabled={busy || reason.trim().length < (mode === "reject" ? 5 : 10)}
                                                onClick={() =>
                                                    act(
                                                        mode === "reject" ? "reject" : mode === "inherit" ? "inherit" : "confirm-content",
                                                        { reason: reason.trim() }
                                                    )
                                                }
                                            >
                                                CONFIRMAR
                                            </button>
                                            <button className="pp-btn pp-btn--ghost" onClick={() => setMode(null)}>
                                                CANCELAR
                                            </button>
                                        </div>
                                    )}
                                </>
                            )}

                            {!!detail.history?.length && (
                                <div className="pp-audit">
                                    <p className="pp-body-title">// HISTORIAL</p>
                                    <ul className="pp-audit-list">
                                        {detail.history.map((h, i) => (
                                            <li key={i} className="pp-audit-item">
                                                <span className="pp-audit-action">{HISTORY_LABEL[h.action] ?? h.action}</span>
                                                <span className="pp-audit-detail">
                                                    {h.hours != null && <>{fmtHours(h.hours)} · </>}
                                                    {h.reason && <>“{h.reason}” · </>}
                                                    {h.by === "system" ? "sistema" : h.byEmail || h.by}
                                                </span>
                                                <span className="pp-audit-date">{fmtDate(h.at)}</span>
                                            </li>
                                        ))}
                                    </ul>
                                </div>
                            )}
                        </>
                    )}
                </div>
            )}
        </div>
    );
}

// ── Una liquidación ───────────────────────────────────────────────────
function SettlementCard({
    s,
    periodStatus,
    isOpen,
    onToggle,
    busy,
    run,
}: {
    s: Settlement;
    periodStatus: PeriodStatus;
    isOpen: boolean;
    onToggle: () => void;
    busy: boolean;
    run: (path: string, body?: unknown, confirmText?: string) => Promise<boolean>;
}) {
    const [adjType, setAdjType] = useState<"CREDIT" | "DEBIT">("CREDIT");
    const [adjAmount, setAdjAmount] = useState("");
    const [adjReason, setAdjReason] = useState("");
    const [payRef, setPayRef] = useState("");
    const [cancelReason, setCancelReason] = useState("");
    const [cancelling, setCancelling] = useState(false);

    const editable = ["CALCULATED", "APPROVED"].includes(s.status) && periodStatus !== "CLOSED";
    const payable = s.status === "APPROVED" && periodStatus === "CLOSED";
    const adjTotal = s.adjustments.reduce((acc, a) => acc + (a.type === "CREDIT" ? a.amount : -a.amount), 0);
    const amountValue = Number(adjAmount.replace(/\./g, "").replace(",", "."));

    return (
        <div className={`pp-partner${isOpen ? " expanded" : ""}${s.status === "CANCELLED" ? " disabled" : ""}`}>
            <button className="pp-partner-header" onClick={onToggle}>
                <span className="pp-partner-id">
                    <span className="pp-partner-icon">{s.status === "PAID" ? "✓" : "▣"}</span>
                    <span>
                        <span className="pp-partner-name">{s.partnerSnapshot.name || s.partnerId}</span>
                        <span className="pp-partner-code">
                            {s.settlementId} ·{" "}
                            <span className={`pp-chip pp-chip--${s.status.toLowerCase()}`}>{SETTLEMENT_STATUS[s.status]}</span>
                        </span>
                    </span>
                </span>
                <span className="pp-share">
                    <span className="pp-share-value">{fmtMoney(s.finalAmount)}</span>
                    <span className="pp-share-bar">
                        <span className="pp-share-fill" style={{ width: `${Math.round(s.partnerShare * 100)}%` }} />
                    </span>
                    <span className="pp-share-money">{fmtPct(s.partnerShare)} del pool habilitado</span>
                </span>
                <span className="pp-chevron">{isOpen ? "▲" : "▼"}</span>
            </button>

            <div className="pp-stats">
                {s.partnerBaseScore != null && <Stat label="PUNTOS BASE" value={fmtScore(s.partnerBaseScore)} />}
                <Stat
                    label={s.partnerBaseScore != null ? "PUNTOS PONDERADOS" : "PUNTOS"}
                    value={fmtScore(s.partnerScore)}
                    small={` / ${fmtScore(s.globalScore)}`}
                />
                <Stat label="PARTICIPACIÓN" value={fmtPct(s.partnerShare)} />
                <Stat label="MONTO CALCULADO" value={fmtMoney(s.settlementAmount)} />
                <Stat label="AJUSTES" value={`${adjTotal < 0 ? "−" : "+"}${fmtMoney(Math.abs(adjTotal))}`} />
                <Stat label="MONTO FINAL" value={fmtMoney(s.finalAmount)} accent />
                <Stat
                    label={s.status === "PAID" ? "PAGADO" : "ESTADO"}
                    value={s.status === "PAID" ? fmtDate(s.paidAt) : SETTLEMENT_STATUS[s.status]}
                />
            </div>

            {isOpen && (
                <div className="pp-partner-body">
                    <p className="pp-body-title">// CURSOS</p>
                    {s.courses.length === 0 ? (
                        <p className="pp-muted">Sin consumo en el período.</p>
                    ) : (
                        <div className="pp-table-wrap">
                            <table className="pp-table">
                                <thead>
                                    <tr>
                                        <th>Curso</th>
                                        <th>Versión</th>
                                        <th>Inscripciones</th>
                                        <th>Alumnos con consumo</th>
                                        <th>Finalizaciones</th>
                                        <th>Duración</th>
                                        <th>Ponderación</th>
                                        <th>Puntos base</th>
                                        <th>Ponderados</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {s.courses.map((c) => (
                                        <tr key={`${c.courseId}-${c.courseVersion}`}>
                                            <td>
                                                <span className="pp-course-title">{c.title}</span>
                                                <span className="pp-course-id">{c.courseId}</span>
                                            </td>
                                            <td>v{c.courseVersion}</td>
                                            <td>{fmtInt(c.enrollments)}</td>
                                            <td>{fmtInt(c.uniqueConsumers)}</td>
                                            <td>{fmtInt(c.completions)}</td>
                                            <td>{fmtHours(c.approvedHours)}</td>
                                            <td>{c.weightPct == null ? "—" : fmtPct(c.weightPct)}</td>
                                            <td>{fmtScore(c.consumptionScore)}</td>
                                            <td>{fmtScore(c.weightedScore ?? c.consumptionScore)}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}

                    {s.adjustments.length > 0 && (
                        <>
                            <p className="pp-body-title pp-body-title--spaced">// AJUSTES</p>
                            <ul className="pp-audit-list">
                                {s.adjustments.map((a) => (
                                    <li key={a.adjustmentId} className="pp-audit-item">
                                        <span className={`pp-audit-action${a.type === "DEBIT" ? " pp-text-danger" : ""}`}>
                                            {a.type === "CREDIT" ? "+" : "−"}
                                            {fmtMoney(a.amount)}
                                        </span>
                                        <span className="pp-audit-detail">{a.reason}</span>
                                        <span className="pp-audit-date">{fmtDate(a.createdAt)}</span>
                                    </li>
                                ))}
                            </ul>
                        </>
                    )}

                    {s.status === "PAID" && s.paymentReference && (
                        <p className="pp-note pp-body-title--spaced">Referencia de pago: {s.paymentReference}</p>
                    )}
                    {s.status === "CANCELLED" && s.cancelReason && (
                        <p className="pp-note pp-body-title--spaced">Cancelada: {s.cancelReason}</p>
                    )}

                    {editable && (
                        <>
                            <p className="pp-body-title pp-body-title--spaced">// NUEVO AJUSTE</p>
                            <div className="pp-inline-form">
                                <select
                                    className="pp-input pp-input--sm"
                                    value={adjType}
                                    onChange={(e) => setAdjType(e.target.value as "CREDIT" | "DEBIT")}
                                >
                                    <option value="CREDIT">CRÉDITO (+)</option>
                                    <option value="DEBIT">DÉBITO (−)</option>
                                </select>
                                <input
                                    className="pp-input pp-input--sm"
                                    inputMode="decimal"
                                    placeholder="Monto ARS"
                                    value={adjAmount}
                                    onChange={(e) => setAdjAmount(e.target.value.replace(/[^\d.,]/g, ""))}
                                />
                                <input
                                    className="pp-input"
                                    placeholder="Motivo"
                                    value={adjReason}
                                    onChange={(e) => setAdjReason(e.target.value)}
                                />
                                <button
                                    className="pp-btn pp-btn--ghost"
                                    disabled={busy || !(amountValue > 0) || adjReason.trim().length < 5}
                                    onClick={async () => {
                                        const ok = await run(
                                            `settlements/${s.settlementId}/adjustments`,
                                            { type: adjType, amount: amountValue, reason: adjReason.trim() },
                                            `¿Registrar un ${adjType === "CREDIT" ? "crédito" : "débito"} de ${fmtMoney(amountValue)} para ${s.partnerSnapshot.name}?`
                                        );
                                        if (ok) {
                                            setAdjAmount("");
                                            setAdjReason("");
                                        }
                                    }}
                                >
                                    AGREGAR AJUSTE
                                </button>
                            </div>
                        </>
                    )}

                    {payable && (
                        <>
                            <p className="pp-body-title pp-body-title--spaced">// REGISTRAR PAGO</p>
                            <div className="pp-inline-form">
                                <input
                                    className="pp-input"
                                    placeholder="Referencia (n.º de transferencia, comprobante)"
                                    value={payRef}
                                    onChange={(e) => setPayRef(e.target.value)}
                                />
                                <button
                                    className="pp-btn pp-btn--accent"
                                    disabled={busy || payRef.trim().length < 3}
                                    onClick={() =>
                                        run(
                                            `settlements/${s.settlementId}/pay`,
                                            { paymentReference: payRef.trim() },
                                            `¿Confirmás que se pagaron ${fmtMoney(s.finalAmount)} a ${s.partnerSnapshot.name}?`
                                        )
                                    }
                                >
                                    MARCAR COMO PAGADA
                                </button>
                            </div>
                        </>
                    )}

                    {editable && (
                        <div className="pp-inline-form pp-body-title--spaced">
                            {cancelling ? (
                                <>
                                    <input
                                        className="pp-input"
                                        placeholder="Motivo de la cancelación"
                                        value={cancelReason}
                                        onChange={(e) => setCancelReason(e.target.value)}
                                    />
                                    <button
                                        className="pp-btn pp-btn--danger"
                                        disabled={busy || cancelReason.trim().length < 5}
                                        onClick={async () => {
                                            if (
                                                await run(`settlements/${s.settlementId}/cancel`, {
                                                    reason: cancelReason.trim(),
                                                })
                                            ) {
                                                setCancelling(false);
                                                setCancelReason("");
                                            }
                                        }}
                                    >
                                        CONFIRMAR CANCELACIÓN
                                    </button>
                                    <button className="pp-btn pp-btn--ghost" onClick={() => setCancelling(false)}>
                                        VOLVER
                                    </button>
                                </>
                            ) : (
                                <button className="pp-btn pp-btn--link" onClick={() => setCancelling(true)}>
                                    Cancelar liquidación
                                </button>
                            )}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}

// ══════════════════════════════════════════════════════════════════════
export default function PartnerPool() {
    const { theme } = UseTheme();
    const [view, setView] = useState<"metrics" | "settlements" | "durations">("metrics");

    return (
        <div className={`pp-wrap ${theme}`}>
            <div className="pp-header">
                <div>
                    <span className="pp-eyebrow">// PARTNER_POOL</span>
                    <h2 className="pp-title">Empresas partner</h2>
                </div>
                <div className="pp-tabs" role="tablist">
                    <button
                        role="tab"
                        aria-selected={view === "metrics"}
                        className={`pp-tab${view === "metrics" ? " active" : ""}`}
                        onClick={() => setView("metrics")}
                    >
                        MÉTRICAS
                    </button>
                    <button
                        role="tab"
                        aria-selected={view === "settlements"}
                        className={`pp-tab${view === "settlements" ? " active" : ""}`}
                        onClick={() => setView("settlements")}
                    >
                        LIQUIDACIONES
                    </button>
                    <button
                        role="tab"
                        aria-selected={view === "durations"}
                        className={`pp-tab${view === "durations" ? " active" : ""}`}
                        onClick={() => setView("durations")}
                    >
                        DURACIONES
                    </button>
                </div>
            </div>

            {view === "metrics" && <MetricsView />}
            {view === "settlements" && <SettlementsView />}
            {view === "durations" && <DurationsView />}
        </div>
    );
}