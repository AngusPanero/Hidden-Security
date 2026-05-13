import React, { useState, useMemo } from 'react';
import {
    ResponsiveContainer, BarChart, Bar, XAxis, YAxis,
    CartesianGrid, Tooltip, PieChart, Pie, Cell,
} from 'recharts';
import "./chaarts.css";
import { UseTheme } from '../contexts/ThemeContext';

interface DashboardChartsProps {
    allTickets: any[];
}

const Charts: React.FC<DashboardChartsProps> = ({ allTickets }) => {
    const [timeRange, setTimeRange] = useState<'day' | 'month' | 'year' | 'custom'>('month');
    const [startDate, setStartDate] = useState('');
    const [endDate,   setEndDate]   = useState('');
    const { theme } = UseTheme();

    // ── FILTRADO ──────────────────────────────────────────────
    const filteredTickets = useMemo(() => {
        if (!Array.isArray(allTickets)) return [];
        const now = new Date();
        return allTickets.filter(ticket => {
            const ticketDate = new Date(ticket.createdAt);
            if (timeRange === 'day')   return ticketDate.toDateString() === now.toDateString();
            if (timeRange === 'month') return ticketDate.getMonth() === now.getMonth() && ticketDate.getFullYear() === now.getFullYear();
            if (timeRange === 'year')  return ticketDate.getFullYear() === now.getFullYear();
            if (timeRange === 'custom' && startDate && endDate) {
                const start = new Date(startDate);
                const end   = new Date(endDate);
                end.setHours(23, 59, 59);
                return ticketDate >= start && ticketDate <= end;
            }
            return true;
        });
    }, [allTickets, timeRange, startDate, endDate]);

    // ── BARCHART ──────────────────────────────────────────────
    const chartData = useMemo(() => {
        const dataMap: any = {};
        filteredTickets.forEach(ticket => {
            const date = new Date(ticket.createdAt);
            let label = "";
            if (timeRange === 'day')   label = `${date.getHours()}:00hs`;
            else if (timeRange === 'month' || timeRange === 'custom')
                label = date.toLocaleDateString([], { day: '2-digit', month: 'short' });
            else label = date.toLocaleDateString([], { month: 'long' });
            if (!dataMap[label]) dataMap[label] = { name: label, total: 0 };
            dataMap[label].total += (Number(ticket.amount) || 0);
        });
        return Object.values(dataMap);
    }, [filteredTickets, timeRange]);

    // ── MÉTRICAS ──────────────────────────────────────────────
    const totalGross  = filteredTickets.reduce((acc, curr) => acc + (Number(curr.amount) || 0), 0);
    const commission  = totalGross * 0.30;
    const netProfit   = totalGross - commission;
    const ticketCount = filteredTickets.length;
    const avgTicket   = ticketCount > 0 ? totalGross / ticketCount : 0;

    const pieData = [
        { name: "NETO",  value: netProfit,  color: "#22c55e" },
        { name: "FEES",  value: commission, color: "#ef4444" },
    ];

    const RANGE_LABELS: Record<string, string> = {
        day: "HOY", month: "MES", year: "AÑO", custom: "CUSTOM",
    };

    return (
        <div className={`dc-wrapper ${theme}`}>

            {/* ── FILTER HEADER ── */}
            <div className="dc-filter-header">
                <div className="dc-controls-group">
                    <span className="dc-control-label">TIME_FRAME:</span>
                    <div className="dc-btn-group">
                        {(['day', 'month', 'year', 'custom'] as const).map((range) => (
                            <button
                                key={range}
                                className={`dc-filter-btn ${timeRange === range ? 'active' : ''}`}
                                onClick={() => setTimeRange(range)}
                            >
                                {RANGE_LABELS[range]}
                            </button>
                        ))}
                    </div>
                </div>

                {timeRange === 'custom' && (
                    <div className="dc-date-inputs animate-fade">
                        <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="dc-date-field" />
                        <span className="dc-arrow">→</span>
                        <input type="date" value={endDate}   onChange={(e) => setEndDate(e.target.value)}   className="dc-date-field" />
                    </div>
                )}
            </div>

            {/* ── KPI STRIP ── */}
            <div className="dc-kpi-strip">
                <div className="dc-kpi-item">
                    <span className="dc-kpi-label">FACTURACIÓN_BRUTA</span>
                    <span className="dc-kpi-value">${totalGross.toLocaleString()}</span>
                </div>
                <div className="dc-kpi-divider" />
                <div className="dc-kpi-item">
                    <span className="dc-kpi-label">GANANCIA_NETA</span>
                    <span className="dc-kpi-value dc-kpi-green">${netProfit.toLocaleString()}</span>
                </div>
                <div className="dc-kpi-divider" />
                <div className="dc-kpi-item">
                    <span className="dc-kpi-label">COMISIÓN_MP</span>
                    <span className="dc-kpi-value dc-kpi-red">${commission.toLocaleString()}</span>
                </div>
                <div className="dc-kpi-divider" />
                <div className="dc-kpi-item">
                    <span className="dc-kpi-label">TRANSACCIONES</span>
                    <span className="dc-kpi-value">{ticketCount}</span>
                </div>
                <div className="dc-kpi-divider" />
                <div className="dc-kpi-item">
                    <span className="dc-kpi-label">TICKET_PROMEDIO</span>
                    <span className="dc-kpi-value">${Math.round(avgTicket).toLocaleString()}</span>
                </div>
            </div>

            {/* ── CHARTS GRID ── */}
            <div className="dc-charts-grid">

                {/* BARCHART */}
                <div className="dc-terminal-card dc-card-wide">
                    <div className="dc-card-header">REVENUE_STREAM_LOG</div>
                    <div className="dc-chart-wrapper" style={{ height: 260 }}>
                        {chartData.length > 0 ? (
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={chartData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                                    <CartesianGrid strokeDasharray="3 3" stroke="var(--dc-border)" vertical={false} />
                                    <XAxis dataKey="name" stroke="var(--dc-text-dim)" fontSize={10} tickLine={false} axisLine={false} />
                                    <YAxis stroke="var(--dc-text-dim)" fontSize={10} tickLine={false} axisLine={false} />
                                    <Tooltip
                                        contentStyle={{ backgroundColor: 'var(--dc-card)', border: '1px solid var(--dc-accent)', borderRadius: 0, color: 'var(--dc-text)', fontFamily: "'JetBrains Mono', monospace" }}
                                        itemStyle={{ color: 'var(--dc-accent)' }}
                                        formatter={(v: any) => [`$${Number(v).toLocaleString()}`, "TOTAL"]}
                                    />
                                    <Bar dataKey="total" fill="var(--dc-accent)" radius={[2, 2, 0, 0]} />
                                </BarChart>
                            </ResponsiveContainer>
                        ) : (
                            <div className="dc-empty-chart">
                                <svg viewBox="0 0 48 48" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round">
                                    <path d="M8 40V24M16 40V16M24 40V28M32 40V20M40 40V12"/>
                                </svg>
                                <p>ZERO_DATA_FOR_SELECTED_RANGE</p>
                            </div>
                        )}
                    </div>
                </div>

                {/* PIE CHART */}
                <div className="dc-terminal-card">
                    <div className="dc-card-header">FUNDS_DISTRIBUTION</div>
                    <div className="dc-pie-container">
                        <ResponsiveContainer width="100%" height={180}>
                            <PieChart>
                                <Pie
                                    data={pieData} innerRadius={52} outerRadius={72}
                                    paddingAngle={4} dataKey="value" stroke="none"
                                >
                                    {pieData.map((entry, index) => (
                                        <Cell key={`cell-${index}`} fill={entry.color} />
                                    ))}
                                </Pie>
                                <Tooltip
                                    contentStyle={{ backgroundColor: 'var(--dc-card)', border: '1px solid var(--dc-border)', borderRadius: 0, fontFamily: "'JetBrains Mono', monospace" }}
                                    formatter={(v: any) => [`$${Number(v).toLocaleString()}`]}
                                />
                            </PieChart>
                        </ResponsiveContainer>

                        <div className="dc-pie-legend">
                            <div className="dc-legend-item">
                                <span className="dc-legend-dot" style={{ background: "#22c55e" }} />
                                <div>
                                    <span className="dc-legend-label">NETO</span>
                                    <span className="dc-legend-value">${netProfit.toLocaleString()}</span>
                                </div>
                            </div>
                            <div className="dc-legend-item">
                                <span className="dc-legend-dot" style={{ background: "#ef4444" }} />
                                <div>
                                    <span className="dc-legend-label">FEES</span>
                                    <span className="dc-legend-value">${commission.toLocaleString()}</span>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

            </div>
        </div>
    );
};

export default Charts;