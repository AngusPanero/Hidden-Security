import { useCallback, useEffect, useMemo, useState } from "react";
import axios from "axios";
import "./PartnerPool.css";
import { UseTheme } from "../contexts/ThemeContext";

// ══════════════════════════════════════════════════════════════════════
//  PartnerPool — AdminDashboard
//  · MÉTRICAS: consumo en vivo de cursos externos por empresa
//  · LIQUIDACIONES: cálculo mensual PP_V1, aprobación, ajustes, pagos y auditoría
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
        consumptionScore: number;
    }[];
    partnerScore: number;
    globalScore: number;
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
    warnings?: { unknownVersions: string[]; nonEligibleEvents: number; excludedAccessEvents: number };
}

interface PeriodSummary {
    period: string;
    status: PeriodStatus;
    enabledPoolAmount: number | null;
    settlements: number;
    paid: number;
    totalFinal: number | null;
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
                            {data.partners.map((p) => {
                                const isOpen = open.has(p.partnerId);
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
                                                {p.courses.length === 0 ? (
                                                    <p className="pp-muted">Sin cursos cargados.</p>
                                                ) : (
                                                    <div className="pp-table-wrap">
                                                        <table className="pp-table">
                                                            <thead>
                                                                <tr>
                                                                    <th>Curso</th>
                                                                    <th>Peso</th>
                                                                    <th>Inscripciones</th>
                                                                    <th>Pasos elegibles</th>
                                                                    <th>Completados</th>
                                                                    <th>Quizzes aprobados</th>
                                                                    <th>Promedio quiz</th>
                                                                    <th>Histórico</th>
                                                                </tr>
                                                            </thead>
                                                            <tbody>
                                                                {p.courses.map((c) => (
                                                                    <tr key={c.courseId}>
                                                                        <td>
                                                                            <span className="pp-course-title">{c.title}</span>
                                                                            <span className="pp-course-id">
                                                                                {c.courseId}
                                                                                {c.status !== "ACTIVE" && ` · ${c.status}`}
                                                                            </span>
                                                                        </td>
                                                                        <td>×{c.courseWeight}</td>
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
            if (w?.unknownVersions?.length) {
                setNotice(`Hay eventos de versiones de curso desconocidas (${w.unknownVersions.join(", ")}); no se contaron.`);
            }
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
                <p className="pp-sub">Liquidación mensual del Partner Pool · fórmula PP_V1</p>
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
                                        disabled={busy}
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
                            </>
                        )}
                    </div>

                    {/* Liquidaciones */}
                    {calculated && (
                        <>
                            <div className="pp-section-head">
                                <span className="pp-eyebrow">// LIQUIDACIONES</span>
                                <span className="pp-section-total">
                                    Total a pagar <strong>{fmtMoney(totalFinal)}</strong>
                                </span>
                            </div>

                            {detail!.settlements.length === 0 ? (
                                <div className="pp-empty">No hubo consumo elegible en este período.</div>
                            ) : (
                                <div className="pp-partners">
                                    {detail!.settlements.map((s) => (
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
                <Stat label="PUNTOS" value={fmtScore(s.partnerScore)} small={` / ${fmtScore(s.globalScore)}`} />
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
                                        <th>Puntos</th>
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
                                            <td>{fmtScore(c.consumptionScore)}</td>
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
    const [view, setView] = useState<"metrics" | "settlements">("metrics");

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
                </div>
            </div>

            {view === "metrics" ? <MetricsView /> : <SettlementsView />}
        </div>
    );
}