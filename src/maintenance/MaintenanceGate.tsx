import { useEffect, useState, type ReactNode } from "react";
import MaintenanceScreen from "./MaintenanceScreen";

// ─────────────────────────────────────────────────────────────────────
// Antes de renderizar la app consulta GET /api/status.
// - maintenance: true  → solo la pantalla de mantenimiento
// - back caído         → también mantenimiento (la app no puede funcionar)
// - maintenance: false → la app normal
// Mientras está en mantenimiento vuelve a consultar cada 60 s y,
// cuando termina, recarga la página.
// ─────────────────────────────────────────────────────────────────────

const API_URL = import.meta.env.VITE_API_URL;
const POLL_MS = 60_000;

type Status = "checking" | "maintenance" | "ok";

async function fetchMaintenance(): Promise<boolean> {
    try {
        const res = await fetch(`${API_URL}/api/status`, { cache: "no-store" });
        if (!res.ok) return true;
        const data = (await res.json()) as { maintenance?: boolean };
        return data.maintenance === true;
    } catch {
        return true; // back sin respuesta
    }
}

const MaintenanceGate = ({ children }: { children: ReactNode }) => {
    const [status, setStatus] = useState<Status>("checking");

    useEffect(() => {
        let alive = true;
        fetchMaintenance().then((m) => alive && setStatus(m ? "maintenance" : "ok"));
        return () => {
            alive = false;
        };
    }, []);

    useEffect(() => {
        if (status !== "maintenance") return;
        const id = window.setInterval(async () => {
            if (!(await fetchMaintenance())) window.location.reload();
        }, POLL_MS);
        return () => window.clearInterval(id);
    }, [status]);

    if (status === "checking") return <div style={{ position: "fixed", inset: 0, background: "#000" }} />;
    if (status === "maintenance") return <MaintenanceScreen />;
    return <>{children}</>;
};

export default MaintenanceGate;