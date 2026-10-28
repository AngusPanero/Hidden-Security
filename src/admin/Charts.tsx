import React, { useEffect, useMemo, useRef, useState } from 'react';
import axios from 'axios';
import {
    ResponsiveContainer, BarChart, Bar, XAxis, YAxis,
    CartesianGrid, Tooltip, PieChart, Pie, Cell,
} from 'recharts';
import { Lock, KeyRound, AlertCircle } from 'lucide-react';
import "./chaarts.css";
import { UseTheme } from '../contexts/ThemeContext';

interface DashboardChartsProps {
    // Ya no se usa: los tickets se piden acá adentro con la clave de firma.
    // Queda opcional para no romper el componente padre.
    allTickets?: any[];
}

// ══════════════════════════════════════════════════════════════
//  CONFIGURACIÓN DE NEGOCIO
// ══════════════════════════════════════════════════════════════

// La comisión de MercadoPago la calcula y la guarda el backend en cada pago
// (mpFeeRate / mpFeeAmount / interestFree). Este valor es solo un respaldo
// por si algún registro llegara sin esos campos.
const STANDARD_FEE_RATE = 0.05;

const IVA_REDUCIDO = 0.105;
const IVA_GENERAL  = 0.21;

const APPROVED_STATUSES = ['approved'];
const PENDING_STATUSES  = ['pending', 'in_process', 'in_mediation', 'authorized'];
// Estados internos del checkout: no son ventas ni intentos visibles
const INTERNAL_STATUSES = ['created', 'error'];

const COLORS = {
    net:  '#22c55e',
    fee:  '#ef4444',
    iva:  '#f59e0b',
};

const MONTHS = ['ENE', 'FEB', 'MAR', 'ABR', 'MAY', 'JUN', 'JUL', 'AGO', 'SEP', 'OCT', 'NOV', 'DIC'];
const DAY_MS = 86_400_000;

// ══════════════════════════════════════════════════════════════
//  TIPOS
// ══════════════════════════════════════════════════════════════
type TimeRange   = 'day' | 'month' | 'year' | 'custom' | 'all';
type SaleStatus  = 'approved' | 'pending' | 'rejected';
type Granularity = 'hour' | 'day' | 'month';

interface Sale {
    id:           string;
    reference:    string;
    date:         Date;
    amount:       number;        // lo que pagó el cliente
    listAmount:   number | null; // precio de lista (sin recargo ni descuento)
    installments: number;
    interestFree: boolean;       // true = cuotas sin interés (comisión absorbida)
    interestRate: number;        // recargo cobrado al cliente
    feeRate:      number;        // comisión MP aplicada
    fee:          number;        // monto de comisión MP
    feeEstimated: boolean;       // pago viejo sin datos guardados
    plan:         string;
    email:        string;
    status:       SaleStatus;
    rawStatus:    string;
    isTest:       boolean;
}

interface Breakdown { gross: number; fee: number; iva: number; net: number; }

interface Totals {
    gross: number;
    fees:  number;
    iva:   number;
    net:   number;
    count: number;
    avg:   number;
}

interface Bounds { start: Date; end: Date; } // end exclusivo

// ══════════════════════════════════════════════════════════════
//  HELPERS
// ══════════════════════════════════════════════════════════════
const num = (v: any) => {
    const n = Number(v);
    return Number.isFinite(n) ? n : 0;
};

