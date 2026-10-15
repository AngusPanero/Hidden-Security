import React, { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
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
    done:       { label: 'Activado',            tone: 'ok' },
    processing: { label: 'Activando…',          tone: 'warn' },
    error:      { label: 'Falló la activación', tone: 'error' },
    none:       { label: 'Sin activar',         tone: 'neutral' },
};

// Situaciones que el admin tiene que revisar sí o sí
function needsAttention(sale: Sale): string | null {
    const status = sale.status?.toLowerCase();
    if (sale.amountMismatch)                                         return 'Monto cobrado distinto al calculado';
    if (status === 'approved' && sale.fulfillment === 'error')       return 'Cobrado pero sin activar';
    if (status === 'approved' && sale.fulfillment === 'processing')  return 'Activación en curso';
    if (status === 'charged_back')                                   return 'Contracargo del comprador';
    if (status === 'in_mediation')                                   return 'Reclamo abierto';
    if (status === 'error')                                          return 'Verificar cobro en Mercado Pago';
    return null;
}

const formatMoney     = (n?: number) => `$${(n ?? 0).toLocaleString('es-AR')}`;
const formatShortDate = (d: string)  => new Date(d).toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: '2-digit' });
const formatDateTime  = (d: string)  => new Date(d).toLocaleString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });

// ─── Fila de dato dentro del modal ────────────────────────────────────────────
const DetailRow: React.FC<{ label: string; className?: string; children: React.ReactNode }> = ({ label, className = '', children }) => (
    <div className={`sh-detail-row ${className}`}>
        <dt>{label}</dt>
        <dd>{children}</dd>
    </div>
);

// ─── Modal de detalle ─────────────────────────────────────────────────────────
interface SaleModalProps {
    sale:            Sale;
    theme:           string;
    isChecked:       boolean;
    inv:             InvoiceState;
    onClose:         () => void;
    onToggleChecked: (sale: Sale) => void;
    onFileChange:    (saleId: string, e: React.ChangeEvent<HTMLInputElement>) => void;
    onSendInvoice:   (sale: Sale) => void;
}

