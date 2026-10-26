import { UseSession } from "../contexts/SessionContext";
import { usePresenceHeartbeat } from "./usePresenceHeartbeat";

// Mantiene el latido de "en línea" mientras hay sesión. No renderiza nada.
export default function PresenceHeartbeat() {
  const { user } = UseSession();
  usePresenceHeartbeat(!!user);
  return null;
}