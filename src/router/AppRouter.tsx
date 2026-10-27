import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import { SessionProvider } from "../contexts/SessionContext";
import FooterMinimal from "../footer/minimalFooter/FooterMinimal";
import NavBarMinimal from "../navbar/navbarMinimal/NavBarMinimal";
import Home from "../home/Home";
import CompanyInfo from "../companyInfo/CompanyInfoMinimal";
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
import ProcessOk from "../processMessages/ProcessOk";
import Certifications from "../certifications/Certifications";
import CertificationsRelative from "../certifications/CertificationsRelative";
import PartnerDashboard from "../partner/PartnerDashboard";
import TerminosCondiciones from "../terminosCondiciones/TerminosCondiciones";
import PoliticasPrivacidad from "../privacidad/PoliticasPrivacidad";
import CertificateView from "../certifications/Certificateview";
import PresenceHeartbeat from "../admin/PresenceHeartbeat";
import MaintenanceGate from "../maintenance/MaintenanceGate";
/* import ExternalCoursePlayer from "../externalCourses/_core/ExternalCoursePlayer" */

const AppRouter = () => {
    return (
        <Router>
            <MaintenanceGate>
            <SessionProvider>
            <PresenceHeartbeat />
                <CartProvider>
                            <CookieBanner />
                            <NavBarMinimal />
                            <Routes>
                                <Route path="/" element={<Home />} />
                                <Route path="/company" element={<CompanyInfo />} />
                                <Route path="/courses-info" element={<CursosParams />} />
                                <Route path="/courses-info/:courseSlug" element={<Courses />} />
                                <Route path="/contact" element={<Contact />} />
                                <Route path="/pricing" element={<Pricing />} />
                                <Route path="/checkout/:planId" element={<Checkout />} />
                                <Route path="/loader" element={<Loader />} />
                                <Route path="/error" element={<Error processMessage="" />} />
                                <Route path="/ok" element={<ProcessOk processMessage="Compra Exitosa!" />} />
                                <Route path="/policy-cookie" element={<PoliticaCookies />} />
                                <Route path="/policy-privacity" element={<PoliticasPrivacidad />} />
                                <Route path="/terms-and-conditions" element={<TerminosCondiciones />} />
                                <Route path="/dashboard" element={<PrivateRoute role="user"><UserDashboard /></PrivateRoute>} />
                                <Route path="/admin" element={<PrivateRoute role="admin"><AdminDashboard /></PrivateRoute>} />
                                <Route path="/partner" element={<PrivateRoute role="partner"><PartnerDashboard /></PrivateRoute>} />
                                <Route path="/enterprise" element={<PrivateRoute role="enterprise"><EnterpriseDashboard /></PrivateRoute>} /> 
                                {/* <Route path="/cursos/:partnerSlug/:courseSlug" element={<PrivateRoute role="user"><ExternalCoursePlayer /></PrivateRoute>} /> */}
                                <Route path="/certifications"           element={<Certifications />} />
                                <Route path="/certifications/:certSlug" element={<CertificationsRelative />} />
                                <Route path="/certifications/:slug/:credentialId" element={<CertificateView />} />
                                <Route path="/*" element={<Error404Minimal />} />
                            </Routes>
                            <FooterMinimal />
                </CartProvider> 
            </SessionProvider>
            </MaintenanceGate>
        </Router>
    );  
}

export default AppRouter;