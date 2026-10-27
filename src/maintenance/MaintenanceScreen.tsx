import { useEffect } from "react";
import "./maintenanceScreen.css";

// Pantalla única de mantenimiento. No usa contextos ni navbar/footer:
// se muestra sola y únicamente esto.

const MaintenanceScreen = () => {
    useEffect(() => {
        const prev = document.title;
        document.title = "Hidden Security · En mantenimiento";
        return () => {
            document.title = prev;
        };
    }, []);

    return (
        <main className="mt-wrap" role="main">
            <div className="mt-grid" aria-hidden="true" />

            <section className="mt-card">
                <span className="mt-brand">HIDDEN SECURITY</span>

                <div className="mt-status">
                    <span className="mt-dot" />
                    SISTEMA EN MANTENIMIENTO
                </div>

                <h1 className="mt-title">
                    VOLVEMOS
                    <br />
                    <span>EN BREVE</span>
                </h1>

                <p className="mt-text">
                    Estamos realizando mejoras en la plataforma. Tus datos, cursos y certificaciones están a
                    salvo. Volvé a intentar en unos minutos.
                </p>

                <div className="mt-bar" aria-hidden="true">
                    <div className="mt-bar-fill" />
                </div>

                <p className="mt-note">Esta página se actualiza sola cuando el sitio vuelva a estar disponible.</p>
            </section>
        </main>
    );
};

export default MaintenanceScreen;