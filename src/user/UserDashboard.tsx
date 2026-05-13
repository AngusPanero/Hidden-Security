import { useEffect, useState } from "react";
import "./userDashboard.css";
import { UseSession } from "../contexts/SessionContext";
import { UseTheme } from "../contexts/ThemeContext";
import { UseShopping } from "../contexts/ShoppingContext";

const UserDashboard = () => {
    const { user, loading: sessionLoading } = UseSession();
    const { purchased, getPurchased, loading: loadingPurchases } = UseShopping();
    const { theme } = UseTheme();

    const [expandedId, setExpandedId] = useState<string | null>(null);
    const [activeTab, setActiveTab]   = useState<"compras" | "cuenta">("compras");

    useEffect(() => {
        if (user && user.email) {
            getPurchased(user.email);
        }
    }, [user?.email, user]);

    const purchases    = Array.isArray(purchased) ? purchased : [];
    const totalGastado = purchases.filter(p => p.status === "approved").reduce((acc, p) => acc + (p.calculo?.totalFinal ?? p.amount), 0);
    const totalOrdenes = purchases.filter(p => p.status === "approved").length;
    const ultimaCompra = purchases.length > 0 ? new Date(purchases[0].createdAt).toLocaleDateString("es-AR") : "—";

    if (sessionLoading) {
        return (
            <div className={`dm-container ${theme}`}>
                <div className="dm-loading">
                    <span className="dm-loading-dot" />
                    <span className="dm-loading-dot" />
                    <span className="dm-loading-dot" />
                </div>
            </div>
        );
    }

    if (!user) {
        return (
            <div className={`dm-container ${theme}`}>
                <div className="dm-empty-state">
                    <span className="dm-empty-icon">⊘</span>
                    <p>NO_SESSION_ACTIVE</p>
                </div>
            </div>
        );
    }

    return (
        <div className={`dm-container ${theme}`}>

            {/* ── HERO PERFIL ── */}
            <div className="dm-hero">
                <div className="dm-hero-left">
                    <div className="dm-avatar">
                        {user.nombre?.charAt(0).toUpperCase() ?? user.email.charAt(0).toUpperCase()}
                    </div>
                    <div className="dm-hero-info">
                        <h1 className="dm-hero-name">{user.nombre || user.email.split("@")[0]}</h1>
                        <p className="dm-hero-email">{user.email}</p>
                    </div>
                </div>
                <div className="dm-hero-badge">ESTUDIANTE</div>
            </div>

            {/* ── STATS ── */}
            <div className="dm-stats">
                <div className="dm-stat">
                    <span className="dm-stat-label">ÓRDENES</span>
                    <span className="dm-stat-value">{totalOrdenes}</span>
                </div>
                <div className="dm-stat dm-stat-accent">
                    <span className="dm-stat-label">TOTAL GASTADO</span>
                    <span className="dm-stat-value">${totalGastado.toLocaleString("es-AR")}</span>
                </div>
                <div className="dm-stat">
                    <span className="dm-stat-label">ÚLTIMA COMPRA</span>
                    <span className="dm-stat-value dm-stat-small">{ultimaCompra}</span>
                </div>
            </div>

            {/* ── TABS ── */}
            <div className="dm-tabs">
                <button
                    className={`dm-tab ${activeTab === "compras" ? "active" : ""}`}
                    onClick={() => setActiveTab("compras")}
                >
                    HISTORIAL
                </button>
                <button
                    className={`dm-tab ${activeTab === "cuenta" ? "active" : ""}`}
                    onClick={() => setActiveTab("cuenta")}
                >
                    MI CUENTA
                </button>
            </div>

            {/* ══ TAB: HISTORIAL ══ */}
            {activeTab === "compras" && (
                <div className="dm-section">
                    {loadingPurchases ? (
                        <div className="dm-loading">
                            <span className="dm-loading-dot" />
                            <span className="dm-loading-dot" />
                            <span className="dm-loading-dot" />
                        </div>
                    ) : purchases.length === 0 ? (
                        <div className="dm-empty-state">
                            <span className="dm-empty-icon">◫</span>
                            <p>SIN_COMPRAS_REGISTRADAS</p>
                        </div>
                    ) : (
                        <div className="dm-purchase-list">
                            {purchases.map((p) => {
                                const isExpanded = expandedId === p._id;
                                return (
                                    <div key={p._id} className="dm-purchase-wrapper">

                                        {/* fila principal */}
                                        <div className="dm-purchase-row" onClick={() => setExpandedId(isExpanded ? null : p._id)}>
                                            <div className="dm-purchase-left">
                                                <span className="dm-purchase-date">
                                                    [{new Date(p.createdAt).toLocaleDateString("es-AR")}]
                                                </span>
                                                <span className="dm-purchase-id">
                                                    {p.orderId || p._id.slice(-8).toUpperCase()}
                                                </span>
                                            </div>
                                            <div className="dm-purchase-right">
                                                <span className={`dm-status ${p.status?.toLowerCase()}`}>
                                                    {p.status?.toUpperCase()}
                                                </span>
                                                {p.invoiceSent && (
                                                    <span className="dm-invoice-badge" title="Factura enviada">
                                                        ✓ FACTURA RECIBIDA POR EMAIL
                                                    </span>
                                                )}
                                                <span className="dm-purchase-amount">
                                                    ${(p.calculo?.totalFinal ?? p.amount)?.toLocaleString("es-AR")}
                                                </span>
                                                <span className="dm-chevron">{isExpanded ? "▲" : "▼"}</span>
                                            </div>
                                        </div>

                                        {/* panel expandido */}
                                        {isExpanded && (
                                            <div className="dm-purchase-detail">

                                                {/* resumen de pago */}
                                                <div className="dm-detail-block">
                                                    <span className="dm-detail-title">RESUMEN DE PAGO</span>
                                                    {p.calculo ? (
                                                        <>
                                                            <div className="dm-detail-row"><span>Cuotas</span><strong>{p.calculo.cuotas}x</strong></div>
                                                            <div className="dm-detail-row"><span>Subtotal</span><strong>${p.calculo.subtotalBase?.toLocaleString("es-AR")}</strong></div>
                                                            {p.calculo.descuentoCupon > 0 && (
                                                                <div className="dm-detail-row dm-green"><span>Descuento</span><strong>- ${p.calculo.descuentoCupon?.toLocaleString("es-AR")}</strong></div>
                                                            )}
                                                            {p.calculo.costoFinanciacion > 0 && (
                                                                <div className="dm-detail-row dm-red"><span>Financiación</span><strong>+ ${p.calculo.costoFinanciacion?.toLocaleString("es-AR")}</strong></div>
                                                            )}
                                                            {p.calculo.cupon && (
                                                                <div className="dm-detail-row"><span>Cupón</span><strong>{p.calculo.cupon.code} — {p.calculo.cupon.discount}%</strong></div>
                                                            )}
                                                            <div className="dm-detail-row dm-total"><span>TOTAL</span><strong>${p.calculo.totalFinal?.toLocaleString("es-AR")}</strong></div>
                                                        </>
                                                    ) : (
                                                        <div className="dm-detail-row dm-total"><span>TOTAL</span><strong>${p.amount?.toLocaleString("es-AR")}</strong></div>
                                                    )}
                                                </div>

                                                {/* productos */}
                                                {p.items && p.items.length > 0 && (
                                                    <div className="dm-detail-block">
                                                        <span className="dm-detail-title">PRODUCTOS</span>
                                                        {p.items.map((item, i) => (
                                                            <div key={i} className="dm-item-row">
                                                                <div className="dm-item-info">
                                                                    <strong>{item.nombre}</strong>
                                                                    {item.varianteLabel && <em className="dm-variante">{item.varianteLabel}</em>}
                                                                </div>
                                                                <div className="dm-item-right">
                                                                    <span className="dm-item-price">${item.totalItem?.toLocaleString("es-AR")}</span>
                                                                </div>
                                                            </div>
                                                        ))}
                                                    </div>
                                                )}

                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>
            )}

            {/* ══ TAB: MI CUENTA ══ */}
            {activeTab === "cuenta" && (
                <div className="dm-section">
                    <div className="dm-account-grid">

                        <div className="dm-account-card">
                            <span className="dm-account-card-label">EMAIL</span>
                            <span className="dm-account-card-value dm-account-card-value--small">{user.email}</span>
                        </div>

                        <div className="dm-account-card">
                            <span className="dm-account-card-label">ROL</span>
                            <span className="dm-account-card-value">{user.rol?.toUpperCase() || "ESTUDIANTE"}</span>
                        </div>

                    </div>

                    {/* aviso factura pendiente */}
                    {purchases.some(p => p.status === "approved" && !p.invoiceSent) && (
                        <div className="dm-notice">
                            <span className="dm-notice-dot" />
                            Tenés órdenes aprobadas con factura pendiente de envío.
                        </div>
                    )}
                </div>
            )}

        </div>
    );
};

export default UserDashboard;