const SaleModal: React.FC<SaleModalProps> = ({
    sale, theme, isChecked, inv, onClose, onToggleChecked, onFileChange, onSendInvoice,
}) => {
    const closeRef = useRef<HTMLButtonElement>(null);
    const startY   = useRef<number | null>(null);
    const [dragY, setDragY] = useState(0);

    // Bloquear scroll del fondo + cerrar con Escape
    useEffect(() => {
        const prevOverflow = document.body.style.overflow;
        document.body.style.overflow = 'hidden';
        const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
        window.addEventListener('keydown', onKey);
        closeRef.current?.focus({ preventScroll: true });
        return () => {
            document.body.style.overflow = prevOverflow;
            window.removeEventListener('keydown', onKey);
        };
    }, [onClose]);

    // Deslizar hacia abajo para cerrar (mobile)
    const onTouchStart = (e: React.TouchEvent) => { startY.current = e.touches[0].clientY; };
    const onTouchMove  = (e: React.TouchEvent) => {
        if (startY.current === null) return;
        setDragY(Math.max(0, e.touches[0].clientY - startY.current));
    };
    const onTouchEnd   = () => {
        if (dragY > 110) onClose();
        else setDragY(0);
        startY.current = null;
    };

    const info       = getStatusInfo(sale.status);
    const statusKey  = sale.status?.toLowerCase() ?? '';
    const isApproved = statusKey === 'approved';
    const isVoid     = VOID_AMOUNT_STATUSES.includes(statusKey);
    const attention  = needsAttention(sale);
    const reason     = sale.status_detail ? (STATUS_DETAIL_LABELS[sale.status_detail] ?? null) : null;
    const fulfill    = sale.fulfillment ? FULFILLMENT_INFO[sale.fulfillment] : null;
    const total      = sale.calculo?.totalFinal ?? sale.amount;

    return createPortal(
        <div className={`sh-modal-root ${theme}`} onClick={onClose}>
            <div
                className="sh-modal"
                role="dialog"
                aria-modal="true"
                aria-labelledby="sh-modal-title"
                onClick={(e) => e.stopPropagation()}
                style={dragY ? { transform: `translateY(${dragY}px)`, transition: 'none' } : undefined}
            >
                {/* ── cabecera (zona de arrastre) ── */}
                <div
                    className="sh-modal-drag"
                    onTouchStart={onTouchStart}
                    onTouchMove={onTouchMove}
                    onTouchEnd={onTouchEnd}
                >
                    <span className="sh-modal-handle" aria-hidden="true" />
                    <header className="sh-modal-header">
                        <div className="sh-modal-heading">
                            <div className="sh-modal-badges">
                                <span className={`sh-state sh-state--${info.tone}`}>{info.label}</span>
                                {sale.isTest && <span className="sh-test-badge">TEST</span>}
                            </div>
                            <h3 id="sh-modal-title" className={`sh-modal-amount ${isVoid ? 'sh-amount-void' : ''}`}>
                                {formatMoney(total)}
                            </h3>
                            <span className="sh-modal-sub">{sale.plan} · {formatDateTime(sale.createdAt)}</span>
                        </div>
                        <button ref={closeRef} type="button" className="sh-modal-close" onClick={onClose} aria-label="Cerrar detalle">
                            ✕
                        </button>
                    </header>
                </div>

                {/* ── cuerpo ── */}
                <div className="sh-modal-body">

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

                    <div className="sh-sections">

                        <section className="sh-section">
                            <h4 className="sh-section-title">Cliente</h4>
                            <dl>
                                <DetailRow label="Nombre">{sale.nombre || '—'}</DetailRow>
                                <DetailRow label="DNI">{sale.dni || '—'}</DetailRow>
                                <DetailRow label="Email">
                                    <a href={`mailto:${sale.email}`} className="sh-link">{sale.email}</a>
                                </DetailRow>
                                <DetailRow label="Teléfono">
                                    {sale.telefono
                                        ? <a href={`tel:${sale.telefono}`} className="sh-link">{sale.telefono}</a>
                                        : '—'}
                                </DetailRow>
                            </dl>
                        </section>

                        <section className="sh-section">
                            <h4 className="sh-section-title">Pago</h4>
                            <dl>
                                {sale.calculo ? (
                                    <>
                                        <DetailRow label="Cuotas">{sale.calculo.cuotas}x</DetailRow>
                                        <DetailRow label="Subtotal">{formatMoney(sale.calculo.subtotalBase)}</DetailRow>
                                        {sale.calculo.descuentoCupon > 0 && (
                                            <DetailRow label="Desc. cupón" className="sh-detail-green">
                                                − {formatMoney(sale.calculo.descuentoCupon)}
                                            </DetailRow>
                                        )}
                                        {sale.calculo.costoFinanciacion > 0 && (
                                            <DetailRow label="Financiación" className="sh-detail-red">
                                                + {formatMoney(sale.calculo.costoFinanciacion)}
                                            </DetailRow>
                                        )}
                                        {sale.calculo.cupon && (
                                            <DetailRow label="Cupón">
                                                {sale.calculo.cupon.code} — {sale.calculo.cupon.discount}% ({sale.calculo.cupon.scope})
                                            </DetailRow>
                                        )}
                                        <DetailRow label={isVoid ? 'Total (no cobrado)' : 'Total final'} className={`sh-detail-total ${isVoid ? 'is-void' : ''}`}>
                                            {formatMoney(sale.calculo.totalFinal)}
                                        </DetailRow>
                                    </>
                                ) : (
                                    <>
                                        <DetailRow label="Cuotas">
                                            {(sale.cuotas ?? 1) > 1 ? `${sale.cuotas}x con interés` : '1x sin interés'}
                                        </DetailRow>
                                        {sale.couponUsed && (
                                            <DetailRow label="Cupón" className="sh-detail-green">
                                                {sale.couponUsed} — {sale.discount}%
                                            </DetailRow>
                                        )}
                                        <DetailRow label={isVoid ? 'Total (no cobrado)' : 'Total cobrado'} className={`sh-detail-total ${isVoid ? 'is-void' : ''}`}>
                                            {formatMoney(sale.amount)}
                                        </DetailRow>
                                    </>
                                )}
                            </dl>
                        </section>

                        <section className="sh-section">
                            <h4 className="sh-section-title">Operación</h4>
                            <dl>
                                <DetailRow label="Detalle MP"><span className="sh-mono">{sale.status_detail || '—'}</span></DetailRow>
                                <DetailRow label="Activación">
                                    <span className={fulfill ? `sh-text--${fulfill.tone}` : ''}>{fulfill?.label ?? '—'}</span>
                                </DetailRow>
                                {sale.fulfilledAt && (
                                    <DetailRow label="Activado el">{formatDateTime(sale.fulfilledAt)}</DetailRow>
                                )}
                                <DetailRow label="Claims">
                                    <span className={sale.claimsApplied ? 'sh-text--ok' : ''}>
                                        {sale.claimsApplied === undefined ? '—' : sale.claimsApplied ? 'Aplicadas' : 'No aplicadas'}
                                    </span>
                                </DetailRow>
                                <DetailRow label="Cupón">
                                    {!sale.couponUsed ? '—' : sale.couponConsumed ? 'Consumido' : 'No consumido'}
                                </DetailRow>
                                <DetailRow label="Order ID"><span className="sh-mono">{sale.orderId || '—'}</span></DetailRow>
                                <DetailRow label="MP ID"><span className="sh-mono">{sale.mp_payment_id || '—'}</span></DetailRow>
                            </dl>
                        </section>

                        <section className="sh-section">
                            <h4 className="sh-section-title">Facturación</h4>
                            <dl>
                                <DetailRow label="Domicilio">{sale.domicilio || '—'}</DetailRow>
                                <DetailRow label="Ciudad">{sale.ciudad || '—'}</DetailRow>
                                <DetailRow label="Provincia">{sale.provincia || '—'}</DetailRow>
                                <DetailRow label="C.P.">{sale.codigoPostal || '—'}</DetailRow>
                            </dl>
                        </section>
                    </div>

                    {/* factura — solo pagos aprobados */}
                    {isApproved && (
                        <section className="sh-section sh-invoice-section">
                            <h4 className="sh-section-title">Factura de compra</h4>
                            <div className="sh-invoice-controls">
                                <input
                                    type="file"
                                    accept=".pdf,.png,.jpg,.jpeg"
                                    id={`invoice-file-${sale._id}`}
                                    onChange={(e) => onFileChange(sale._id, e)}
                                    className="sh-file-input-hidden"
                                />
                                <label
                                    htmlFor={`invoice-file-${sale._id}`}
                                    className={`sh-btn-file ${inv.file ? 'has-file' : ''} ${inv.sent ? 'is-sent' : ''}`}
                                >
                                    {inv.sent
                                        ? `✓ ${inv.file?.name ?? 'Factura enviada'}`
                                        : inv.file
                                            ? `◈ ${inv.file.name}`
                                            : '⊕ Cargar factura'}
                                </label>
                                {inv.file && (
                                    <button
                                        type="button"
                                        className={`sh-btn-send-invoice ${inv.sent ? 'sent' : ''}`}
                                        onClick={() => onSendInvoice(sale)}
                                        disabled={inv.sent || inv.sending}
                                    >
                                        {inv.sending ? '↻ Enviando…' : inv.sent ? '✓ Enviada' : '→ Enviar factura'}
                                    </button>
                                )}
                            </div>
                        </section>
                    )}
                </div>

                {/* ── pie ── */}
                <footer className="sh-modal-footer">
                    <button
                        type="button"
                        className={`sh-btn-check sh-btn-check--block ${isChecked ? 'checked' : ''}`}
                        onClick={() => onToggleChecked(sale)}
                    >
                        {isChecked ? '✓ Revisada — desmarcar' : '○ Marcar como revisada'}
                    </button>
                </footer>
            </div>
        </div>,
        document.body
    );
};

