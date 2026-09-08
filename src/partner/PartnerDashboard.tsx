import { useEffect } from "react";
import { UseSession } from "../contexts/SessionContext";
import "./partnerDashboard.css";

const PartnerDashboard = () => {
    const { user } = UseSession();

    useEffect(() => {
        if (!user?.partner) return;
    }, [user]);

    return (
        <div className="partner-dashboard">
            <h1 className="partner-dashboard__title">Partner Dashboard</h1>
        </div>
    );
}

export default PartnerDashboard;