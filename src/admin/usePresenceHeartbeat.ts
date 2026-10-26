import { useEffect } from "react";

/* ══════════════════════════════════════════════════════════════
   usePresenceHeartbeat — avisa al backend que el usuario está en línea
   Montarlo UNA vez, en un componente que esté siempre visible cuando
   hay sesión (ej. App.tsx o el provider de sesión), pasándole si hay
   usuario logueado. Los admins los descarta el backend.
══════════════════════════════════════════════════════════════ */

const API = import.meta.env.VITE_API_URL ?? "";
const PING_EVERY_MS = 60 * 1000; // tiene que ser menor que ONLINE_WINDOW_MS del backend

const send = (path: string) =>
  fetch(`${API}${path}`, { method: "POST", credentials: "include", keepalive: true }).catch(() => {});

export function usePresenceHeartbeat(isLoggedIn: boolean) {
  useEffect(() => {
    if (!isLoggedIn) return;

    let timer: ReturnType<typeof setInterval> | null = null;

    const start = () => {
      if (timer) return;
      send("/api/presence/ping");
      timer = setInterval(() => send("/api/presence/ping"), PING_EVERY_MS);
    };
    const stop = () => {
      if (timer) { clearInterval(timer); timer = null; }
    };

    // Solo cuenta como en línea con la pestaña visible
    const onVisibility = () => (document.visibilityState === "visible" ? start() : stop());
    // Al cerrar la pestaña se avisa para que deje de figurar enseguida
    const onPageHide = () => { stop(); send("/api/presence/leave"); };

    if (document.visibilityState === "visible") start();
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("pagehide", onPageHide);

    return () => {
      stop();
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("pagehide", onPageHide);
      send("/api/presence/leave"); // logout o desmontaje
    };
  }, [isLoggedIn]);
}