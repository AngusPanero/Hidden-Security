import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { createPortal } from "react-dom"
import { UseSession } from "../contexts/SessionContext"
import { UseUsers } from "../contexts/UsersContext"
import "./userList.css"
import { UseTheme } from "../contexts/ThemeContext"
import ClaimsManager from "./ClaimsManager"

interface UserMetadata {
  creationTime: string
  lastSignInTime: string
}

interface User {
  uid: string
  email: string
  displayName: string
  metadata: UserMetadata
  isBanned: boolean
  isAdmin: boolean
  isEnterprise: boolean
  // Viene de la claim partner: true (ver mapeo en el backend)
  isPartner?: boolean
  // Preparado para el futuro rol de "alumno en formación" -- todavía no lo
  // envía el backend, por eso es opcional.
}

type RoleFilter = "admin" | "enterprise" | "partner" | "user";

const ROLE_ORDER: RoleFilter[] = ["admin", "enterprise", "partner", "user"];

const ROLE_LABELS: Record<RoleFilter, string> = {
  admin:      "Admin",
  enterprise: "Enterprise",
  partner:    "Partner",
  user:       "Usuario",
};

const PAGE_SIZE = 15;

// Distancia (px) que hay que arrastrar hacia abajo para cerrar el sheet
const DISMISS_DISTANCE = 110;

// Prioridad: admin > enterprise > partner > trainee > user.
// Tiene que coincidir con el orden de getUserRole en PrivateRoute.
// Se usa para el badge y para el filtro, así nunca se desincronizan.
function getUserRole(user: User): RoleFilter {
  if (user.isAdmin)      return "admin";
  if (user.isEnterprise) return "enterprise";
  if (user.isPartner)    return "partner";
  return "user";
}

const formatDate = (dateString?: string) => {
    if (!dateString) return "—";
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return "—";
    return date.toLocaleDateString("es-AR", { day: "2-digit", month: "2-digit", year: "numeric" });
}

const formatDateTime = (dateString?: string) => {
    if (!dateString) return "—";
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return "—";
    return date.toLocaleString("es-AR", {
        day: "2-digit", month: "2-digit", year: "numeric",
        hour: "2-digit", minute: "2-digit",
    });
}

// Minúsculas y sin tildes, para que "ADMIN" o "usuário" matcheen igual
const normalize = (s?: string) =>
    (s ?? "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");

// ─── Detalle del usuario: bottom sheet en mobile, modal centrado en desktop ──
interface UserSheetProps {
    user:          User
    theme:         string
    onClose:       () => void
    onManageClaims:(user: User) => void
    onBan:         (email: string) => void
    onUnban:       (uid: string) => void
}

