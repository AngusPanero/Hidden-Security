import { useEffect } from "react";
import { UseShopping } from "../contexts/ShoppingContext";
import "./adminDashboard.css"
import Charts from "./Charts";
import UserList from "./UserList";
import { UseSession } from "../contexts/SessionContext";
import SalesHistory from "./SalesHistory";
import CouponCreator from "./CouponCreator";

const AdminDashboard = () => {
    const { user } = UseSession();
    const { allTickets, getAllTickets } = UseShopping();

    useEffect(() => {
        if (user) {
            getAllTickets();
        }
    }, [user]);
    
    return(
        <>
        <h1 className="welcome-title">Admin Dashboard</h1>
        <Charts allTickets={allTickets} />
        <UserList />
        <CouponCreator />
        <SalesHistory allTickets={allTickets} />
        </>
    )
}

export default AdminDashboard