const ars = new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 });
const fmtMoney = (n: number) => ars.format(Math.round(n));
const fmtPct   = (r: number) => `${(r * 100).toLocaleString('es-AR', { maximumFractionDigits: 1 })}%`;
const fmtDate  = (d: Date) => d.toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' });
const fmtDateTime = (d: Date) =>
    d.toLocaleString('es-AR', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' });
const fmtCompact = (v: number) =>
    Math.abs(v) >= 1_000_000 ? `${(v / 1_000_000).toFixed(1)}M`
    : Math.abs(v) >= 1_000   ? `${Math.round(v / 1_000)}k`
    : String(v);
const pad = (n: number) => String(n).padStart(2, '0');

const normalizeStatus = (raw: string): SaleStatus => {
    if (!raw || APPROVED_STATUSES.includes(raw)) return 'approved'; // registros viejos sin status
    if (PENDING_STATUSES.includes(raw)) return 'pending';
    return 'rejected';
};

const STATUS_LABELS: Record<string, string> = {
    approved: 'APROBADO', pending: 'PENDIENTE', in_process: 'EN PROCESO', authorized: 'AUTORIZADO',
    in_mediation: 'EN MEDIACIÓN', rejected: 'RECHAZADO', failed: 'FALLIDO', cancelled: 'CANCELADO',
    refunded: 'REEMBOLSADO', charged_back: 'CONTRACARGO',
};

// Documento de Mongo (schema Payments) → formato fijo del dashboard.
// La comisión viene calculada desde el backend.
const normalizeSale = (t: any, i: number): Sale => {
    const rawStatus = String(t.status ?? '').toLowerCase();
    const items     = Array.isArray(t.items) && t.items.length
        ? t.items
        : String(t.plan ?? '').split('+').filter(Boolean);
    const amount    = num(t.amount);
    const hasFee    = t.mpFeeRate !== undefined && t.mpFeeRate !== null;
    const feeRate   = hasFee ? num(t.mpFeeRate) : STANDARD_FEE_RATE;

    return {
        id:           String(t._id ?? i),
        reference:    String(t.orderId ?? '').replace(/-/g, '').slice(-8).toUpperCase(),
        date:         new Date(t.date ?? t.createdAt ?? NaN),
        amount,
        listAmount:   t.listAmount !== undefined && t.listAmount !== null ? num(t.listAmount) : null,
        installments: Math.max(1, Math.round(num(t.cuotas ?? 1)) || 1),
        interestFree: !!t.interestFree,
        interestRate: num(t.interestRate),
        feeRate,
        fee:          t.mpFeeAmount !== undefined && t.mpFeeAmount !== null ? num(t.mpFeeAmount) : Math.round(amount * feeRate),
        feeEstimated: !hasFee || !!t.feeEstimated,
        plan:         items.length ? items.join('+').toLowerCase() : 'otro',
        email:        String(t.email ?? ''),
        status:       normalizeStatus(rawStatus),
        rawStatus:    rawStatus || 'approved',
        isTest:       !!t.isTest,
    };
};

// Texto de la modalidad de pago
const financingLabel = (s: Sale) =>
    s.installments === 1 ? '1 PAGO'
    : s.interestFree     ? 'SIN INTERÉS'
    : `CON RECARGO${s.interestRate ? ` +${Math.round(s.interestRate * 100)}%` : ''}`;

// Fecha del <input type="date"> en hora local (new Date("2026-10-01") la toma en UTC
// y en Argentina corre el día para atrás)
const parseLocalDate = (s: string) => {
    const [y, m, d] = s.split('-').map(Number);
    return new Date(y, m - 1, d);
};

const getRange = (range: TimeRange, startDate: string, endDate: string, now: Date): Bounds | null => {
    const y = now.getFullYear(), m = now.getMonth(), d = now.getDate();
    switch (range) {
        case 'day':   return { start: new Date(y, m, d), end: new Date(y, m, d + 1) };
        case 'month': return { start: new Date(y, m, 1), end: new Date(y, m + 1, 1) };
        case 'year':  return { start: new Date(y, 0, 1), end: new Date(y + 1, 0, 1) };
        case 'custom': {
            if (!startDate || !endDate) return null;
            const start = parseLocalDate(startDate);
            const endIncl = parseLocalDate(endDate);
            const end = new Date(endIncl.getFullYear(), endIncl.getMonth(), endIncl.getDate() + 1);
            return end > start ? { start, end } : null;
        }
        default: return null;
    }
};

const getPreviousRange = (range: TimeRange, cur: Bounds): Bounds | null => {
    const s = cur.start;
    switch (range) {
        case 'day':   return { start: new Date(s.getFullYear(), s.getMonth(), s.getDate() - 1), end: s };
        case 'month': return { start: new Date(s.getFullYear(), s.getMonth() - 1, 1), end: s };
        case 'year':  return { start: new Date(s.getFullYear() - 1, 0, 1), end: s };
        case 'custom': {
            const days = Math.round((cur.end.getTime() - s.getTime()) / DAY_MS);
            return { start: new Date(s.getFullYear(), s.getMonth(), s.getDate() - days), end: s };
        }
        default: return null;
    }
};

const PREV_LABELS: Record<TimeRange, string> = {
    day: 'vs ayer', month: 'vs mes anterior', year: 'vs año anterior', custom: 'vs período anterior', all: '',
};

const RANGE_LABELS: Record<TimeRange, string> = {
    day: 'HOY', month: 'MES', year: 'AÑO', custom: 'CUSTOM', all: 'TODO',
};

const keyOf = (d: Date, g: Granularity) =>
    g === 'hour' ? `${d.getHours()}`
    : g === 'day' ? `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`
    : `${d.getFullYear()}-${d.getMonth()}`;

const labelOf = (d: Date, g: Granularity, multiYear: boolean) =>
    g === 'hour' ? `${pad(d.getHours())}h`
    : g === 'day' ? `${pad(d.getDate())} ${MONTHS[d.getMonth()]}`
    : multiYear ? `${MONTHS[d.getMonth()]} ${String(d.getFullYear()).slice(2)}` : MONTHS[d.getMonth()];

const enumerate = (start: Date, end: Date, g: Granularity): Date[] => {
    const out: Date[] = [];
    let c = g === 'month' ? new Date(start.getFullYear(), start.getMonth(), 1) : new Date(start);
    while (c < end && out.length < 1000) {
        out.push(c);
        c = g === 'hour'  ? new Date(c.getFullYear(), c.getMonth(), c.getDate(), c.getHours() + 1)
          : g === 'day'   ? new Date(c.getFullYear(), c.getMonth(), c.getDate() + 1)
          : new Date(c.getFullYear(), c.getMonth() + 1, 1);
    }
    return out;
};

const pctDelta = (cur: number, prev: number): number | null =>
    prev > 0 ? ((cur - prev) / prev) * 100 : null;

// ══════════════════════════════════════════════════════════════
//  SUBCOMPONENTES
// ══════════════════════════════════════════════════════════════
const Delta = ({ value, label }: { value: number | null; label: string }) => {
    if (value === null) return <span className="dc-delta neutral">— {label}</span>;
    const up = value >= 0;
    return (
        <span className={`dc-delta ${up ? 'up' : 'down'}`}>
            {up ? '▲' : '▼'} {Math.abs(value).toFixed(1)}% <em>{label}</em>
        </span>
    );
};

const StackTooltip = ({ active, payload }: any) => {
    if (!active || !payload?.length) return null;
    const b = payload[0].payload;
    return (
        <div className="dc-tooltip">
            <div className="dc-tooltip-title">{b.name}</div>
            <div className="dc-tooltip-row"><span>BRUTO</span><strong>{fmtMoney(b.gross)}</strong></div>
            <div className="dc-tooltip-row"><span style={{ color: COLORS.fee }}>COMISIÓN</span><strong>-{fmtMoney(b.fees)}</strong></div>
            {b.iva > 0 && (
                <div className="dc-tooltip-row"><span style={{ color: COLORS.iva }}>IVA</span><strong>-{fmtMoney(b.iva)}</strong></div>
            )}
            <div className="dc-tooltip-row"><span style={{ color: COLORS.net }}>NETO</span><strong>{fmtMoney(b.net)}</strong></div>
            <div className="dc-tooltip-foot">{b.count} venta{b.count === 1 ? '' : 's'}</div>
        </div>
    );
};

const EmptyState = ({ text }: { text: string }) => (
    <div className="dc-empty">
        <svg viewBox="0 0 48 48" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round">
            <path d="M8 40V24M16 40V16M24 40V28M32 40V20M40 40V12" />
        </svg>
        <p>{text}</p>
    </div>
);

// ══════════════════════════════════════════════════════════════
//  COMPONENTE PRINCIPAL
// ══════════════════════════════════════════════════════════════
const Charts: React.FC<DashboardChartsProps> = () => {
    const { theme } = UseTheme();

    // ── Clave de firma (signPin) ──────────────────────────────
    // Los tickets se piden recién con la clave: el backend la valida con checkSignPin
    const [tickets,    setTickets]    = useState<any[]>([]);
    const [unlocked,   setUnlocked]   = useState(false);
    const [pin,        setPin]        = useState('');
    const [pinError,   setPinError]   = useState('');
    const [pinLoading, setPinLoading] = useState(false);
    const [pinLocked,  setPinLocked]  = useState(false);
    const pinInputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        if (unlocked) return;
        const t = setTimeout(() => pinInputRef.current?.focus(), 50);
        return () => clearTimeout(t);
    }, [unlocked]);

    const handleUnlock = async (e: React.FormEvent) => {
        e.preventDefault();
        if (pinLoading || pinLocked) return;

        if (!/^\d{4}$/.test(pin)) {
            setPinError('La clave tiene 4 dígitos.');
            return;
        }

        setPinLoading(true);
        setPinError('');

        try {
            const { data } = await axios.post(
                `${import.meta.env.VITE_API_URL}/all-tickets`,
                { pin },
                { withCredentials: true }
            );
            setTickets(Array.isArray(data) ? data : []);
            setPin('');
            setUnlocked(true);
        } catch (err: any) {
            const code = err.response?.data?.code;
            const msg  = err.response?.data?.message || 'Error al cargar las métricas 🔴';
            setPin('');
            setPinError(msg);
            if (code === 'CLAVE_BLOQUEADA') {
                setPinLocked(true);
            } else {
                setTimeout(() => pinInputRef.current?.focus(), 0);
            }
        } finally {
            setPinLoading(false);
        }
    };

    const [timeRange,   setTimeRange]   = useState<TimeRange>('month');
    const [startDate,   setStartDate]   = useState('');
    const [endDate,     setEndDate]     = useState('');
    const [planFilter,  setPlanFilter]  = useState('all');
    const [iva105,      setIva105]      = useState(false);
    const [iva21,       setIva21]       = useState(false);
    const [ivaIncluded, setIvaIncluded] = useState(false);
    const [includeTest, setIncludeTest] = useState(false);

    // ── Normalización ─────────────────────────────────────────
    const sales = useMemo<Sale[]>(() => {
        if (!Array.isArray(tickets)) return [];
        return tickets
            .filter(t => !INTERNAL_STATUSES.includes(String(t?.status ?? '').toLowerCase()))
            .map(normalizeSale)
            .filter(s => !isNaN(s.date.getTime()))
            .filter(s => includeTest || !s.isTest);
    }, [tickets, includeTest]);

    const plans = useMemo(() => Array.from(new Set(sales.map(s => s.plan))).sort(), [sales]);

    // ── Cálculo por venta (comisión + IVA) ────────────────────
    const ivaRate = (iva105 ? IVA_REDUCIDO : 0) + (iva21 ? IVA_GENERAL : 0);

    const breakdown = useMemo(() => (s: Sale): Breakdown => {
        const gross = s.amount;
        const fee   = s.fee; // viene calculada del backend
        const iva   = ivaRate === 0 ? 0
                    : ivaIncluded ? gross - gross / (1 + ivaRate)
                    : gross * ivaRate;
        return { gross, fee, iva, net: gross - fee - iva };
    }, [ivaRate, ivaIncluded]);

    const summarize = (list: Sale[]): Totals => {
        const t = { gross: 0, fees: 0, iva: 0, net: 0, count: 0, avg: 0 };
        list.forEach(s => {
            if (s.status !== 'approved') return;
            const b = breakdown(s);
            t.gross += b.gross; t.fees += b.fee; t.iva += b.iva; t.net += b.net; t.count++;
        });
        t.avg = t.count ? t.gross / t.count : 0;
        return t;
    };

    // ── Rangos ────────────────────────────────────────────────
    const bounds = useMemo(
        () => getRange(timeRange, startDate, endDate, new Date()),
        [timeRange, startDate, endDate]
    );
    const prevBounds = useMemo(
        () => (bounds ? getPreviousRange(timeRange, bounds) : null),
        [bounds, timeRange]
    );

    const inBounds  = (s: Sale, b: Bounds | null) => !b || (s.date >= b.start && s.date < b.end);
    const planMatch = (s: Sale) => planFilter === 'all' || s.plan === planFilter;

    const filtered     = useMemo(() => sales.filter(s => planMatch(s) && inBounds(s, bounds)), [sales, planFilter, bounds]);
    const prevFiltered = useMemo(
        () => (prevBounds ? sales.filter(s => planMatch(s) && inBounds(s, prevBounds)) : null),
        [sales, planFilter, prevBounds]
    );

    const totals     = summarize(filtered);
    const prevTotals = prevFiltered ? summarize(prevFiltered) : null;
    const historical = summarize(sales); // siempre sin filtros
    const deltaLabel = PREV_LABELS[timeRange];
    const d = (cur: number, prev?: number) => (prevTotals && prev !== undefined ? pctDelta(cur, prev) : null);

    // ── Serie temporal ────────────────────────────────────────
    const chartData = useMemo(() => {
        const approved = filtered.filter(s => s.status === 'approved');
        let start: Date, end: Date, g: Granularity;

        if (!bounds) {
            if (!approved.length) return [];
            const min = approved.reduce((a, s) => (s.date < a ? s.date : a), approved[0].date);
            const now = new Date();
            start = new Date(min.getFullYear(), min.getMonth(), 1);
            end   = new Date(now.getFullYear(), now.getMonth() + 1, 1);
            g = 'month';
        } else {
            start = bounds.start;
            end   = bounds.end;
            const days = (end.getTime() - start.getTime()) / DAY_MS;
            g = timeRange === 'day' ? 'hour'
              : timeRange === 'year' ? 'month'
              : days <= 62 ? 'day' : 'month';
        }

        const multiYear = start.getFullYear() !== new Date(end.getTime() - 1).getFullYear();
        const buckets = enumerate(start, end, g).map(dt => ({
            key: keyOf(dt, g), name: labelOf(dt, g, multiYear),
            gross: 0, fees: 0, iva: 0, net: 0, count: 0,
        }));
        const map = new Map(buckets.map(b => [b.key, b]));

        approved.forEach(s => {
            const b = map.get(keyOf(s.date, g));
            if (!b) return;
            const br = breakdown(s);
            b.gross += br.gross; b.fees += br.fee; b.iva += br.iva; b.net += br.net; b.count++;
        });
        return buckets;
    }, [filtered, bounds, timeRange, breakdown]);

    const hasChartData = chartData.some(b => b.count > 0);

    // ── Distribución ──────────────────────────────────────────
    const pieData = [
        { name: 'NETO',     value: Math.max(totals.net, 0), color: COLORS.net },
        { name: 'COMISIÓN', value: totals.fees,             color: COLORS.fee },
        { name: 'IVA',      value: totals.iva,              color: COLORS.iva },
    ].filter(p => p.value > 0);

    // ── Por cuotas ────────────────────────────────────────────
    const installmentRows = useMemo(() => {
        const map = new Map<string, {
            key: string; n: number; interestFree: boolean; label: string;
            rate: number; count: number; gross: number; fee: number;
        }>();
        filtered.forEach(s => {
            if (s.status !== 'approved') return;
            const key = `${s.installments}-${s.interestFree ? 'si' : 'cr'}`;
            const r = map.get(key) ?? {
                key, n: s.installments, interestFree: s.interestFree,
                label: s.installments === 1 ? '1 PAGO' : s.interestFree ? 'SIN INTERÉS' : 'CON RECARGO',
                rate: s.feeRate, count: 0, gross: 0, fee: 0,
            };
            r.count++; r.gross += s.amount; r.fee += s.fee;
            map.set(key, r);
        });
        return Array.from(map.values()).sort((a, b) => a.n - b.n || Number(a.interestFree) - Number(b.interestFree));
    }, [filtered]);

    // Lo que costaron las cuotas sin interés por encima de la comisión estándar
    const absorbedCost = useMemo(
        () => filtered
            .filter(s => s.status === 'approved' && s.interestFree)
            .reduce((a, s) => a + (s.fee - s.amount * STANDARD_FEE_RATE), 0),
        [filtered]
    );
    const hasEstimatedFees = filtered.some(s => s.status === 'approved' && s.feeEstimated);

    // ── Por plan ──────────────────────────────────────────────
    const planRows = useMemo(() => {
        const map = new Map<string, { plan: string; count: number; gross: number }>();
        filtered.forEach(s => {
            if (s.status !== 'approved') return;
            const r = map.get(s.plan) ?? { plan: s.plan, count: 0, gross: 0 };
            r.count++; r.gross += s.amount;
            map.set(s.plan, r);
        });
        return Array.from(map.values()).sort((a, b) => b.gross - a.gross);
    }, [filtered]);

    // ── Estados ───────────────────────────────────────────────
    const statusCounts = useMemo(() => {
        const c = { approved: 0, pending: 0, rejected: 0 };
        filtered.forEach(s => c[s.status]++);
        return c;
    }, [filtered]);
    const totalAttempts  = statusCounts.approved + statusCounts.pending + statusCounts.rejected;
    const conversionRate = totalAttempts ? statusCounts.approved / totalAttempts : 0;

    // ── Últimas transacciones ─────────────────────────────────
    const recent = useMemo(
        () => [...filtered].sort((a, b) => b.date.getTime() - a.date.getTime()).slice(0, 8),
        [filtered]
    );

    // ── Textos ────────────────────────────────────────────────
    const rangeCaption = bounds
        ? `${fmtDate(bounds.start)} → ${fmtDate(new Date(bounds.end.getTime() - 1))}`
        : timeRange === 'custom'
            ? 'Elegí fecha de inicio y fin · mostrando todo el historial'
            : 'Todo el historial';

    const ivaCaption = ivaRate === 0
        ? 'SIN CALCULAR'
        : `${fmtPct(ivaRate)} ${ivaIncluded ? 'INCLUIDO EN PRECIO' : 'SOBRE TOTAL'}`;

    const effectiveFee = totals.gross ? totals.fees / totals.gross : 0;

    // ══════════════════════════════════════════════════════════
    //  BLOQUEO: hasta validar la clave no se muestra nada
    // ══════════════════════════════════════════════════════════
    if (!unlocked) {
        return (
            <div className={`dc-wrapper dc-wrapper--locked ${theme}`}>
                <form className="dc-gate" onSubmit={handleUnlock} aria-labelledby="dc-gate-title">
                    <span className="dc-eyebrow">// ACCESO_RESTRINGIDO</span>
                    <h2 id="dc-gate-title" className="dc-title dc-gate-title">
                        <Lock size={20} strokeWidth={2.5} />
                        PANEL <span>FINANCIERO</span>
                    </h2>
                    <p className="dc-gate-text">Ingresá tu clave de firma para ver las métricas de ventas.</p>

                    <label className="dc-control-label" htmlFor="dc-gate-pin">CLAVE DE FIRMA</label>
                    <input
                        id="dc-gate-pin"
                        ref={pinInputRef}
                        className="dc-gate-pin"
                        type="password"
                        inputMode="numeric"
                        autoComplete="off"
                        maxLength={4}
                        value={pin}
                        disabled={pinLoading || pinLocked}
                        onChange={e => { setPin(e.target.value.replace(/\D/g, '').slice(0, 4)); setPinError(''); }}
                        placeholder="••••"
                    />

                    {pinError && (
                        <div className="dc-gate-error" role="alert">
                            <AlertCircle size={14} /> {pinError}
                        </div>
                    )}

                    <button
                        type="submit"
                        className="dc-gate-btn"
                        disabled={pinLoading || pinLocked || pin.length !== 4}
                    >
                        <KeyRound size={14} strokeWidth={2.5} />
                        {pinLoading ? 'VERIFICANDO...' : pinLocked ? 'BLOQUEADO' : 'DESBLOQUEAR'}
                    </button>
                </form>
            </div>
        );
    }

    return (
        <div className={`dc-wrapper ${theme}`}>

            {/* ── TOP: título + total histórico ── */}
            <div className="dc-top">
                <div>
                    <span className="dc-eyebrow">// METRICAS_DE_VENTAS</span>
                    <h2 className="dc-title">PANEL <span>FINANCIERO</span></h2>
                </div>
                <div className="dc-historic">
                    <span className="dc-eyebrow">TOTAL_HISTÓRICO · SIN FILTROS</span>
                    <span className="dc-historic-value">{fmtMoney(historical.gross)}</span>
                    <span className="dc-historic-sub">
                        {historical.count} ventas aprobadas · neto {fmtMoney(historical.net)}
                    </span>
                </div>
            </div>

            {/* ── CONTROLES ── */}
            <div className="dc-controls">
                <div className="dc-control-row">
                    <span className="dc-control-label">PERÍODO</span>
                    <div className="dc-btn-group">
                        {(['day', 'month', 'year', 'custom', 'all'] as const).map(range => (
                            <button
                                key={range}
                                className={`dc-filter-btn ${timeRange === range ? 'active' : ''}`}
                                onClick={() => setTimeRange(range)}
                            >
                                {RANGE_LABELS[range]}
                            </button>
                        ))}
                    </div>

                    {timeRange === 'custom' && (
                        <div className="dc-date-inputs">
                            <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="dc-date-field" />
                            <span className="dc-arrow">→</span>
                            <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className="dc-date-field" />
                        </div>
                    )}
                </div>

                <div className="dc-control-row">
                    <span className="dc-control-label">PLAN</span>
                    <div className="dc-chip-group">
                        <button className={`dc-chip ${planFilter === 'all' ? 'active' : ''}`} onClick={() => setPlanFilter('all')}>
                            TODOS
                        </button>
                        {plans.map(p => (
                            <button key={p} className={`dc-chip ${planFilter === p ? 'active' : ''}`} onClick={() => setPlanFilter(p)}>
                                {p.toUpperCase()}
                            </button>
                        ))}
                    </div>
                </div>

                <div className="dc-control-row">
                    <span className="dc-control-label">IMPUESTOS</span>
                    <div className="dc-check-group">
                        <label className={`dc-check ${iva105 ? 'on' : ''}`}>
                            <input type="checkbox" checked={iva105} onChange={e => setIva105(e.target.checked)} />
                            <span className="dc-check-box" />
                            IVA 10,5%
                        </label>
                        <label className={`dc-check ${iva21 ? 'on' : ''}`}>
                            <input type="checkbox" checked={iva21} onChange={e => setIva21(e.target.checked)} />
                            <span className="dc-check-box" />
                            IVA 21%
                        </label>
                        <span className="dc-check-sep" />
                        <label className={`dc-check dc-check--soft ${ivaIncluded ? 'on' : ''}`} title="Calcula el IVA contenido en el precio de venta (total / 1,21) en lugar de aplicarlo sobre el total">
                            <input type="checkbox" checked={ivaIncluded} onChange={e => setIvaIncluded(e.target.checked)} disabled={ivaRate === 0} />
                            <span className="dc-check-box" />
                            PRECIO CON IVA INCLUIDO
                        </label>
                    </div>
                </div>

                <div className="dc-control-row">
                    <span className="dc-control-label">DATOS</span>
                    <div className="dc-check-group">
                        <label className={`dc-check dc-check--soft ${includeTest ? 'on' : ''}`}>
                            <input type="checkbox" checked={includeTest} onChange={e => setIncludeTest(e.target.checked)} />
                            <span className="dc-check-box" />
                            INCLUIR PAGOS DE PRUEBA
                        </label>
                    </div>
                </div>

                <div className="dc-caption">
                    <span>▸ {rangeCaption}</span>
                    <span>PLAN: {planFilter === 'all' ? 'TODOS' : planFilter.toUpperCase()}</span>
                    <span>IVA: {ivaCaption}</span>
                </div>
            </div>

            {/* ── KPIs ── */}
            <div className="dc-kpi-grid">
                <div className="dc-kpi dc-kpi--main">
                    <span className="dc-kpi-label">FACTURACIÓN_BRUTA</span>
                    <span className="dc-kpi-value">{fmtMoney(totals.gross)}</span>
                    {timeRange !== 'all' && <Delta value={d(totals.gross, prevTotals?.gross)} label={deltaLabel} />}
                </div>
                <div className="dc-kpi">
                    <span className="dc-kpi-label">COMISIÓN_MP</span>
                    <span className="dc-kpi-value red">-{fmtMoney(totals.fees)}</span>
                    <span className="dc-kpi-sub">Tasa efectiva {fmtPct(effectiveFee)}</span>
                    {absorbedCost > 0 && (
                        <span className="dc-kpi-sub dc-kpi-sub--warn">
                            {fmtMoney(absorbedCost)} absorbido por cuotas sin interés
                        </span>
                    )}
                </div>
                <div className="dc-kpi">
                    <span className="dc-kpi-label">IVA</span>
                    <span className={`dc-kpi-value ${ivaRate ? 'amber' : 'dim'}`}>{ivaRate ? `-${fmtMoney(totals.iva)}` : '—'}</span>
                    <span className="dc-kpi-sub">{ivaCaption}</span>
                </div>
                <div className="dc-kpi">
                    <span className="dc-kpi-label">GANANCIA_NETA</span>
                    <span className={`dc-kpi-value ${totals.net >= 0 ? 'green' : 'red'}`}>{fmtMoney(totals.net)}</span>
                    {timeRange !== 'all' && <Delta value={d(totals.net, prevTotals?.net)} label={deltaLabel} />}
                </div>
                <div className="dc-kpi">
                    <span className="dc-kpi-label">VENTAS</span>
                    <span className="dc-kpi-value">{totals.count}</span>
                    {timeRange !== 'all' && <Delta value={d(totals.count, prevTotals?.count)} label={deltaLabel} />}
                </div>
                <div className="dc-kpi">
                    <span className="dc-kpi-label">TICKET_PROMEDIO</span>
                    <span className="dc-kpi-value">{fmtMoney(totals.avg)}</span>
                    <span className="dc-kpi-sub">Bruto por venta</span>
                </div>
            </div>

            {/* ── ESTADOS ── */}
            <div className="dc-status-strip">
                <div className="dc-status-item">
                    <span className="dc-dot" style={{ background: COLORS.net }} />
                    APROBADOS <strong>{statusCounts.approved}</strong>
                </div>
                <div className="dc-status-item">
                    <span className="dc-dot" style={{ background: COLORS.iva }} />
                    PENDIENTES <strong>{statusCounts.pending}</strong>
                </div>
                <div className="dc-status-item">
                    <span className="dc-dot" style={{ background: COLORS.fee }} />
                    RECHAZADOS <strong>{statusCounts.rejected}</strong>
                </div>
                <div className="dc-status-item dc-status-item--right">
                    TASA DE APROBACIÓN <strong>{fmtPct(conversionRate)}</strong>
                </div>
            </div>

            {/* ── GRÁFICOS ── */}
            <div className="dc-grid-2">
                <div className="dc-card">
                    <div className="dc-card-header">
                        <span>REVENUE_STREAM</span>
                        <div className="dc-legend-inline">
                            <span><i style={{ background: COLORS.net }} />NETO</span>
                            <span><i style={{ background: COLORS.fee }} />COMISIÓN</span>
                            {ivaRate > 0 && <span><i style={{ background: COLORS.iva }} />IVA</span>}
                        </div>
                    </div>
                    <div className="dc-card-body" style={{ height: 300 }}>
                        {hasChartData ? (
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={chartData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                                    <CartesianGrid strokeDasharray="3 3" stroke="var(--dc-border)" vertical={false} />
                                    <XAxis dataKey="name" stroke="var(--dc-text-dim)" fontSize={10} tickLine={false} axisLine={false} interval="preserveStartEnd" minTickGap={8} />
                                    <YAxis stroke="var(--dc-text-dim)" fontSize={10} tickLine={false} axisLine={false} tickFormatter={fmtCompact} width={44} />
                                    <Tooltip content={<StackTooltip />} cursor={{ fill: 'var(--dc-accent-soft)' }} />
                                    <Bar dataKey="net"  stackId="a" fill={COLORS.net} />
                                    <Bar dataKey="fees" stackId="a" fill={COLORS.fee} />
                                    {ivaRate > 0 && <Bar dataKey="iva" stackId="a" fill={COLORS.iva} radius={[2, 2, 0, 0]} />}
                                </BarChart>
                            </ResponsiveContainer>
                        ) : (
                            <EmptyState text="ZERO_DATA_FOR_SELECTED_RANGE" />
                        )}
                    </div>
                </div>

                <div className="dc-card">
                    <div className="dc-card-header"><span>FUNDS_DISTRIBUTION</span></div>
                    <div className="dc-card-body dc-pie-body">
                        {pieData.length > 0 ? (
                            <>
                                <div className="dc-pie-wrap">
                                    <ResponsiveContainer width="100%" height={190}>
                                        <PieChart>
                                            <Pie data={pieData} innerRadius={58} outerRadius={80} paddingAngle={3} dataKey="value" stroke="none">
                                                {pieData.map((p, i) => <Cell key={i} fill={p.color} />)}
                                            </Pie>
                                            <Tooltip content={({ active, payload }: any) =>
                                                active && payload?.length ? (
                                                    <div className="dc-tooltip">
                                                        <div className="dc-tooltip-row">
                                                            <span style={{ color: payload[0].payload.color }}>{payload[0].name}</span>
                                                            <strong>{fmtMoney(payload[0].value)}</strong>
                                                        </div>
                                                    </div>
                                                ) : null
                                            } />
                                        </PieChart>
                                    </ResponsiveContainer>
                                    <div className="dc-pie-center">
                                        <span>NETO</span>
                                        <strong>{totals.gross ? fmtPct(totals.net / totals.gross) : '0%'}</strong>
                                    </div>
                                </div>
                                <div className="dc-pie-legend">
                                    {[
                                        { name: 'BRUTO',    value: totals.gross, color: 'var(--dc-text)' },
                                        { name: 'COMISIÓN', value: -totals.fees, color: COLORS.fee },
                                        ...(ivaRate ? [{ name: 'IVA', value: -totals.iva, color: COLORS.iva }] : []),
                                        { name: 'NETO',     value: totals.net,   color: COLORS.net },
                                    ].map(row => (
                                        <div key={row.name} className="dc-legend-row">
                                            <span className="dc-legend-name"><i style={{ background: row.color }} />{row.name}</span>
                                            <span className="dc-legend-value">{fmtMoney(row.value)}</span>
                                        </div>
                                    ))}
                                </div>
                            </>
                        ) : (
                            <EmptyState text="SIN_VENTAS_APROBADAS" />
                        )}
                    </div>
                </div>
            </div>

            {/* ── CUOTAS + PLANES ── */}
            <div className="dc-grid-2 dc-grid-2--even">
                <div className="dc-card">
                    <div className="dc-card-header"><span>COMISIONES_POR_CUOTAS</span></div>
                    <div className="dc-card-body dc-table-body">
                        {installmentRows.length ? (
                            <table className="dc-table">
                                <thead>
                                    <tr>
                                        <th>CUOTAS</th>
                                        <th>MODALIDAD</th>
                                        <th>TASA MP</th>
                                        <th className="r">VENTAS</th>
                                        <th className="r">BRUTO</th>
                                        <th className="r">COMISIÓN</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {installmentRows.map(r => (
                                        <tr key={r.key}>
                                            <td>{r.n}x</td>
                                            <td>
                                                <span className={`dc-tag ${r.n === 1 ? '' : r.interestFree ? 'dc-tag--free' : 'dc-tag--surcharge'}`}>
                                                    {r.label}
                                                </span>
                                            </td>
                                            <td><span className="dc-rate">{fmtPct(r.rate)}</span></td>
                                            <td className="r">{r.count}</td>
                                            <td className="r">{fmtMoney(r.gross)}</td>
                                            <td className="r red">-{fmtMoney(r.fee)}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        ) : (
                            <EmptyState text="SIN_VENTAS_APROBADAS" />
                        )}
                    </div>
                </div>

                <div className="dc-card">
                    <div className="dc-card-header"><span>VENTAS_POR_PLAN</span></div>
                    <div className="dc-card-body">
                        {planRows.length ? (
                            <div className="dc-plan-list">
                                {planRows.map(r => {
                                    const share = totals.gross ? r.gross / totals.gross : 0;
                                    return (
                                        <div key={r.plan} className="dc-plan-row">
                                            <div className="dc-plan-top">
                                                <span className="dc-plan-name">{r.plan.toUpperCase()}</span>
                                                <span className="dc-plan-amount">{fmtMoney(r.gross)}</span>
                                            </div>
                                            <div className="dc-bar-track">
                                                <div className="dc-bar-fill" style={{ width: `${share * 100}%` }} />
                                            </div>
                                            <div className="dc-plan-meta">
                                                <span>{r.count} venta{r.count === 1 ? '' : 's'}</span>
                                                <span>{fmtPct(share)} del total</span>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        ) : (
                            <EmptyState text="SIN_VENTAS_APROBADAS" />
                        )}
                    </div>
                </div>
            </div>

            {/* ── ÚLTIMAS TRANSACCIONES ── */}
            <div className="dc-card">
                <div className="dc-card-header">
                    <span>ÚLTIMAS_TRANSACCIONES</span>
                    {hasEstimatedFees && (
                        <span className="dc-header-note">~ comisión estimada (pago anterior al registro de comisiones)</span>
                    )}
                </div>
                <div className="dc-card-body dc-table-body">
                    {recent.length ? (
                        <table className="dc-table">
                            <thead>
                                <tr>
                                    <th>FECHA</th>
                                    <th>REF</th>
                                    <th>EMAIL</th>
                                    <th>PLAN</th>
                                    <th>CUOTAS</th>
                                    <th className="r">MONTO</th>
                                    <th className="r">COMISIÓN MP</th>
                                    <th className="r">NETO</th>
                                    <th className="r">ESTADO</th>
                                </tr>
                            </thead>
                            <tbody>
                                {recent.map(s => {
                                    const approved = s.status === 'approved';
                                    return (
                                        <tr key={s.id}>
                                            <td className="nowrap">
                                                {fmtDateTime(s.date)}
                                                {s.isTest && <span className="dc-tag dc-tag--test">TEST</span>}
                                            </td>
                                            <td className="nowrap dim">{s.reference || '—'}</td>
                                            <td className="ellipsis">{s.email || '—'}</td>
                                            <td>{s.plan.toUpperCase()}</td>
                                            <td className="nowrap">
                                                {s.installments}x{' '}
                                                <span className={`dc-tag ${s.installments === 1 ? '' : s.interestFree ? 'dc-tag--free' : 'dc-tag--surcharge'}`}>
                                                    {financingLabel(s)}
                                                </span>
                                            </td>
                                            <td className="r nowrap">
                                                {fmtMoney(s.amount)}
                                                {s.listAmount !== null && s.listAmount !== s.amount && (
                                                    <span className="dc-cell-sub">lista {fmtMoney(s.listAmount)}</span>
                                                )}
                                            </td>
                                            <td className="r nowrap red">
                                                {approved ? (
                                                    <>
                                                        {s.feeEstimated && '~'}-{fmtMoney(s.fee)}
                                                        <span className="dc-cell-sub">{fmtPct(s.feeRate)}</span>
                                                    </>
                                                ) : <span className="dim">—</span>}
                                            </td>
                                            <td className="r nowrap green">
                                                {approved ? fmtMoney(s.amount - s.fee) : <span className="dim">—</span>}
                                            </td>
                                            <td className="r">
                                                <span className={`dc-badge ${s.status}`}>{STATUS_LABELS[s.rawStatus] ?? s.rawStatus.toUpperCase()}</span>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    ) : (
                        <EmptyState text="SIN_TRANSACCIONES_EN_EL_RANGO" />
                    )}
                </div>
            </div>
        </div>
    );
};

export default Charts;