import "./adminDashboard.css"
import UserList from "./UserList";

const AdminDashboard = () => {
    return(
        <>
        <h1 className="welcome-title">Admin Dashboard</h1>
        <UserList />
        </>
    )
}

export default AdminDashboard