import { useState, useEffect } from 'react';
import axios from 'axios';
import { Ticket, Calendar, User, AlertCircle, CheckCircle2, Trash2, Clock } from 'lucide-react'; 
import './couponCreator.css';
import { UseTheme } from '../contexts/ThemeContext';

const CouponCreator = () => {
    const { theme } = UseTheme()
    const [formData, setFormData] = useState({ code: '', discount: '', type: 'single_use', expiryDate: ''});
    const [status, setStatus] = useState({ loading: false, message: '', type: '' });
    

    const [coupons, setCoupons] = useState<any[]>([]);

    const fetchCoupons = async () => {
        try {
        const res = await axios.get(`${import.meta.env.VITE_API_URL}/api/coupons/all`, { withCredentials: true });
        setCoupons(res.data);
        } catch (err) {
        console.error("Error cargando cupones", err);
        }
    };

    useEffect(() => {
        fetchCoupons();
    }, []);

    const handleDelete = async (id: string) => {
        if(!window.confirm("¿Eliminar este cupón?")) return;
        try {
        await axios.delete(`${import.meta.env.VITE_API_URL}/api/coupons/${id}`, { withCredentials: true });
        fetchCoupons(); 
        } catch (err) {
            console.error("Error al traer cupones! 🔴", err)
        alert("No se pudo eliminar");
        }
    };


    const handleChange = (e: any) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    const handleSubmit = async (e: any) => {
        e.preventDefault();
        setStatus({ loading: true, message: '', type: '' });

        const formattedData = {
        code: formData.code.trim().toUpperCase(), 
        discount: Number(formData.discount),
        type: formData.type,
        expiryDate: formData.type === 'date_limited' ? formData.expiryDate : null
        };
        try {
        const response = await axios.post(`${import.meta.env.VITE_API_URL}/api/coupons/create`, { couponData: formattedData }, { withCredentials: true });

        setStatus({ 
            loading: false, 
            message: response.data.message || 'CUPÓN GENERADO CORRECTAMENTE', 
            type: 'success' 
        });

        setFormData({ code: '', discount: '', type: 'single_use', expiryDate: '' });
        fetchCoupons(); 

        } catch (err: any) {
        console.error('ERROR CRÍTICO EN SERVIDOR', err);
        const backendMessage = err.response?.data?.message || "Error al crear cupon";
        setStatus({ loading: false, message: backendMessage, type: 'error' });
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
                    
                    <div className="input-with-label-stack">
                    <label className="stat-label">COUPON_CODE</label>
                    <input
                        type="text"
                        name="code"
                        value={formData.code}
                        onChange={handleChange}
                        placeholder="EJ: WINTER_2026"
                        className="code-input"
                        required
                    />
                    </div>

                    <div className="input-with-label-stack">
                    <label className="stat-label">DISCOUNT_PERCENT (%)</label>
                    <input
                        type="number"
                        name="discount"
                        min="1"
                        max="100"
                        value={formData.discount}
                        onChange={handleChange}
                        placeholder="00"
                        required
                    />
                    </div>

                    <div className="input-with-label-stack full-width-mobile">
                    <label className="stat-label">USAGE_POLICY</label>
                    <div className="admin-stats-bar" style={{ marginBottom: 0, marginTop: '5px' }}>
                        <div 
                        className={`stat-card ${formData.type === 'single_use' ? 'active' : ''}`}
                        onClick={() => setFormData({ ...formData, type: 'single_use' })}
                        style={{ padding: '10px', textAlign: 'center' }}
                        >
                        <User size={18} style={{ marginBottom: '5px' }} />
                        <span className="stat-label" style={{ fontSize: '0.7rem' }}>SINGLE_USE</span>
                        </div>
                        <div 
                        className={`stat-card ${formData.type === 'date_limited' ? 'active' : ''}`}
                        onClick={() => setFormData({ ...formData, type: 'date_limited' })}
                        style={{ padding: '10px', textAlign: 'center' }}
                        >
                        <Calendar size={18} style={{ marginBottom: '5px' }} />
                        <span className="stat-label" style={{ fontSize: '0.7rem' }}>DATE_LIMITED</span>
                        </div>
                    </div>
                    </div>

                    {formData.type === 'date_limited' && (
                    <div className="input-with-label-stack full-width-mobile date-input-section">
                        <label className="stat-label">EXPIRATION_DATE</label>
                        <input
                        type="date"
                        name="expiryDate"
                        value={formData.expiryDate}
                        onChange={handleChange}
                        required
                        />
                    </div>
                    )}

                    {status.message && (
                    <div className={`status-banner full-width-mobile ${status.type}`}>
                        {status.type === 'success' ? <CheckCircle2 size={16} /> : <AlertCircle size={16} />}
                        {status.message}
                    </div>
                    )}

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

                {/* CUPONES TAGS --- */}
                <div className="active-coupons-section" style={{ marginTop: '30px' }}>
                    <label className="stat-label" style={{ marginBottom: '15px', display: 'block' }}>ACTIVE_COUPONS_LIST</label>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px' }}>
                        {Array.isArray(coupons) && coupons.map((coupon) => (
                        <div key={coupon._id} className="coupon-tag">
                            <div className="tag-info">
                                <span className="tag-code">{coupon.code}</span>
                                <span className="tag-discount">{coupon.discount}%</span>
                                <div className="tag-policy">
                                    {coupon.type === 'single_use' ? (
                                    <><User size={12} /> SINGLE</>
                                    ) : (
                                    <><Clock size={12} /> {new Date(coupon.expiryDate).toLocaleDateString()}</>
                                    )}
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