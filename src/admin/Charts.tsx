import React, { useState, useMemo } from 'react';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, PieChart, Pie, Cell } from 'recharts';
import "./chaarts.css"
import { UseTheme } from '../contexts/ThemeContext';

interface DashboardChartsProps {
    allTickets: any[];
}

const Charts: React.FC<DashboardChartsProps> = ({ allTickets }) => {
    // ESTADOS DE FILTRADO
    const [timeRange, setTimeRange] = useState<'day' | 'month' | 'year' | 'custom'>('month');
    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState('');
    const { theme } = UseTheme()

    // 1. LÓGICA DE FILTRADO DE TICKETS
    const filteredTickets = useMemo(() => {
        if (!Array.isArray(allTickets)) return [];
        const now = new Date();
        
        return allTickets.filter(ticket => {
            const ticketDate = new Date(ticket.createdAt);
            
            if (timeRange === 'day') {
                return ticketDate.toDateString() === now.toDateString();
            }
            if (timeRange === 'month') {
                return ticketDate.getMonth() === now.getMonth() && ticketDate.getFullYear() === now.getFullYear();
            }
            if (timeRange === 'year') {
                return ticketDate.getFullYear() === now.getFullYear();
            }
            if (timeRange === 'custom' && startDate && endDate) {
                const start = new Date(startDate);
                const end = new Date(endDate);
                end.setHours(23, 59, 59);
                return ticketDate >= start && ticketDate <= end;
            }
            return true;
        });
    }, [allTickets, timeRange, startDate, endDate]);

    // 2. PROCESAMIENTO PARA BARCHART
    const chartData = useMemo(() => {
        const dataMap: any = {};
        filteredTickets.forEach(ticket => {
            const date = new Date(ticket.createdAt);
            let label = "";
            
            if (timeRange === 'day') label = `${date.getHours()}:00hs`;
            else if (timeRange === 'month' || timeRange === 'custom') 
                label = date.toLocaleDateString([], {day: '2-digit', month: 'short'});
            else label = date.toLocaleDateString([], {month: 'long'});

            if (!dataMap[label]) dataMap[label] = { name: label, total: 0 };
            dataMap[label].total += (Number(ticket.amount) || 0);
        });
        return Object.values(dataMap);
    }, [filteredTickets, timeRange]);

    // 3. CÁLCULOS FINANCIEROS
    const totalGross = filteredTickets.reduce((acc, curr) => acc + (Number(curr.amount) || 0), 0);
    const commission = totalGross * 0.30;
    const netProfit = totalGross - commission;

    const pieData = [
        { name: "NET_PROFIT", value: netProfit, color: "#10b981" },
        { name: "FEES", value: commission, color: "#ef4444" }
    ];

    return (
        <div className={`dc-wrapper dc-wrapper ${theme}`}>
            {/* --- SELECTORES DE TIEMPO INTEGRADOS --- */}
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
                                {range.toUpperCase()}
                            </button>
                        ))}
                    </div>
                </div>

                {timeRange === 'custom' && (
                    <div className="dc-date-inputs animate-fade">
                        <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="dc-date-field" />
                        <span className="dc-arrow">→</span>
                        <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="dc-date-field" />
                    </div>
                )}
            </div>

            {/* --- GRILLA DE GRÁFICOS --- */}
            <div className="dc-charts-grid">
                <div className="dc-terminal-card highlight">
                    <div className="dc-card-header">REVENUE_METRIC</div>
                    <div className="dc-card-body">
                        <span className="dc-big-number">${totalGross.toLocaleString()}</span>
                        <h1 className="dc-label">FACTURACIÓN ({timeRange.toUpperCase()})</h1>
                        <span className="dc-unit">GROSS_FUNDS_CAPTURED</span>
                    </div>
                </div>

                <div className="dc-terminal-card dc-chart-card">
                    <div className="dc-card-header">REVENUE_STREAM_LOG</div>
                    <div className="dc-chart-wrapper" style={{ height: 250 }}>
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={chartData}>
                                <CartesianGrid strokeDasharray="3 3" stroke="var(--dc-border)" vertical={false} />
                                <XAxis dataKey="name" stroke="var(--dc-text-dim)" fontSize={10} tickLine={false} />
                                <YAxis stroke="var(--dc-text-dim)" fontSize={10} tickLine={false} />
                                <Tooltip 
                                    contentStyle={{ backgroundColor: 'var(--dc-card)', border: '1px solid var(--dc-accent)', color: 'var(--dc-text)' }}
                                    itemStyle={{ color: 'var(--dc-accent)' }}
                                />
                                <Bar dataKey="total" fill="var(--dc-accent)" radius={[4, 4, 0, 0]} />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                <div className="dc-terminal-card dc-chart-card">
                    <div className="dc-card-header">FUNDS_DISTRIBUTION</div>
                    <div className="dc-pie-container">
                        <ResponsiveContainer width="100%" height={180}>
                            <PieChart>
                                <Pie data={pieData} innerRadius={50} outerRadius={70} paddingAngle={5} dataKey="value" stroke="none">
                                    {pieData.map((entry, index) => <Cell key={`cell-${index}`} fill={entry.color} />)}
                                </Pie>
                                <Tooltip />
                            </PieChart>
                        </ResponsiveContainer>
                        <div className="dc-pie-legend">
                            <p><span className="dot net"></span> NETO: <strong>${netProfit.toLocaleString()}</strong></p>
                            <p><span className="dot comm"></span> FEES: <strong>${commission.toLocaleString()}</strong></p>
                        </div>
                    </div>
                </div>

                <div className="dc-terminal-card">
                    <div className="dc-card-header">SYSTEM_METRICS</div>
                    <div className="dc-card-body metrics">
                        <p>STABILITY: <span className="dc-green-glow">OPTIMAL</span></p>
                        <p>ENCRYPTION: <span className="dc-accent-text">ACTIVE</span></p>
                        <div className="dc-progress-bar"><div className="dc-fill" style={{width: '90%'}}></div></div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default Charts;