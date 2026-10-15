import { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { Ticket, Calendar, Hash, User, AlertCircle, CheckCircle2, Trash2, Clock, KeyRound, X } from 'lucide-react';
import './couponCreator.css';
import { UseTheme } from '../contexts/ThemeContext';

const ALL_PLANS = [
    { id: 'starter',    label: 'STARTER'    },
    { id: 'pro',        label: 'PRO'        },
    { id: 'elite',      label: 'ELITE'      },
    { id: 'voucher',    label: 'VOUCHER'    },
    { id: 'business',   label: 'BUSINESS'   },
    { id: 'enterprise', label: 'ENTERPRISE' },
];

type CouponStatus = { label: string; className: string };

// Acción que queda esperando la clave de firma
type PendingAction =
    | { kind: 'create'; data: Record<string, any> }
    | { kind: 'delete'; id: string; code: string };

// El estado se calcula a partir de los datos reales del cupón.
// isActive solo indica desactivación manual (o lo que haya escrito el backend).
const getCouponStatus = (coupon: any): CouponStatus => {
    const now = new Date();

    if (coupon.type === 'date_limited' && coupon.expiryDate && new Date(coupon.expiryDate) < now) {
        return { label: 'VENCIDO', className: 'tag-expired' };
    }
    if (coupon.type === 'limited_uses' && coupon.maxUses != null && (coupon.usesCount ?? 0) >= coupon.maxUses) {
        return { label: 'AGOTADO', className: 'tag-expired' };
    }
    // Si single_use es "una vez por usuario" (via usedBy) y no "una vez en total", quitá este bloque.
    if (coupon.type === 'single_use' && (coupon.usesCount ?? 0) >= 1) {
        return { label: 'USADO', className: 'tag-expired' };
    }
    if (!coupon.isActive) {
        return { label: 'DESACTIVADO', className: 'tag-disabled' };
    }
    return { label: 'ACTIVO', className: 'tag-active' };
};

const EMPTY_FORM = {
    code: '', discount: '', type: 'single_use',
    expiryDate: '', maxUses: '',
    scope: 'all',
    allowedPlans: [] as string[],
};

const CouponCreator = () => {
    const { theme } = UseTheme();

    const [formData, setFormData] = useState(EMPTY_FORM);
    const [status,  setStatus]  = useState({ loading: false, message: '', type: '' });
    const [coupons, setCoupons] = useState<any[]>([]);

    // ── Modal de firma ──
    const [pending,    setPending]    = useState<PendingAction | null>(null);
    const [pin,        setPin]        = useState('');
    const [pinError,   setPinError]   = useState('');
    const [pinLoading, setPinLoading] = useState(false);
    const [pinLocked,  setPinLocked]  = useState(false);
    const pinInputRef = useRef<HTMLInputElement>(null);

    const fetchCoupons = async () => {
        try {
            const res = await axios.get(`${import.meta.env.VITE_API_URL}/api/coupons/all`, { withCredentials: true });
            setCoupons(res.data);
        } catch (err) { console.error("Error cargando cupones", err); }
    };

    useEffect(() => { fetchCoupons(); }, []);

    // Foco en el input y Escape para cerrar
    useEffect(() => {
        if (!pending) return;
        const t = setTimeout(() => pinInputRef.current?.focus(), 50);
        const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape' && !pinLoading) closeSignModal(); };
        window.addEventListener('keydown', onKey);
        return () => { clearTimeout(t); window.removeEventListener('keydown', onKey); };
    }, [pending, pinLoading]);

    const openSignModal = (action: PendingAction) => {
        setPin('');
        setPinError('');
        setPinLocked(false);
        setPending(action);
    };

    const closeSignModal = () => {
        setPending(null);
        setPin('');
        setPinError('');
        setPinLocked(false);
        setPinLoading(false);
    };

    const togglePlan = (id: string) => {
        setFormData(f => ({
            ...f,
            allowedPlans: f.allowedPlans.includes(id)
                ? f.allowedPlans.filter(p => p !== id)
                : [...f.allowedPlans, id]
        }));
    };

    const handleDelete = (coupon: any) => {
        openSignModal({ kind: 'delete', id: coupon._id, code: coupon.code });
    };

    const handleChange = (e: any) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    // 1) El form solo valida y abre el modal de firma
    const handleSubmit = (e: any) => {
        e.preventDefault();
        setStatus({ loading: false, message: '', type: '' });

        if (formData.scope === 'plans' && formData.allowedPlans.length === 0) {
            setStatus({ loading: false, message: 'Seleccioná al menos un plan.', type: 'error' });
            return;
        }

        const formattedData = {
            code:        formData.code.trim().toUpperCase(),
            discount:    Number(formData.discount),
            type:        formData.type,
            expiryDate:  formData.type === 'date_limited' ? formData.expiryDate : null,
            maxUses:     formData.type === 'limited_uses'  ? Number(formData.maxUses) : null,
            scope:       formData.scope,
            allowedPlans: formData.scope === 'plans' ? formData.allowedPlans : [],
        };

        openSignModal({ kind: 'create', data: formattedData });
    };

    // 2) Con la clave, se manda la acción real
    const handleSign = async (e: any) => {
        e.preventDefault();
        if (!pending || pinLoading || pinLocked) return;

        if (!/^\d{4}$/.test(pin)) {
            setPinError('La clave tiene 4 dígitos.');
            return;
        }

        setPinLoading(true);
        setPinError('');

        try {
            if (pending.kind === 'create') {
                setStatus({ loading: true, message: '', type: '' });
                const response = await axios.post(
                    `${import.meta.env.VITE_API_URL}/api/coupons/create`,
                    { couponData: pending.data, pin },
                    { withCredentials: true }
                );
                setStatus({ loading: false, message: response.data.message || 'CUPÓN GENERADO CORRECTAMENTE', type: 'success' });
                setFormData(EMPTY_FORM);
            } else {
                const response = await axios.delete(
                    `${import.meta.env.VITE_API_URL}/api/coupons/${pending.id}`,
                    { data: { pin }, withCredentials: true }
                );
                setStatus({ loading: false, message: response.data.message || 'CUPÓN ELIMINADO', type: 'success' });
            }
            closeSignModal();
            fetchCoupons();

        } catch (err: any) {
            const code = err.response?.data?.code;
            const msg  = err.response?.data?.message || 'Error al procesar la acción';

            // Errores de la clave: se muestran en el modal y queda abierto
            if (code === 'CLAVE_INCORRECTA') {
                setPin('');
                setPinError(msg);
                setPinLoading(false);
                setStatus({ loading: false, message: '', type: '' });
                pinInputRef.current?.focus();
                return;
            }
            if (code === 'CLAVE_BLOQUEADA') {
                setPin('');
                setPinError(msg);
                setPinLocked(true);
                setPinLoading(false);
                setStatus({ loading: false, message: '', type: '' });
                return;
            }

            // Cualquier otro error (validación, código repetido, etc.): se cierra y va al banner
            closeSignModal();
            setStatus({ loading: false, message: msg, type: 'error' });
        }
    };

    return (
        <div className={`admin-inventory-wrapper ${theme}`}>
            <div className="coupon-admin-container">
                <div className="coupon-card">
                    <div className="coupon-card-header">
                        <h2><Ticket size={20} strokeWidth={3} /> NEW_COUPON_GENERATOR</h2>
                    </div>

                    <form onSubmit={handleSubmit} className="coupon-form-grid">

                        {/* código */}
                        <div className="input-with-label-stack">
                            <label className="stat-label">COUPON_CODE</label>
                            <input
                                type="text" name="code" value={formData.code}
                                onChange={handleChange} placeholder="EJ: WINTER_2026"
                                className="code-input" required
                            />
                        </div>

                        {/* descuento */}
                        <div className="input-with-label-stack">
                            <label className="stat-label">DISCOUNT_PERCENT (%)</label>
                            <input
                                type="number" name="discount" min="1" max="100"
                                value={formData.discount} onChange={handleChange}
                                placeholder="00" required
                            />
                        </div>

                        {/* tipo */}
                        <div className="input-with-label-stack full-width-mobile">
                            <label className="stat-label">USAGE_POLICY</label>
                            <div className="admin-stats-bar" style={{ marginBottom: 0, marginTop: '5px' }}>
                                {[
                                    { key: 'single_use',   icon: <User size={18} />,     label: 'SINGLE_USE' },
                                    { key: 'date_limited', icon: <Calendar size={18} />, label: 'DATE_LIMITED' },
                                    { key: 'limited_uses', icon: <Hash size={18} />,     label: 'LIMITED_USES' },
                                ].map(opt => (
                                    <div
                                        key={opt.key}
                                        className={`stat-card ${formData.type === opt.key ? 'active' : ''}`}
                                        onClick={() => setFormData(f => ({ ...f, type: opt.key }))}
                                        style={{ padding: '10px', textAlign: 'center' }}
                                    >
                                        {opt.icon}
                                        <span className="stat-label" style={{ fontSize: '0.7rem', marginTop: '5px', display: 'block' }}>
                                            {opt.label}
                                        </span>
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* fecha límite */}
                        {formData.type === 'date_limited' && (
                            <div className="input-with-label-stack full-width-mobile date-input-section">
                                <label className="stat-label">EXPIRATION_DATE</label>
                                <input
                                    type="date" name="expiryDate"
                                    value={formData.expiryDate} onChange={handleChange} required
                                />
                            </div>
                        )}

                        {/* max usos */}
                        {formData.type === 'limited_uses' && (
                            <div className="input-with-label-stack full-width-mobile date-input-section">
                                <label className="stat-label">MAX_USES</label>
                                <input
                                    type="number" name="maxUses" min="1"
                                    value={formData.maxUses} onChange={handleChange}
                                    placeholder="Ej: 50" required
                                />
                            </div>
                        )}

                        {/* scope */}
                        <div className="input-with-label-stack full-width-mobile">
                            <label className="stat-label">APPLIES_TO</label>
                            <div className="admin-stats-bar" style={{ marginBottom: 0, marginTop: '5px' }}>
                                <div
                                    className={`stat-card ${formData.scope === 'all' ? 'active' : ''}`}
                                    onClick={() => setFormData(f => ({ ...f, scope: 'all', allowedPlans: [] }))}
                                    style={{ padding: '10px', textAlign: 'center' }}
                                >
                                    <Ticket size={18} />
                                    <span className="stat-label" style={{ fontSize: '0.7rem', marginTop: '5px', display: 'block' }}>
                                        TODOS LOS PLANES
                                    </span>
                                </div>
                                <div
                                    className={`stat-card ${formData.scope === 'plans' ? 'active' : ''}`}
                                    onClick={() => setFormData(f => ({ ...f, scope: 'plans' }))}
                                    style={{ padding: '10px', textAlign: 'center' }}
                                >
                                    <Hash size={18} />
                                    <span className="stat-label" style={{ fontSize: '0.7rem', marginTop: '5px', display: 'block' }}>
                                        PLAN ESPECÍFICO
                                    </span>
                                </div>
                            </div>
                        </div>

                        {/* selector de planes */}
                        {formData.scope === 'plans' && (
                            <div className="input-with-label-stack full-width-mobile date-input-section">
                                <label className="stat-label">SELECCIONAR PLANES</label>
                                <div className="plan-selector-grid">
                                    {ALL_PLANS.map(plan => (
                                        <div
                                            key={plan.id}
                                            className={`plan-selector-chip ${formData.allowedPlans.includes(plan.id) ? 'selected' : ''}`}
                                            onClick={() => togglePlan(plan.id)}
                                        >
                                            {formData.allowedPlans.includes(plan.id) && <span className="selector-check">✓ </span>}
                                            {plan.label}
                                        </div>
                                    ))}
                                </div>
                                <small className="coupon-helper">
                                    {formData.allowedPlans.length === 0
                                        ? 'Seleccioná al menos un plan.'
                                        : `${formData.allowedPlans.length} plan(es) seleccionado(s): ${formData.allowedPlans.map(p => p.toUpperCase()).join(', ')}`}
                                </small>
                            </div>
                        )}

                        {/* status */}
                        {status.message && (
                            <div className={`status-banner full-width-mobile ${status.type}`}>
                                {status.type === 'success' ? <CheckCircle2 size={16} /> : <AlertCircle size={16} />}
                                {status.message}
                            </div>
                        )}

                        {/* submit */}
                        <div className="full-width-mobile">
                            <button
                                type="submit"
                                className={`btn-generate ${status.type === 'success' ? 'ready' : ''}`}
                                disabled={status.loading || !!pending}
                            >
                                {status.loading ? '> PROCESSING...' : '> GENERATE_COUPON'}
                            </button>
                        </div>
                    </form>
                </div>

                {/* lista de cupones */}
                <div className="active-coupons-section" style={{ marginTop: '30px' }}>
                    <label className="stat-label" style={{ marginBottom: '15px', display: 'block' }}>
                        ACTIVE_COUPONS_LIST
                    </label>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px' }}>
                        {Array.isArray(coupons) && coupons.map((coupon) => {
                            const couponStatus = getCouponStatus(coupon);

                            return (
                                <div key={coupon._id} className="coupon-tag">
                                    <div className="tag-info">
                                        <span className="tag-code">{coupon.code}</span>
                                        <span className="tag-discount">{coupon.discount}%</span>

                                        {/* tipo */}
                                        <div className="tag-policy">
                                            {coupon.type === 'single_use' ? (
                                                <><User size={12} /> SINGLE</>
                                            ) : coupon.type === 'limited_uses' ? (
                                                <><Hash size={12} /> {coupon.usesCount ?? 0}/{coupon.maxUses} USES</>
                                            ) : (
                                                <><Clock size={12} /> {
                                                    coupon.expiryDate
                                                        ? new Date(coupon.expiryDate).toLocaleDateString('es-AR', {
                                                            day: '2-digit', month: '2-digit', year: 'numeric',
                                                            timeZone: 'America/Argentina/Buenos_Aires'
                                                        })
                                                        : 'SIN FECHA'
                                                }</>
                                            )}
                                        </div>

                                        {/* scope */}
                                        {coupon.scope === 'plans' && coupon.allowedPlans?.length > 0 && (
                                            <div className="tag-policy" style={{ marginTop: '3px' }}>
                                                🎯 {coupon.allowedPlans.map((p: string) => p.toUpperCase()).join(', ')}
                                            </div>
                                        )}

                                        {/* estado */}
                                        <div className={`tag-policy tag-status ${couponStatus.className}`}>
                                            ● {couponStatus.label}
                                        </div>
                                    </div>

                                    <button onClick={() => handleDelete(coupon)} className="tag-delete-btn" aria-label={`Eliminar ${coupon.code}`}>
                                        <Trash2 size={14} />
                                    </button>
                                </div>
                            );
                        })}
                    </div>
                </div>
            </div>

            {/* ── MODAL DE FIRMA ─────────────────────────────────────────── */}
            {pending && (
                <div className="sign-overlay" onMouseDown={() => !pinLoading && closeSignModal()}>
                    <form
                        className="sign-modal"
                        onSubmit={handleSign}
                        onMouseDown={e => e.stopPropagation()}
                        role="dialog"
                        aria-modal="true"
                        aria-labelledby="sign-title"
                    >
                        <button
                            type="button"
                            className="sign-close"
                            onClick={closeSignModal}
                            disabled={pinLoading}
                            aria-label="Cerrar"
                        >
                            <X size={16} />
                        </button>

                        <span className="sign-eyebrow">// FIRMA_REQUERIDA</span>
                        <h3 id="sign-title" className="sign-title">
                            <KeyRound size={18} strokeWidth={2.5} />
                            {pending.kind === 'create' ? 'CONFIRMAR CUPÓN' : 'ELIMINAR CUPÓN'}
                        </h3>

                        {/* Resumen de lo que se firma */}
                        <div className={`sign-summary ${pending.kind === 'delete' ? 'danger' : ''}`}>
                            {pending.kind === 'create' ? (
                                <>
                                    <div><span>CÓDIGO</span><strong>{pending.data.code}</strong></div>
                                    <div><span>DESCUENTO</span><strong>{pending.data.discount}%</strong></div>
                                    <div>
                                        <span>POLÍTICA</span>
                                        <strong>
                                            {pending.data.type === 'single_use' && 'USO ÚNICO'}
                                            {pending.data.type === 'date_limited' && `HASTA ${pending.data.expiryDate?.split('-').reverse().join('/')}`}
                                            {pending.data.type === 'limited_uses' && `${pending.data.maxUses} USOS`}
                                        </strong>
                                    </div>
                                    <div>
                                        <span>APLICA A</span>
                                        <strong>
                                            {pending.data.scope === 'all'
                                                ? 'TODOS LOS PLANES'
                                                : pending.data.allowedPlans.map((p: string) => p.toUpperCase()).join(', ')}
                                        </strong>
                                    </div>
                                </>
                            ) : (
                                <div><span>CÓDIGO</span><strong>{pending.code}</strong></div>
                            )}
                        </div>

                        <label className="stat-label" htmlFor="sign-pin">CLAVE DE FIRMA</label>
                        <input
                            id="sign-pin"
                            ref={pinInputRef}
                            className="sign-pin-input"
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
                            <div className="sign-error">
                                <AlertCircle size={14} /> {pinError}
                            </div>
                        )}

                        <div className="sign-actions">
                            <button type="button" className="sign-btn ghost" onClick={closeSignModal} disabled={pinLoading}>
                                CANCELAR
                            </button>
                            <button
                                type="submit"
                                className={`sign-btn ${pending.kind === 'delete' ? 'danger' : 'primary'}`}
                                disabled={pinLoading || pinLocked || pin.length !== 4}
                            >
                                {pinLoading ? 'FIRMANDO...' : pending.kind === 'create' ? 'FIRMAR Y CREAR' : 'FIRMAR Y ELIMINAR'}
                            </button>
                        </div>
                    </form>
                </div>
            )}
        </div>
    );
};

export default CouponCreator;