import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import { SessionProvider } from "../contexts/SessionContext";
import FooterMinimal from "../footer/minimalFooter/FooterMinimal";
import CookiesCube from "../cookiesCube/CookiesCube";
import NavBarMinimal from "../navbar/navbarMinimal/NavBarMinimal";
import Home from "../home/Home";
import CompanyInfo from "../companyInfo/CompanyInfoMinimal";
import SorteoDevMinimal from "../sorteo/SorteoDevMinimal";
import Courses from "../courses/Courses";
import CursosParams from "../courses/CursosParams";

const AppRouter = () => {
    return (
        <Router>
            <SessionProvider>
                {/* <CartProvider>
                    <ReseñasProvider>
                        <FavoritesProvider> */}
                            <CookiesCube />
                            <NavBarMinimal />
                            <Routes>
                                <Route path="/" element={<Home />} />
                                <Route path="/company" element={<CompanyInfo />} />
                                <Route path="/raffles" element={<SorteoDevMinimal />} />
                                <Route path="/courses" element={<CursosParams />} />
                                {/* <Route path="/products" element={<ProductsMinimal />} />
                                <Route path="/sales" element={<Sales />} />
                                <Route path="/contact" element={<ContactMinimal />} />
                                <Route path="/policy" element={<PoliticaCookiesCube />} />
                                <Route path="/raffle-terms" element={<RaffleTermsCube />} />
                                <Route path="/*" element={<Error404Minimal />} />
                                <Route path="/loader" element={<SpinnerMinimal />} />
                                <Route path="/product/:id" element={<ParamsProduct />} />
                                <Route path="/testproducts" element={<IndividualProduct />} />
                                <Route path="/cart-products-view" element={<CartView />} /> 
                                <Route path="/checkout" element={<CheckoutPage />} />
                                <Route path="/dashboard" element={<PrivateRoute adminOnly={false}><Dashboard /></PrivateRoute>} />
                                Tiene Acceso solo el admin con la prop pasada
                                <Route path="/admin" element={<PrivateRoute adminOnly={true}><AdminDashboard /></PrivateRoute>} /> */}
                            </Routes>
                            <FooterMinimal />
                        {/* </FavoritesProvider>
                    </ReseñasProvider>
                </CartProvider> */}
            </SessionProvider>
        </Router>
    );  
}

export default AppRouter;   

