import React, { useState, useMemo, useEffect, useRef } from 'react';
import axios from 'axios';
import "./saalesHistory.css";
import { UseTheme } from '../contexts/ThemeContext';

interface Sale {
    _id: string;
    createdAt: string;
    email: string;
    status: string;
    status_detail?: string | null;
    plan: string;
    amount: number;
    cuotas?: number;
    discount?: number;
    couponUsed?: string | null;
    orderId?: string;
    telefono?: string;
    nombre?: string;
    dni?: string;
    domicilio?: string;
    ciudad?: string;
    provincia?: string;
    codigoPostal?: string;
    mp_payment_id?: string | null;
    checked?: boolean;
    invoiceSent?: boolean;
    isTest?: boolean;
    fulfillment?: 'none' | 'processing' | 'done' | 'error';
    fulfillmentError?: string | null;
    fulfilledAt?: string | null;
    claimsApplied?: boolean;
    couponConsumed?: boolean;
    amountMismatch?: boolean;
    calculo?: {
        cuotas: number;
        subtotalBase: number;
        descuentoCupon: number;
        costoFinanciacion: number;
        totalFinal: number;
        cupon?: { code: string; discount: number; scope: string } | null;
    };
}

interface InvoiceState {
    file:    File | null;
    sent:    boolean;
    sending: boolean;
}

interface SalesHistoryProps {
    allTickets: Sale[];
}

// ─── Estados ──────────────────────────────────────────────────────────────────
type Tone        = 'ok' | 'warn' | 'error' | 'neutral';
type StatusGroup = 'all' | 'approved' | 'review' | 'failed' | 'void' | 'internal';

const STATUS_INFO: Record<string, { label: string; tone: Tone; group: Exclude<StatusGroup, 'all'>; message: string }> = {
    approved:     { label: 'APROBADO',      tone: 'ok',      group: 'approved', message: 'Pago acreditado.' },
    pending:      { label: 'PENDIENTE',     tone: 'warn',    group: 'review',   message: 'Mercado Pago todavía no confirmó el pago. Lo resuelve el webhook.' },
    in_process:   { label: 'EN REVISIÓN',   tone: 'warn',    group: 'review',   message: 'Mercado Pago está revisando el pago. Puede tardar hasta 2 días hábiles.' },
    authorized:   { label: 'AUTORIZADO',    tone: 'warn',    group: 'review',   message: 'Pago autorizado, pendiente de captura.' },
    in_mediation: { label: 'EN DISPUTA',    tone: 'warn',    group: 'review',   message: 'El comprador inició un reclamo. Revisalo en Mercado Pago.' },
    rejected:     { label: 'RECHAZADO',     tone: 'error',   group: 'failed',   message: 'El pago fue rechazado. No hubo cobro.' },
    failed:       { label: 'FALLIDO',       tone: 'error',   group: 'failed',   message: 'Mercado Pago rechazó el request (datos de tarjeta inválidos). No hubo cobro.' },
    cancelled:    { label: 'CANCELADO',     tone: 'neutral', group: 'void',     message: 'El pago fue cancelado. No hubo cobro.' },
    refunded:     { label: 'REEMBOLSADO',   tone: 'neutral', group: 'void',     message: 'El pago fue devuelto al comprador.' },
    charged_back: { label: 'CONTRACARGO',   tone: 'error',   group: 'void',     message: 'El comprador desconoció el pago ante su banco. Revisalo en Mercado Pago.' },
    created:      { label: 'ORDEN CREADA',  tone: 'neutral', group: 'internal', message: 'Se creó la orden pero nunca llegó a cobrarse (checkout abandonado o cortado).' },
    error:        { label: 'ERROR DE RED',  tone: 'error',   group: 'internal', message: 'Falló la comunicación con Mercado Pago. Verificá en su panel si el cobro existe.' },
};

