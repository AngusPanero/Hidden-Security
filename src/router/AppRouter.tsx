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

const AppRouter = () => {
    return (
        <Router>
            <SessionProvider>
                <CartProvider>
                {/*     <ReseñasProvider>
                        <FavoritesProvider> */}
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
                                <Route path="/policy-cookie" element={<PoliticaCookies />} />
                                <Route path="/*" element={<Error404Minimal />} />
                                {/* <Route path="/products" element={<ProductsMinimal />} />
                                <Route path="/sales" element={<Sales />} />
                                <Route path="/contact" element={<ContactMinimal />} />
                                
                                <Route path="/raffle-terms" element={<RaffleTermsCube />} />
                                <Route path="/*" element={<Error404Minimal />} />
                                
                                <Route path="/product/:id" element={<ParamsProduct />} />
                                <Route path="/testproducts" element={<IndividualProduct />} />
                                <Route path="/cart-products-view" element={<CartView />} /> 
                                <Route path="/checkout" element={<CheckoutPage />} />*/}
                                <Route path="/dashboard" element={<PrivateRoute adminOnly={false}><UserDashboard /></PrivateRoute>} />
                                Tiene Acceso solo el admin con la prop pasada
                                <Route path="/admin" element={<PrivateRoute adminOnly={true}><AdminDashboard /></PrivateRoute>} />
                                <Route path="/enterprise" element={<PrivateRoute enterpriseOnly={true}><EnterpriseDashboard /></PrivateRoute>} /> 
                            </Routes>
                            <FooterMinimal />
                        {/* </FavoritesProvider>
                    </ReseñasProvider>*/}
                </CartProvider> 
            </SessionProvider>
        </Router>
    );  
}

export default AppRouter;   