const UserSheet = ({ user, theme, onClose, onManageClaims, onBan, onUnban }: UserSheetProps) => {
    const closeRef = useRef<HTMLButtonElement>(null);
    const startY   = useRef<number | null>(null);
    const [dragY, setDragY] = useState(0);

    // Bloquear scroll del fondo + cerrar con Escape
    useEffect(() => {
        const prevOverflow = document.body.style.overflow;
        document.body.style.overflow = "hidden";
        const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
        window.addEventListener("keydown", onKey);
        closeRef.current?.focus({ preventScroll: true });
        return () => {
            document.body.style.overflow = prevOverflow;
            window.removeEventListener("keydown", onKey);
        };
    }, [onClose]);

    // Deslizar hacia abajo para cerrar (solo desde la cabecera, así el
    // scroll del contenido no lo cierra sin querer)
    const onTouchStart = (e: React.TouchEvent) => { startY.current = e.touches[0].clientY; };
    const onTouchMove  = (e: React.TouchEvent) => {
        if (startY.current === null) return;
        setDragY(Math.max(0, e.touches[0].clientY - startY.current));
    };
    const onTouchEnd   = () => {
        if (dragY > DISMISS_DISTANCE) onClose();
        else setDragY(0);
        startY.current = null;
    };

    const role = getUserRole(user);
    const tone = user.isBanned ? "error" : "ok";

    return createPortal(
        <div className={`ul-modal-root ${theme}`} onClick={onClose}>
            <div
                className="ul-sheet"
                role="dialog"
                aria-modal="true"
                aria-labelledby="ul-sheet-title"
                onClick={(e) => e.stopPropagation()}
                style={dragY ? { transform: `translateY(${dragY}px)`, transition: "none" } : undefined}
            >
                {/* ── cabecera (zona de arrastre) ── */}
                <div
                    className="ul-sheet-drag"
                    onTouchStart={onTouchStart}
                    onTouchMove={onTouchMove}
                    onTouchEnd={onTouchEnd}
                >
                    <span className="ul-sheet-handle" aria-hidden="true" />
                    <header className="ul-sheet-header">
                        <div className="ul-sheet-heading">
                            <div className="ul-sheet-badges">
                                <span className={`ul-role ul-role--${role}`}>{ROLE_LABELS[role]}</span>
                                <span className={`ul-status ul-status--${tone}`}>
                                    {user.isBanned ? "BANEADO" : "ACTIVO"}
                                </span>
                            </div>
                            <h3 id="ul-sheet-title" className="ul-sheet-email">{user.email}</h3>
                            {user.displayName && <span className="ul-sheet-sub">{user.displayName}</span>}
                        </div>
                        <button ref={closeRef} type="button" className="ul-sheet-close" onClick={onClose} aria-label="Cerrar detalle">
                            ✕
                        </button>
                    </header>
                </div>

                {/* ── cuerpo ── */}
                <div className="ul-sheet-body">
                    <div className="ul-detail">
                        <div className="ul-detail-block">
                            <span className="ul-detail-title">Cuenta</span>
                            <div className="ul-detail-row"><span>Email</span><strong>{user.email}</strong></div>
                            {user.displayName && (
                                <div className="ul-detail-row"><span>Nombre</span><strong>{user.displayName}</strong></div>
                            )}
                            <div className="ul-detail-row"><span>UID</span><strong className="ul-mono">{user.uid}</strong></div>
                            <div className="ul-detail-row"><span>Rol</span><strong>{ROLE_LABELS[role]}</strong></div>
                        </div>

                        <div className="ul-detail-block">
                            <span className="ul-detail-title">Actividad</span>
                            <div className="ul-detail-row"><span>Creado</span><strong>{formatDateTime(user.metadata?.creationTime)}</strong></div>
                            <div className="ul-detail-row"><span>Último acceso</span><strong>{formatDateTime(user.metadata?.lastSignInTime)}</strong></div>
                            <div className={`ul-detail-row ${user.isBanned ? "ul-red" : "ul-green"}`}>
                                <span>Estado</span><strong>{user.isBanned ? "Baneado" : "Activo"}</strong>
                            </div>
                        </div>

                        {user.isAdmin && (
                            <div className="ul-message ul-message--neutral">
                                <div className="ul-message-text">
                                    <strong>CUENTA_ADMIN</strong>
                                    <span>Las cuentas admin no se pueden banear ni modificar desde el panel.</span>
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                {/* ── pie con acciones (siempre visible, aunque el cuerpo scrollee) ── */}
                {!user.isAdmin && (
                    <footer className="ul-sheet-footer">
                        <button
                            type="button"
                            className="ul-btn ul-btn--accent"
                            onClick={() => onManageClaims(user)}
                        >
                            Gestionar claims
                        </button>
                        {user.isBanned ? (
                            <button type="button" className="ul-btn ul-btn--ok" onClick={() => onUnban(user.uid)}>
                                Desbanear
                            </button>
                        ) : (
                            <button type="button" className="ul-btn ul-btn--danger" onClick={() => onBan(user.email)}>
                                Banear
                            </button>
                        )}
                    </footer>
                )}
            </div>
        </div>,
        document.body
    );
};

const UserList = () => {
    const { theme } = UseTheme()
    const { getUsers, users } = UseUsers()
    const { handleBanUser, handleUnbanUser } = UseSession()

    const [page, setPage]             = useState(1);
    const [selectedUid, setSelectedUid] = useState<string | null>(null);
    const [search, setSearch]         = useState("");

    const [activeRoles, setActiveRoles] = useState<Set<RoleFilter>>(
        new Set(ROLE_ORDER)
    );

    // Usuario abierto en el gestor de claims (null = modal cerrado)
    const [claimsTarget, setClaimsTarget] = useState<User | null>(null);

    useEffect(() => {
        getUsers()
    }, [])

    const allUsers: User[] = Array.isArray(users) ? users : [];

    // Conteo por rol para mostrar en cada filtro
    const roleCounts = useMemo(() => {
        const counts: Record<RoleFilter, number> = { admin: 0, enterprise: 0, partner: 0, user: 0 };
        for (const u of allUsers) counts[getUserRole(u)]++;
        return counts;
    }, [allUsers]);

    const bannedCount = useMemo(() => allUsers.filter(u => u.isBanned).length, [allUsers]);

    // Filtro por rol + búsqueda por nombre, email o rol
    const filteredUsers = useMemo(() => {
        const q = normalize(search.trim());
        return allUsers.filter((u: User) => {
            const role = getUserRole(u);
            if (!activeRoles.has(role)) return false;
            if (!q) return true;
            return [u.displayName, u.email, ROLE_LABELS[role], role]
                .some(field => normalize(field).includes(q));
        });
    }, [allUsers, activeRoles, search]);

    const totalPages = Math.ceil(filteredUsers.length / PAGE_SIZE);
    const pageUsers  = filteredUsers.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

    // Se busca por uid en la lista actual: si se banea/desbanea y se recargan
    // los usuarios, el sheet muestra el estado nuevo sin cerrarse.
    const selectedUser = selectedUid ? allUsers.find(u => u.uid === selectedUid) ?? null : null;

    useEffect(() => {
        setPage(1);
    }, [activeRoles]);

    useEffect(() => {
        setPage(1);
    }, [search]);

    const toggleRole = (role: RoleFilter) => {
        setActiveRoles(prev => {
            const next = new Set(prev);
            if (next.has(role)) next.delete(role);
            else next.add(role);
            return next;
        });
    };

    const closeSheet = useCallback(() => setSelectedUid(null), []);

    // Se cierra el sheet antes de abrir el gestor, para no apilar dos modales
    const openClaims = (user: User) => {
        setSelectedUid(null);
        setClaimsTarget(user);
    };

    return (
        <div className={`user-list-container ${theme}`}>

            {/* ── Resumen ── */}
            <div className="ul-stats">
                <div className="ul-stat">
                    <span className="ul-stat-label">Usuarios</span>
                    <span className="ul-stat-value">{allUsers.length}</span>
                </div>
                <div className="ul-stat ul-stat-accent">
                    <span className="ul-stat-label">Enterprise</span>
                    <span className="ul-stat-value">{roleCounts.enterprise}</span>
                </div>
                <div className="ul-stat">
                    <span className="ul-stat-label">Partners</span>
                    <span className="ul-stat-value ul-stat-value--partner">{roleCounts.partner}</span>
                </div>
                <div className="ul-stat">
                    <span className="ul-stat-label">Baneados</span>
                    <span className={`ul-stat-value${bannedCount > 0 ? " ul-stat-value--danger" : ""}`}>{bannedCount}</span>
                </div>
            </div>

            {/* ── Filtro de roles (estilo tabs, multi-selección) ── */}
            <div className="ul-filters">
                {ROLE_ORDER.map(role => (
                    <button
                        key={role}
                        type="button"
                        className={`ul-filter ul-filter--${role}${activeRoles.has(role) ? " active" : ""}`}
                        onClick={() => toggleRole(role)}
                        aria-pressed={activeRoles.has(role)}
                    >
                        <span className="ul-filter-box" />
                        {ROLE_LABELS[role]}
                    </button>
                ))}
            </div>

            {/* ── Búsqueda ── */}
            <div className="ul-search">
                <input
                    type="search"
                    className="ul-search-input"
                    placeholder="Buscar por nombre, email o rol…"
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                    aria-label="Buscar usuarios"
                />
            </div>

            {/* ── Lista ── */}
            {filteredUsers.length === 0 ? (
                <div className="ul-empty-state">
                    <span className="ul-empty-icon">◫</span>
                    <p>NINGÚN_USUARIO_COINCIDE</p>
                </div>
            ) : (
                <div className="ul-list">
                    {pageUsers.map((user: User) => {
                        const role = getUserRole(user);
                        const tone = user.isBanned ? "error" : "ok";

                        return (
                            <div key={user.uid} className={`ul-wrapper ul-tone-${tone}`}>
                                <button
                                    type="button"
                                    className="ul-row"
                                    onClick={() => setSelectedUid(user.uid)}
                                    aria-haspopup="dialog"
                                    aria-label={`Ver detalle de ${user.email}`}
                                >
                                    <div className="ul-row-left">
                                        <span className="ul-row-date">[{formatDate(user.metadata?.creationTime)}]</span>
                                        <div className="ul-row-title-group">
                                            <span className="ul-row-email">{user.email}</span>
                                            <span className="ul-row-uid">ID: {user.uid.substring(0, 8)}…</span>
                                        </div>
                                    </div>
                                    <div className="ul-row-right">
                                        <span className={`ul-role ul-role--${role}`}>{ROLE_LABELS[role]}</span>
                                        <span className={`ul-status ul-status--${tone}`}>
                                            {user.isBanned ? "BANEADO" : "ACTIVO"}
                                        </span>
                                        <span className="ul-chevron" aria-hidden="true">›</span>
                                    </div>
                                </button>
                            </div>
                        );
                    })}
                </div>
            )}

            {/* ── Paginación ── */}
            {totalPages > 1 && (
                <div className="ul-pagination">
                    <button
                        type="button"
                        className="ul-page-btn"
                        onClick={() => setPage(p => Math.max(1, p - 1))}
                        disabled={page === 1}
                    >
                        ← Anterior
                    </button>
                    <span className="ul-page-info">
                        {page} / {totalPages}
                        <span className="ul-page-total"> · {filteredUsers.length} usuarios</span>
                    </span>
                    <button
                        type="button"
                        className="ul-page-btn"
                        onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                        disabled={page === totalPages}
                    >
                        Siguiente →
                    </button>
                </div>
            )}

            {/* ── Detalle del usuario (bottom sheet) ── */}
            {selectedUser && (
                <UserSheet
                    user={selectedUser}
                    theme={theme}
                    onClose={closeSheet}
                    onManageClaims={openClaims}
                    onBan={handleBanUser}
                    onUnban={handleUnbanUser}
                />
            )}

            {/* ── Gestor de claims (adentro del container para heredar el theme) ── */}
            {claimsTarget && (
                <ClaimsManager
                    user={{ uid: claimsTarget.uid, email: claimsTarget.email }}
                    onClose={() => setClaimsTarget(null)}
                    onUpdated={() => getUsers()}
                />
            )}
        </div>
    )
}

export default UserList