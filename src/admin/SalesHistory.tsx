import React, { useState, useMemo, useEffect } from 'react';
import "./saalesHistory.css"
import { UseTheme } from '../contexts/ThemeContext';

interface Sale {
    _id: string;
    createdAt: string;
    email: string;
    status: string;
    plan: string;
    amount: number;
}

interface SalesHistoryProps {
    allTickets: Sale[];
}

const SalesHistory: React.FC<SalesHistoryProps> = ({ allTickets }) => {
    const [timeRange, setTimeRange] = useState('all');
    const [searchEmail, setSearchEmail] = useState(""); // Estado para el buscador
    const [currentPage, setCurrentPage] = useState(1);
    const salesPerPage = 10;
    const { theme } = UseTheme()

    // 1. Lógica Combinada: Filtro de Tiempo + Buscador por Email
    const filteredTickets = useMemo(() => {
        if (!Array.isArray(allTickets)) return [];
        const now = new Date();
        
        return allTickets.filter(ticket => {
            // Filtro  Email
            const matchesEmail = ticket.email?.toLowerCase().includes(searchEmail.toLowerCase());
            if (!matchesEmail) return false;

            // Filtro Tiempo
            const ticketDate = new Date(ticket.createdAt);
            if (timeRange === 'day') return ticketDate.toDateString() === now.toDateString();
            if (timeRange === 'month') return ticketDate.getMonth() === now.getMonth() && ticketDate.getFullYear() === now.getFullYear();
            if (timeRange === 'year') return ticketDate.getFullYear() === now.getFullYear();
            
            return true;
        });
    }, [allTickets, timeRange, searchEmail]);

    // 2. Lógica de Paginación
    const totalPages = Math.ceil(filteredTickets.length / salesPerPage);
    const currentSales = filteredTickets.slice((currentPage - 1) * salesPerPage, currentPage * salesPerPage);

    // Reset de página al buscar o filtrar
    useEffect(() => { setCurrentPage(1); }, [timeRange, searchEmail]);

    return (
        <div className={`sh-container sh-container ${theme}`}>
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

            <div className="sh-card-header">SALES_DATABASE_LOGS</div>

            <div className="sh-list">
                {currentSales.length > 0 ? (
                    currentSales.map((sale) => (
                        <div key={sale._id} className="sh-row">
                            <div className="sh-main-info">
                                <span className="sh-date">[{new Date(sale.createdAt).toLocaleDateString()}]</span>
                                <span className="sh-user">{sale.email}</span>
                            </div>
                            <div className="sh-details">
                                <span className={`sh-status ${sale.status?.toLowerCase()}`}>{sale.status?.toUpperCase()}</span>
                                <span className="sh-plan">{sale.plan}</span>
                                <span className="sh-amount">${sale.amount?.toLocaleString()}</span>
                            </div>
                        </div>
                    ))
                ) : (
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
    );
};

export default SalesHistory;