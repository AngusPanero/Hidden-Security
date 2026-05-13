import React, { useState, useMemo, useEffect, useRef } from 'react';
import axios from 'axios';
import "./saalesHistory.css";
import { UseTheme } from '../contexts/ThemeContext';

interface Sale {
    _id: string;
    createdAt: string;
    email: string;
    status: string;
    plan: string;
    amount: number;
    orderId?: string;
    phone?: string;
    mp_payment_id?: string;
    checked?: boolean;
    invoiceSent?: boolean;
    items?: {
        nombre: string;
        cantidad: number;
        precioUnitario: number;
        totalItem: number;
        tasa?: string;
        aplicaInteres?: boolean;
        descuentoCupon?: number;
        skuPadre?: string;
        varianteId?: string | null;
        varianteLabel?: string | null;
    }[];
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

const SalesHistory: React.FC<SalesHistoryProps> = ({ allTickets }) => {
    const [timeRange, setTimeRange]     = useState('all');
    const [searchEmail, setSearchEmail] = useState('');
    const [currentPage, setCurrentPage] = useState(1);
    const [expandedId, setExpandedId]   = useState<string | null>(null);
    const [checkedMap, setCheckedMap]   = useState<Record<string, boolean>>({});
    const [invoiceMap, setInvoiceMap]   = useState<Record<string, InvoiceState>>({});
    const fileInputRefs                 = useRef<Record<string, HTMLInputElement | null>>({});
    const salesPerPage = 10;
    const { theme } = UseTheme();

    // Sincronizar checked e invoiceSent desde los tickets
    useEffect(() => {
        const cMap: Record<string, boolean>      = {};
        const iMap: Record<string, InvoiceState> = {};
        allTickets.forEach(t => {
            cMap[t._id] = t.checked      ?? false;
            iMap[t._id] = { file: null, sent: t.invoiceSent ?? false, sending: false };
        });
        setCheckedMap(cMap);
        setInvoiceMap(iMap);
    }, [allTickets]);

    // ── filtros ──────────────────────────────────────────────────
    const filteredTickets = useMemo(() => {
        if (!Array.isArray(allTickets)) return [];
        const now = new Date();
        return allTickets.filter(ticket => {
            const matchesEmail = ticket.email?.toLowerCase().includes(searchEmail.toLowerCase());
            if (!matchesEmail) return false;
            const ticketDate = new Date(ticket.createdAt);
            if (timeRange === 'day')   return ticketDate.toDateString() === now.toDateString();
            if (timeRange === 'month') return ticketDate.getMonth() === now.getMonth() && ticketDate.getFullYear() === now.getFullYear();
            if (timeRange === 'year')  return ticketDate.getFullYear() === now.getFullYear();
            return true;
        });
    }, [allTickets, timeRange, searchEmail]);

    const totalPages   = Math.ceil(filteredTickets.length / salesPerPage);
    const currentSales = filteredTickets.slice((currentPage - 1) * salesPerPage, currentPage * salesPerPage);

    useEffect(() => { setCurrentPage(1); }, [timeRange, searchEmail]);

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
                    <span className="sh-count">RECORDS: {filteredTickets.length}</span>
                </div>
                <div className="sh-controls">
                    <input
                        type="text"
                        placeholder="SEARCH_BY_EMAIL..."
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

            {/* ── CARD ── */}
            <div className="sh-card-header">SALES_DATABASE_LOGS</div>
            <div className="sh-card-wrapper">
                <div className="sh-list">
                    {currentSales.length > 0 ? currentSales.map((sale) => {
                        const isChecked  = checkedMap[sale._id] ?? false;
                        const isExpanded = expandedId === sale._id;
                        const inv        = invoiceMap[sale._id] ?? { file: null, sent: false, sending: false };

                        return (
                            <div key={sale._id} className={`sh-row-wrapper ${isChecked ? 'sh-row-checked' : ''}`}>

                                {/* ── FILA PRINCIPAL ── */}
                                <div className="sh-row">
                                    <div className="sh-main-info">
                                        <span className="sh-date">
                                            [{new Date(sale.createdAt).toLocaleDateString('es-AR')}]
                                        </span>
                                        <span className="sh-user">{sale.email}</span>
                                    </div>
                                    <div className="sh-details">
                                        <span className={`sh-status ${sale.status?.toLowerCase()}`}>
                                            {sale.status?.toUpperCase()}
                                        </span>
                                        <span className="sh-plan">{sale.plan}</span>
                                        <span className="sh-amount">${sale.amount?.toLocaleString()}</span>
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
                                        <div className="sh-detail-grid">

                                            {/* datos del cliente */}
                                            <div className="sh-detail-col">
                                                <span className="sh-detail-title">// DATOS_CLIENTE</span>
                                                <div className="sh-detail-row"><span>Email</span><strong>{sale.email}</strong></div>
                                                <div className="sh-detail-row"><span>Teléfono</span><strong>{sale.phone || '—'}</strong></div>
                                                <div className="sh-detail-row"><span>Fecha</span><strong>{new Date(sale.createdAt).toLocaleString('es-AR')}</strong></div>
                                                <div className="sh-detail-row"><span>Order ID</span><strong>{sale.orderId || '—'}</strong></div>
                                                <div className="sh-detail-row"><span>MP ID</span><strong>{sale.mp_payment_id || '—'}</strong></div>
                                                <div className="sh-detail-row">
                                                    <span>Estado</span>
                                                    <strong className={`sh-status ${sale.status?.toLowerCase()}`}>
                                                        {sale.status?.toUpperCase()}
                                                    </strong>
                                                </div>
                                            </div>

                                            {/* resumen financiero */}
                                            <div className="sh-detail-col">
                                                <span className="sh-detail-title">// RESUMEN_PAGO</span>
                                                {sale.calculo ? (
                                                    <>
                                                        <div className="sh-detail-row"><span>Cuotas</span><strong>{sale.calculo.cuotas}x</strong></div>
                                                        <div className="sh-detail-row"><span>Subtotal base</span><strong>${sale.calculo.subtotalBase?.toLocaleString()}</strong></div>
                                                        {sale.calculo.descuentoCupon > 0 && (
                                                            <div className="sh-detail-row sh-detail-green">
                                                                <span>Descuento cupón</span>
                                                                <strong>- ${sale.calculo.descuentoCupon?.toLocaleString()}</strong>
                                                            </div>
                                                        )}
                                                        {sale.calculo.costoFinanciacion > 0 && (
                                                            <div className="sh-detail-row sh-detail-red">
                                                                <span>Costo financiación</span>
                                                                <strong>+ ${sale.calculo.costoFinanciacion?.toLocaleString()}</strong>
                                                            </div>
                                                        )}
                                                        {sale.calculo.cupon && (
                                                            <div className="sh-detail-row">
                                                                <span>Cupón</span>
                                                                <strong>{sale.calculo.cupon.code} — {sale.calculo.cupon.discount}% ({sale.calculo.cupon.scope})</strong>
                                                            </div>
                                                        )}
                                                        <div className="sh-detail-row sh-detail-total">
                                                            <span>TOTAL FINAL</span>
                                                            <strong>${sale.calculo.totalFinal?.toLocaleString()}</strong>
                                                        </div>
                                                    </>
                                                ) : (
                                                    <div className="sh-detail-row">
                                                        <span>Total cobrado</span>
                                                        <strong>${sale.amount?.toLocaleString()}</strong>
                                                    </div>
                                                )}
                                            </div>
                                        </div>

                                        {/* tabla de productos */}
                                        {sale.items && sale.items.length > 0 && (
                                            <div className="sh-detail-items">
                                                <span className="sh-detail-title">// PRODUCTOS_DEL_PEDIDO</span>
                                                <div className="sh-items-table">
                                                    <div className="sh-items-head">
                                                        <span>Producto / Variante</span>
                                                        <span>SKU</span>
                                                        <span>Cant.</span>
                                                        <span>P. Unit.</span>
                                                        <span>Interés</span>
                                                        <span>Total</span>
                                                    </div>
                                                    {sale.items.map((item, i) => (
                                                        <div key={i} className="sh-items-row">
                                                            <span>
                                                                <strong style={{ display: 'block' }}>{item.nombre}</strong>
                                                                {item.varianteLabel && (
                                                                    <em className="sh-variante-label">{item.varianteLabel}</em>
                                                                )}
                                                            </span>
                                                            <span className="sh-sku">{item.skuPadre || '—'}</span>
                                                            <span>{item.cantidad}</span>
                                                            <span>${item.precioUnitario?.toLocaleString()}</span>
                                                            <span>{item.aplicaInteres ? item.tasa : 'S/I'}</span>
                                                            <span>${item.totalItem?.toLocaleString()}</span>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        )}

                                        {/* sección factura */}
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