// ─── Componente principal ─────────────────────────────────────────────────────
const SalesHistory: React.FC<SalesHistoryProps> = ({ allTickets }) => {
    const [timeRange, setTimeRange]     = useState('all');
    const [statusGroup, setStatusGroup] = useState<StatusGroup>('all');
    const [searchEmail, setSearchEmail] = useState('');
    const [currentPage, setCurrentPage] = useState(1);
    const [selectedId, setSelectedId]   = useState<string | null>(null);
    const [checkedMap, setCheckedMap]   = useState<Record<string, boolean>>({});
    const [invoiceMap, setInvoiceMap]   = useState<Record<string, InvoiceState>>({});
    const listTopRef                    = useRef<HTMLDivElement>(null);
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

    const selectedSale = selectedId ? tickets.find(t => t._id === selectedId) ?? null : null;

    useEffect(() => { setCurrentPage(1); }, [timeRange, searchEmail, statusGroup]);

    const openSale   = (id: string) => setSelectedId(id);
    const closeModal = useCallback(() => setSelectedId(null), []);

    const goToPage = (page: number) => {
        setCurrentPage(page);
        listTopRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    };

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
                    <div className="sh-stats">
                        <div className="sh-stat">
                            <span className="sh-stat-label">Registros</span>
                            <strong className="sh-stat-value">{filteredTickets.length}</strong>
                        </div>
                        <div className="sh-stat">
                            <span className="sh-stat-label">Aprobado</span>
                            <strong className="sh-stat-value sh-stat-value--accent">{formatMoney(approvedTotal)}</strong>
                        </div>
                    </div>
                </div>
                <div className="sh-controls">
                    <input
                        type="search"
                        inputMode="email"
                        placeholder="Buscar email u order ID…"
                        value={searchEmail}
                        onChange={(e) => setSearchEmail(e.target.value)}
                        className="sh-search-input"
                    />
                    <select value={timeRange} onChange={(e) => setTimeRange(e.target.value)} className="sh-select">
                        <option value="all">Todo</option>
                        <option value="day">Hoy</option>
                        <option value="month">Este mes</option>
                        <option value="year">Este año</option>
                    </select>
                </div>
            </header>

            {/* ── AVISO DE OPERACIONES A REVISAR ── */}
            {attentionCount > 0 && (
                <div className="sh-alert-banner">
                    <span className="sh-alert-dot" />
                    <span>
                        <strong>{attentionCount} operación(es) requieren revisión</strong> — cobros sin activar,
                        contracargos, reclamos o errores con Mercado Pago. Están marcadas con ⚠.
                    </span>
                </div>
            )}

            {/* ── FILTRO POR ESTADO ── */}
            <div className="sh-status-tabs" role="tablist" ref={listTopRef}>
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

            {/* ── LISTA ── */}
            <div className="sh-card-wrapper">
                <div className="sh-list">
                    {currentSales.length > 0 ? currentSales.map((sale) => {
                        const isChecked = checkedMap[sale._id] ?? false;
                        const info      = getStatusInfo(sale.status);
                        const statusKey = sale.status?.toLowerCase() ?? '';
                        const isVoid    = VOID_AMOUNT_STATUSES.includes(statusKey);
                        const attention = needsAttention(sale);
                        const reason    = sale.status_detail ? (STATUS_DETAIL_LABELS[sale.status_detail] ?? null) : null;
                        const note      = attention ? `⚠ ${attention}` : (statusKey !== 'approved' ? reason : null);

                        return (
                            <div
                                key={sale._id}
                                role="button"
                                tabIndex={0}
                                aria-label={`Ver detalle de la venta de ${sale.email}`}
                                className={`sh-row sh-tone-${info.tone}${isChecked ? ' sh-row--checked' : ''}${attention ? ' sh-row--attention' : ''}`}
                                onClick={() => openSale(sale._id)}
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter' || e.key === ' ') {
                                        e.preventDefault();
                                        openSale(sale._id);
                                    }
                                }}
                            >
                                <span className="sh-row-date">{formatShortDate(sale.createdAt)}</span>

                                <span className={`sh-row-state sh-state sh-state--${info.tone}`}>{info.label}</span>

                                <div className="sh-row-user">
                                    <span className="sh-user">
                                        {sale.email}
                                        {sale.isTest && <span className="sh-test-badge">TEST</span>}
                                    </span>
                                    {note && (
                                        <span className={`sh-row-note ${attention ? 'sh-row-note--error' : `sh-row-note--${info.tone}`}`}>
                                            {note}
                                        </span>
                                    )}
                                </div>

                                <div className="sh-row-money">
                                    <span className="sh-plan">{sale.plan}</span>
                                    <span className={`sh-amount ${isVoid ? 'sh-amount-void' : ''}`}>{formatMoney(sale.amount)}</span>
                                </div>

                                <button
                                    type="button"
                                    className={`sh-row-check sh-btn-check ${isChecked ? 'checked' : ''}`}
                                    onClick={(e) => { e.stopPropagation(); handleToggleChecked(sale); }}
                                    onKeyDown={(e) => e.stopPropagation()}
                                    title={isChecked ? 'Desmarcar revisada' : 'Marcar como revisada'}
                                    aria-pressed={isChecked}
                                >
                                    {isChecked ? '✓ Revisada' : '○ Revisar'}
                                </button>

                                <span className="sh-row-chevron" aria-hidden="true">›</span>
                            </div>
                        );
                    }) : (
                        <div className="sh-empty">Sin resultados para esta búsqueda</div>
                    )}
                </div>

                {totalPages > 1 && (
                    <div className="sh-pagination">
                        <button type="button" disabled={currentPage === 1} onClick={() => goToPage(currentPage - 1)} className="sh-pag-btn">← Anterior</button>
                        <span className="sh-pag-info">{currentPage} / {totalPages}</span>
                        <button type="button" disabled={currentPage === totalPages} onClick={() => goToPage(currentPage + 1)} className="sh-pag-btn">Siguiente →</button>
                    </div>
                )}
            </div>

            {/* ── MODAL DETALLE ── */}
            {selectedSale && (
                <SaleModal
                    sale={selectedSale}
                    theme={theme}
                    isChecked={checkedMap[selectedSale._id] ?? false}
                    inv={invoiceMap[selectedSale._id] ?? { file: null, sent: false, sending: false }}
                    onClose={closeModal}
                    onToggleChecked={handleToggleChecked}
                    onFileChange={handleFileChange}
                    onSendInvoice={handleSendInvoice}
                />
            )}
        </div>
    );
};

export default SalesHistory;