const UNKNOWN_STATUS = { label: 'DESCONOCIDO', tone: 'neutral' as Tone, group: 'internal' as const, message: 'Estado no reconocido.' };
const getStatusInfo  = (status?: string) => STATUS_INFO[status?.toLowerCase() ?? ''] ?? UNKNOWN_STATUS;

const STATUS_GROUPS: { id: StatusGroup; label: string }[] = [
    { id: 'all',      label: 'Todas' },
    { id: 'approved', label: 'Aprobadas' },
    { id: 'review',   label: 'En revisión' },
    { id: 'failed',   label: 'Fallidas' },
    { id: 'void',     label: 'Sin efecto' },
    { id: 'internal', label: 'Internas' },
];

// Estados donde el monto NO quedó cobrado
const VOID_AMOUNT_STATUSES = ['rejected', 'failed', 'cancelled', 'refunded', 'charged_back', 'created', 'error'];

// Motivo legible del status_detail de Mercado Pago (solo para el admin)
const STATUS_DETAIL_LABELS: Record<string, string> = {
    accredited:                           'Acreditado',
    pending_contingency:                  'En procesamiento por Mercado Pago',
    pending_review_manual:                'En revisión manual de Mercado Pago',
    pending_waiting_payment:              'Esperando que el comprador pague',
    cc_rejected_insufficient_amount:      'Fondos insuficientes',
    cc_rejected_bad_filled_security_code: 'Código de seguridad incorrecto',
    cc_rejected_bad_filled_date:          'Fecha de vencimiento incorrecta',
    cc_rejected_bad_filled_card_number:   'Número de tarjeta incorrecto',
    cc_rejected_bad_filled_other:         'Datos de la tarjeta incorrectos',
    cc_rejected_call_for_authorize:       'El banco pide autorizar el pago',
    cc_rejected_card_disabled:            'Tarjeta deshabilitada',
    cc_rejected_card_error:               'Error de la tarjeta',
    cc_rejected_duplicated_payment:       'Pago duplicado',
    cc_rejected_high_risk:                'Rechazado por prevención de fraude',
    cc_rejected_max_attempts:             'Límite de intentos alcanzado',
    cc_rejected_blacklist:                'Tarjeta bloqueada por Mercado Pago',
    cc_rejected_insufficient_data:        'Faltan datos del comprador',
    cc_rejected_invalid_installments:     'Cuotas no válidas para esta tarjeta',
    cc_rejected_other_reason:             'Rechazado por el banco sin motivo',
    by_collector:                         'Cancelado por el vendedor',
    by_payer:                             'Cancelado por el comprador',
    expired:                              'Venció sin pagarse',
    refunded:                             'Reembolsado',
    partially_refunded:                   'Reembolsado parcialmente',
};

const FULFILLMENT_INFO: Record<string, { label: string; tone: Tone }> = {
    done:       { label: 'Activado',      tone: 'ok' },
    processing: { label: 'Activando…',    tone: 'warn' },
    error:      { label: 'Falló la activación', tone: 'error' },
    none:       { label: 'Sin activar',   tone: 'neutral' },
};

// Situaciones que el admin tiene que revisar sí o sí
function needsAttention(sale: Sale): string | null {
    const status = sale.status?.toLowerCase();
    if (sale.amountMismatch)                                  return 'Monto cobrado distinto al calculado';
    if (status === 'approved' && sale.fulfillment === 'error') return 'Cobrado pero sin activar';
    if (status === 'approved' && sale.fulfillment === 'processing') return 'Activación en curso';
    if (status === 'charged_back')                            return 'Contracargo del comprador';
    if (status === 'in_mediation')                            return 'Reclamo abierto';
    if (status === 'error')                                   return 'Verificar cobro en Mercado Pago';
    return null;
}

const formatMoney = (n?: number) => `$${(n ?? 0).toLocaleString('es-AR')}`;

