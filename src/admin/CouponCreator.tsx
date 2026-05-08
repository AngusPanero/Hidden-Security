import { useState, useEffect } from 'react';
import axios from 'axios';
import { Ticket, Calendar, Hash, User, AlertCircle, CheckCircle2, Trash2, Clock } from 'lucide-react';
import './couponCreator.css';
import { UseTheme } from '../contexts/ThemeContext';

const ALL_PLANS = [
    { id: 'starter',  label: 'STARTER'  },
    { id: 'pro',      label: 'PRO'      },
    { id: 'elite',    label: 'ELITE'    },
    { id: 'voucher',  label: 'VOUCHER'  },
    { id: 'b2b_seis', label: 'B2B_SEIS' },
    { id: 'b2b_doce', label: 'B2B_DOCE' },
];

const CouponCreator = () => {
    const { theme } = UseTheme();

    const [formData, setFormData] = useState({
        code: '', discount: '', type: 'single_use',
        expiryDate: '', maxUses: '',
        scope: 'all',
        allowedPlans: [] as string[],
    });

    const [status,  setStatus]  = useState({ loading: false, message: '', type: '' });
    const [coupons, setCoupons] = useState<any[]>([]);

    const fetchCoupons = async () => {
        try {
            const res = await axios.get(`${import.meta.env.VITE_API_URL}/api/coupons/all`, { withCredentials: true });
            setCoupons(res.data);
        } catch (err) { console.error("Error cargando cupones", err); }
    };

    useEffect(() => { fetchCoupons(); }, []);

    const togglePlan = (id: string) => {
        setFormData(f => ({
            ...f,
            allowedPlans: f.allowedPlans.includes(id)
                ? f.allowedPlans.filter(p => p !== id)
                : [...f.allowedPlans, id]
        }));
    };

    const handleDelete = async (id: string) => {
        if (!window.confirm("¿Eliminar este cupón?")) return;
        try {
            await axios.delete(`${import.meta.env.VITE_API_URL}/api/coupons/${id}`, { withCredentials: true });
            fetchCoupons();
        } catch (err) { console.error("No se pudo eliminar", err); }
    };

    const handleChange = (e: any) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    const handleSubmit = async (e: any) => {
        e.preventDefault();
        setStatus({ loading: true, message: '', type: '' });

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

        try {
            const response = await axios.post(
                `${import.meta.env.VITE_API_URL}/api/coupons/create`,
                { couponData: formattedData },
                { withCredentials: true }
            );
            setStatus({ loading: false, message: response.data.message || 'CUPÓN GENERADO CORRECTAMENTE', type: 'success' });
            setFormData({ code: '', discount: '', type: 'single_use', expiryDate: '', maxUses: '', scope: 'all', allowedPlans: [] });
            fetchCoupons();
        } catch (err: any) {
            const msg = err.response?.data?.message || "Error al crear cupón";
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
                                disabled={status.loading}
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
                        {Array.isArray(coupons) && coupons.map((coupon) => (
                            <div key={coupon._id} className="coupon-tag">
                                <div className="tag-info">
                                    <span className="tag-code">{coupon.code}</span>
                                    <span className="tag-discount">{coupon.discount}%</span>

                                    {/* tipo */}
                                    <div className="tag-policy">
                                        {coupon.type === 'single_use' ? (
                                            <><User size={12} /> SINGLE</>
                                        ) : coupon.type === 'limited_uses' ? (
                                            <><Hash size={12} /> {coupon.usesCount}/{coupon.maxUses} USES</>
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
                                    <div className={`tag-policy ${coupon.isActive ? 'tag-active' : 'tag-expired'}`}
                                        style={{ color: coupon.isActive ? '#0071e3' : 'red' }}>
                                        {coupon.isActive ? '● ACTIVO' : '● CADUCADO'}
                                    </div>
                                </div>

                                <button onClick={() => handleDelete(coupon._id)} className="tag-delete-btn">
                                    <Trash2 size={14} />
                                </button>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default CouponCreator;