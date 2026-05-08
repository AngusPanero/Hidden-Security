import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import { SessionProvider } from "../contexts/SessionContext";
import FooterMinimal from "../footer/minimalFooter/FooterMinimal";
import NavBarMinimal from "../navbar/navbarMinimal/NavBarMinimal";
import Home from "../home/Home";
import CompanyInfo from "../companyInfo/CompanyInfoMinimal";
import SorteoDevMinimal from "../sorteo/SorteoDevMinimal";
import CursosParams from "../courses/CursosParams";
import Courses from "../courses/relativeRoutes/Courses";
import Contact from "../contact/Contact";
import Pricing from "../pricing/Pricing";
import PrivateRoute from "./PrivateRoute";
import UserDashboard from "../user/UserDashboard";
import AdminDashboard from "../admin/AdminDashboard";
import EnterpriseDashboard from "../enterprise/EnterpriseDashboard";
import Checkout from "../checkout/Checkout";
import { CartProvider } from "../contexts/CartContext";
import Loader from "../loader/Loader";
import Error from "../processMessages/Error";
import CookieBanner from "../cookies/CookiesCorporate";
import PoliticaCookies from "../cookies/PoliticaCookies";
import Error404Minimal from "../processMessages/Error404Minimal";
import ProcessOk from "../processMessages/Error";

const AppRouter = () => {
    return (
        <Router>
            <SessionProvider>
                <CartProvider>
                            <CookieBanner />
                            <NavBarMinimal />
                            <Routes>
                                <Route path="/" element={<Home />} />
                                <Route path="/company" element={<CompanyInfo />} />
                                <Route path="/raffles" element={<SorteoDevMinimal />} />
                                <Route path="/courses-info" element={<CursosParams />} />
                                <Route path="/courses-info/:courseSlug" element={<Courses />} />
                                <Route path="/contact" element={<Contact />} />
                                <Route path="/pricing" element={<Pricing />} />
                                <Route path="/checkout/:planId" element={<Checkout />} />
                                <Route path="/loader" element={<Loader />} />
                                <Route path="/error" element={<Error processMessage="" />} />
                                <Route path="/ok" element={<ProcessOk processMessage="Compra Exitosa!" />} />
                                <Route path="/policy-cookie" element={<PoliticaCookies />} />
                                <Route path="/*" element={<Error404Minimal />} />
                                <Route path="/dashboard" element={<PrivateRoute adminOnly={false}><UserDashboard /></PrivateRoute>} />
                                Tiene Acceso solo el admin con la prop pasada
                                <Route path="/admin" element={<PrivateRoute adminOnly={true}><AdminDashboard /></PrivateRoute>} />
                                <Route path="/enterprise" element={<PrivateRoute enterpriseOnly={true}><EnterpriseDashboard /></PrivateRoute>} /> 
                            </Routes>
                            <FooterMinimal />
                </CartProvider> 
            </SessionProvider>
        </Router>
    );  
}

export default AppRouter;   