const SalesHistory: React.FC<SalesHistoryProps> = ({ allTickets }) => {
    const [timeRange, setTimeRange]     = useState('all');
    const [statusGroup, setStatusGroup] = useState<StatusGroup>('all');
    const [searchEmail, setSearchEmail] = useState('');
    const [currentPage, setCurrentPage] = useState(1);
    const [expandedId, setExpandedId]   = useState<string | null>(null);
    const [checkedMap, setCheckedMap]   = useState<Record<string, boolean>>({});
    const [invoiceMap, setInvoiceMap]   = useState<Record<string, InvoiceState>>({});
    const fileInputRefs                 = useRef<Record<string, HTMLInputElement | null>>({});
    const salesPerPage = 10;
    const { theme } = UseTheme();

    const tickets = Array.isArray(allTickets) ? allTickets : [];

    // Sincronizar checked e invoiceSent desde los tickets
    useEffect(() => {
        const cMap: Record<string, boolean>      = {};
        const iMap: Record<string, InvoiceState> = {};
        tickets.forEach(t => {
            cMap[t._id] = t.checked ?? false;
            iMap[t._id] = { file: null, sent: t.invoiceSent ?? false, sending: false };
        });
        setCheckedMap(cMap);
        setInvoiceMap(iMap);
    }, [allTickets]);

    // ── filtro por fecha + búsqueda (antes del filtro de estado, para los contadores) ──
    const baseFiltered = useMemo(() => {
        const now = new Date();
        const q   = searchEmail.trim().toLowerCase();
        return tickets.filter(ticket => {
            if (q) {
                const inEmail = ticket.email?.toLowerCase().includes(q);
                const inOrder = ticket.orderId?.toLowerCase().includes(q);
                if (!inEmail && !inOrder) return false;
            }
            const ticketDate = new Date(ticket.createdAt);
            if (timeRange === 'day')   return ticketDate.toDateString() === now.toDateString();
            if (timeRange === 'month') return ticketDate.getMonth() === now.getMonth() && ticketDate.getFullYear() === now.getFullYear();
            if (timeRange === 'year')  return ticketDate.getFullYear() === now.getFullYear();
            return true;
        });
    }, [tickets, timeRange, searchEmail]);

    const groupCounts = useMemo(() => {
        const counts: Record<StatusGroup, number> = { all: 0, approved: 0, review: 0, failed: 0, void: 0, internal: 0 };
        for (const t of baseFiltered) {
            const g = getStatusInfo(t.status).group;
            counts[g]++;
            if (g !== 'internal') counts.all++;
        }
        return counts;
    }, [baseFiltered]);

    // "Todas" oculta las internas (órdenes creadas sin cobrar / errores de red)
    const filteredTickets = useMemo(() => baseFiltered.filter(t => {
        const g = getStatusInfo(t.status).group;
        return statusGroup === 'all' ? g !== 'internal' : g === statusGroup;
    }), [baseFiltered, statusGroup]);

    const approvedTotal = useMemo(
        () => baseFiltered.filter(t => t.status?.toLowerCase() === 'approved').reduce((acc, t) => acc + (t.amount || 0), 0),
        [baseFiltered]
    );

    const attentionCount = useMemo(() => baseFiltered.filter(t => needsAttention(t)).length, [baseFiltered]);

    const totalPages   = Math.ceil(filteredTickets.length / salesPerPage);
    const currentSales = filteredTickets.slice((currentPage - 1) * salesPerPage, currentPage * salesPerPage);

    useEffect(() => { setCurrentPage(1); setExpandedId(null); }, [timeRange, searchEmail, statusGroup]);

    const toggleExpand = (id: string) =>
        setExpandedId(prev => prev === id ? null : id);

    const handleToggleChecked = async (sale: Sale) => {
        const current = checkedMap[sale._id] ?? false;
        const next    = !current;
        const accion  = next ? "marcar como revisada" : "desmarcar";
        if (!window.confirm(`¿Confirmar ${accion} la venta ${sale.orderId || sale._id}?`)) return;
        try {
            await axios.patch(
                `${import.meta.env.VITE_API_URL}/api/payments/${sale._id}/checked`,
                { checked: next },
                { withCredentials: true }
            );
            setCheckedMap(prev => ({ ...prev, [sale._id]: next }));
        } catch (err) {
            alert("Error al actualizar la venta.");
            console.error(err);
        }
    };

    const handleFileChange = (saleId: string, e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0] ?? null;
        if (!file) return;
        setInvoiceMap(prev => ({
            ...prev,
            [saleId]: { ...prev[saleId], file, sent: false }
        }));
    };

    const handleSendInvoice = async (sale: Sale) => {
        const inv = invoiceMap[sale._id];
        if (!inv?.file) return;
        if (!window.confirm(`¿Enviar la factura "${inv.file.name}" a ${sale.email}?`)) return;
        setInvoiceMap(prev => ({ ...prev, [sale._id]: { ...prev[sale._id], sending: true } }));
        try {
            const formData = new FormData();
            formData.append('invoice', inv.file);
            formData.append('email',   sale.email);
            await axios.post(
                `${import.meta.env.VITE_API_URL}/${sale._id}/send-invoice`,
                formData,
                { withCredentials: true, headers: { 'Content-Type': 'multipart/form-data' } }
            );
            setInvoiceMap(prev => ({
                ...prev,
                [sale._id]: { file: inv.file, sent: true, sending: false }
            }));
        } catch (err) {
            alert("Error al enviar la factura.");
            console.error(err);
            setInvoiceMap(prev => ({ ...prev, [sale._id]: { ...prev[sale._id], sending: false } }));
        }
    };

    // ─────────────────────────────────────────────────────────────
    return (
        <div className={`sh-container ${theme}`}>

            {/* ── HEADER ── */}
            <header className="sh-header">
                <div className="sh-title-group">
                    <h2 className="sh-title">SALES_<span>HISTORY</span></h2>
                    <span className="sh-count">
                        RECORDS: {filteredTickets.length} · APROBADO: {formatMoney(approvedTotal)}
                    </span>
                </div>
                <div className="sh-controls">
                    <input
                        type="text"
                        placeholder="EMAIL_U_ORDER_ID..."
                        value={searchEmail}
                        onChange={(e) => setSearchEmail(e.target.value)}
                        className="sh-search-input"
                    />
                    <select value={timeRange} onChange={(e) => setTimeRange(e.target.value)} className="sh-select">
                        <option value="all">ALL_TIME</option>
                        <option value="day">TODAY</option>
                        <option value="month">THIS_MONTH</option>
                        <option value="year">THIS_YEAR</option>
                    </select>
                </div>
            </header>

            {/* ── AVISO DE OPERACIONES A REVISAR ── */}
            {attentionCount > 0 && (
                <div className="sh-alert-banner">
                    <span className="sh-alert-dot" />
                    <span>
                        <strong>{attentionCount} operación(es) requieren revisión</strong> — cobros sin activar,
                        contracargos, reclamos o errores de comunicación con Mercado Pago. Están marcadas con ⚠ en la lista.
                    </span>
                </div>
            )}

            {/* ── FILTRO POR ESTADO ── */}
            <div className="sh-status-tabs" role="tablist">
                {STATUS_GROUPS.map(g => (
                    <button
                        key={g.id}
                        type="button"
                        role="tab"
                        aria-selected={statusGroup === g.id}
                        className={`sh-status-tab sh-status-tab--${g.id}${statusGroup === g.id ? ' active' : ''}`}
                        onClick={() => setStatusGroup(g.id)}
                    >
                        {g.label}
                        <span className="sh-status-tab-count">{groupCounts[g.id]}</span>
                    </button>
                ))}
            </div>

            {/* ── CARD ── */}
            <div className="sh-card-header">SALES_DATABASE_LOGS</div>
            <div className="sh-card-wrapper">
                <div className="sh-list">
                    {currentSales.length > 0 ? currentSales.map((sale) => {
                        const isChecked  = checkedMap[sale._id] ?? false;
                        const isExpanded = expandedId === sale._id;
                        const inv        = invoiceMap[sale._id] ?? { file: null, sent: false, sending: false };
                        const info       = getStatusInfo(sale.status);
                        const statusKey  = sale.status?.toLowerCase() ?? '';
                        const isApproved = statusKey === 'approved';
                        const isVoid     = VOID_AMOUNT_STATUSES.includes(statusKey);
                        const attention  = needsAttention(sale);
                        const reason     = sale.status_detail ? (STATUS_DETAIL_LABELS[sale.status_detail] ?? null) : null;
                        const fulfill    = sale.fulfillment ? FULFILLMENT_INFO[sale.fulfillment] : null;

                        return (
                            <div
                                key={sale._id}
                                className={`sh-row-wrapper sh-tone-${info.tone} ${isChecked ? 'sh-row-checked' : ''}`}
                            >

                                {/* ── FILA PRINCIPAL ── */}
                                <div className="sh-row">
                                    <div className="sh-main-info">
                                        <span className="sh-date">
                                            [{new Date(sale.createdAt).toLocaleDateString('es-AR')}]
                                        </span>
                                        <div className="sh-user-group">
                                            <span className="sh-user">
                                                {sale.email}
                                                {sale.isTest && <span className="sh-test-badge">TEST</span>}
                                            </span>
                                            {(attention || (!isApproved && reason)) && (
                                                <span className={`sh-row-note ${attention ? 'sh-row-note--error' : `sh-row-note--${info.tone}`}`}>
                                                    {attention ? `⚠ ${attention}` : reason}
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                    <div className="sh-details">
                                        <span className={`sh-state sh-state--${info.tone}`}>{info.label}</span>
                                        <span className="sh-plan">{sale.plan}</span>
                                        <span className={`sh-amount ${isVoid ? 'sh-amount-void' : ''}`}>{formatMoney(sale.amount)}</span>
                                        <button
                                            className="sh-btn-detail"
                                            onClick={() => toggleExpand(sale._id)}
                                        >
                                            {isExpanded ? 'CERRAR' : 'VER_DETALLE'}
                                        </button>
                                        <button
                                            className={`sh-btn-check ${isChecked ? 'checked' : ''}`}
                                            onClick={() => handleToggleChecked(sale)}
                                            title={isChecked ? 'Desmarcar revisada' : 'Marcar como revisada'}
                                        >
                                            {isChecked ? '✓ REVISADA' : '○ REVISAR'}
                                        </button>
                                    </div>
                                </div>

                                {/* ── PANEL DETALLE ── */}
                                {isExpanded && (
                                    <div className="sh-detail-panel">

                                        {/* mensaje del estado */}
                                        <div className={`sh-op-message sh-op-message--${attention ? 'error' : info.tone}`}>
                                            <strong>{attention ? `⚠ ${attention}` : info.label}</strong>
                                            <span>{info.message}</span>
                                            {reason && <span>Motivo: {reason}</span>}
                                            {sale.fulfillment === 'error' && sale.fulfillmentError && (
                                                <span>Error de activación: {sale.fulfillmentError}</span>
                                            )}
                                            {sale.amountMismatch && (
                                                <span>Mercado Pago informó un monto distinto al calculado por el backend. Verificá el cobro antes de activar nada a mano.</span>
                                            )}
                                        </div>

                                        <div className="sh-detail-grid">

                                            {/* datos del cliente */}
                                            <div className="sh-detail-col">
                                                <span className="sh-detail-title">// DATOS_CLIENTE</span>
                                                <div className="sh-detail-row"><span>Nombre</span><strong>{sale.nombre || '—'}</strong></div>
                                                <div className="sh-detail-row"><span>DNI</span><strong>{sale.dni || '—'}</strong></div>
                                                <div className="sh-detail-row"><span>Email</span><strong>{sale.email}</strong></div>
                                                <div className="sh-detail-row"><span>Teléfono</span><strong>{sale.telefono || '—'}</strong></div>
                                                <div className="sh-detail-row"><span>Fecha</span><strong>{new Date(sale.createdAt).toLocaleString('es-AR')}</strong></div>
                                            </div>

                                            {/* estado de la operación */}
                                            <div className="sh-detail-col">
                                                <span className="sh-detail-title">// ESTADO_OPERACIÓN</span>
                                                <div className="sh-detail-row">
                                                    <span>Estado</span>
                                                    <strong><span className={`sh-state sh-state--${info.tone}`}>{info.label}</span></strong>
                                                </div>
                                                <div className="sh-detail-row">
                                                    <span>Detalle MP</span>
                                                    <strong className="sh-mono">{sale.status_detail || '—'}</strong>
                                                </div>
                                                <div className="sh-detail-row">
                                                    <span>Activación</span>
                                                    <strong className={fulfill ? `sh-text--${fulfill.tone}` : ''}>
                                                        {fulfill?.label ?? '—'}
                                                    </strong>
                                                </div>
                                                {sale.fulfilledAt && (
                                                    <div className="sh-detail-row">
                                                        <span>Activado el</span>
                                                        <strong>{new Date(sale.fulfilledAt).toLocaleString('es-AR')}</strong>
                                                    </div>
                                                )}
                                                <div className="sh-detail-row">
                                                    <span>Claims</span>
                                                    <strong className={sale.claimsApplied ? 'sh-text--ok' : ''}>
                                                        {sale.claimsApplied === undefined ? '—' : sale.claimsApplied ? 'Aplicadas' : 'No aplicadas'}
                                                    </strong>
                                                </div>
                                                <div className="sh-detail-row">
                                                    <span>Cupón</span>
                                                    <strong>
                                                        {!sale.couponUsed ? '—' : sale.couponConsumed ? 'Consumido' : 'No consumido'}
                                                    </strong>
                                                </div>
                                                <div className="sh-detail-row"><span>Order ID</span><strong className="sh-mono">{sale.orderId || '—'}</strong></div>
                                                <div className="sh-detail-row"><span>MP ID</span><strong className="sh-mono">{sale.mp_payment_id || '—'}</strong></div>
                                            </div>

                                            {/* resumen financiero */}
                                            <div className="sh-detail-col">
                                                <span className="sh-detail-title">// RESUMEN_PAGO</span>
                                                {sale.calculo ? (
                                                    <>
                                                        <div className="sh-detail-row"><span>Cuotas</span><strong>{sale.calculo.cuotas}x</strong></div>
                                                        <div className="sh-detail-row"><span>Subtotal base</span><strong>{formatMoney(sale.calculo.subtotalBase)}</strong></div>
                                                        {sale.calculo.descuentoCupon > 0 && (
                                                            <div className="sh-detail-row sh-detail-green">
                                                                <span>Descuento cupón</span>
                                                                <strong>- {formatMoney(sale.calculo.descuentoCupon)}</strong>
                                                            </div>
                                                        )}
                                                        {sale.calculo.costoFinanciacion > 0 && (
                                                            <div className="sh-detail-row sh-detail-red">
                                                                <span>Costo financiación</span>
                                                                <strong>+ {formatMoney(sale.calculo.costoFinanciacion)}</strong>
                                                            </div>
                                                        )}
                                                        {sale.calculo.cupon && (
                                                            <div className="sh-detail-row">
                                                                <span>Cupón</span>
                                                                <strong>{sale.calculo.cupon.code} — {sale.calculo.cupon.discount}% ({sale.calculo.cupon.scope})</strong>
                                                            </div>
                                                        )}
                                                        <div className="sh-detail-row sh-detail-total">
                                                            <span>{isVoid ? 'TOTAL (NO COBRADO)' : 'TOTAL FINAL'}</span>
                                                            <strong className={isVoid ? 'sh-amount-void' : ''}>{formatMoney(sale.calculo.totalFinal)}</strong>
                                                        </div>
                                                    </>
                                                ) : (
                                                    <>
                                                        <div className="sh-detail-row">
                                                            <span>Cuotas</span>
                                                            <strong>
                                                                {(sale.cuotas ?? 1) > 1 ? `${sale.cuotas}x CON INTERÉS` : '1x (SIN INTERÉS)'}
                                                            </strong>
                                                        </div>
                                                        {sale.couponUsed && (
                                                            <div className="sh-detail-row sh-detail-green">
                                                                <span>Cupón</span>
                                                                <strong>{sale.couponUsed} — {sale.discount}%</strong>
                                                            </div>
                                                        )}
                                                        <div className="sh-detail-row sh-detail-total">
                                                            <span>{isVoid ? 'TOTAL (NO COBRADO)' : 'TOTAL COBRADO'}</span>
                                                            <strong className={isVoid ? 'sh-amount-void' : ''}>{formatMoney(sale.amount)}</strong>
                                                        </div>
                                                    </>
                                                )}
                                            </div>

                                            {/* datos de facturación */}
                                            <div className="sh-detail-col">
                                                <span className="sh-detail-title">// DATOS_FACTURACIÓN</span>
                                                <div className="sh-detail-row"><span>Domicilio</span><strong>{sale.domicilio || '—'}</strong></div>
                                                <div className="sh-detail-row"><span>Ciudad</span><strong>{sale.ciudad || '—'}</strong></div>
                                                <div className="sh-detail-row"><span>Provincia</span><strong>{sale.provincia || '—'}</strong></div>
                                                <div className="sh-detail-row"><span>Código Postal</span><strong>{sale.codigoPostal || '—'}</strong></div>
                                            </div>
                                        </div>

                                        {/* sección factura — solo pagos aprobados */}
                                        {isApproved && (
                                            <div className="sh-invoice-section">
                                                <span className="sh-detail-title">// FACTURA_DE_COMPRA</span>
                                                <div className="sh-invoice-controls">
                                                    <input
                                                        type="file"
                                                        accept=".pdf,.png,.jpg,.jpeg"
                                                        id={`invoice-file-${sale._id}`}
                                                        ref={el => { fileInputRefs.current[sale._id] = el; }}
                                                        onChange={(e) => handleFileChange(sale._id, e)}
                                                        className="sh-file-input-hidden"
                                                    />
                                                    <label
                                                        htmlFor={`invoice-file-${sale._id}`}
                                                        className={`sh-btn-file ${inv.file ? 'has-file' : ''} ${inv.sent ? 'is-sent' : ''}`}
                                                    >
                                                        {inv.sent
                                                            ? `✓ ${inv.file?.name ?? 'FACTURA'}`
                                                            : inv.file
                                                                ? `◈ ${inv.file.name}`
                                                                : '⊕ CARGAR_FACTURA'
                                                        }
                                                    </label>
                                                    {inv.file && (
                                                        <button
                                                            className={`sh-btn-send-invoice ${inv.sent ? 'sent' : ''}`}
                                                            onClick={() => handleSendInvoice(sale)}
                                                            disabled={inv.sent || inv.sending}
                                                        >
                                                            {inv.sending
                                                                ? '↻ ENVIANDO...'
                                                                : inv.sent
                                                                    ? '✓ FACTURA_ENVIADA'
                                                                    : '→ ENVIAR_FACTURA'
                                                            }
                                                        </button>
                                                    )}
                                                </div>
                                            </div>
                                        )}

                                    </div>
                                )}
                            </div>
                        );
                    }) : (
                        <div className="sh-empty">ZERO_RESULTS_FOR_CURRENT_QUERY</div>
                    )}
                </div>

                {totalPages > 1 && (
                    <div className="sh-pagination">
                        <button disabled={currentPage === 1} onClick={() => setCurrentPage(p => p - 1)} className="sh-pag-btn">PREV</button>
                        <span className="sh-pag-info">BLOCK {currentPage} / {totalPages}</span>
                        <button disabled={currentPage === totalPages} onClick={() => setCurrentPage(p => p + 1)} className="sh-pag-btn">NEXT</button>
                    </div>
                )}
            </div>
        </div>
    );
};

export default SalesHistory;