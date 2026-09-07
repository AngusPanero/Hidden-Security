import { useEffect, useMemo, useState } from "react"
import { UseSession } from "../contexts/SessionContext"
import { UseUsers } from "../contexts/UsersContext"
import "./userList.css"
import { UseTheme } from "../contexts/ThemeContext"

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
  // Preparado para el futuro rol de "alumno en formación" -- todavía no lo
  // envía el backend, por eso es opcional. Cuando exista, esta misma
  // interfaz y el filtro de roles ya lo van a reconocer sin más cambios.
  isTrainee?: boolean
}

type RoleFilter = "admin" | "enterprise" | "trainee" | "user";

const ROLE_ORDER: RoleFilter[] = ["admin", "enterprise", "trainee", "user"];

const ROLE_LABELS: Record<RoleFilter, string> = {
  admin:      "Admin",
  enterprise: "Enterprise",
  trainee:    "Trainee",
  user:       "Usuario",
};

const PAGE_SIZE = 15;

// Misma prioridad que renderRoleBadge: admin > enterprise > trainee > user.
// Se usa tanto para pintar el badge como para clasificar en el filtro, así
// nunca se desincronizan.
function getUserRole(user: User): RoleFilter {
  if (user.isAdmin)      return "admin";
  if (user.isEnterprise) return "enterprise";
  if (user.isTrainee)    return "trainee";
  return "user";
}

const UserList = () => {
    const { theme } = UseTheme()
    const { getUsers, users } = UseUsers()
    const { handleBanUser, handleUnbanUser } = UseSession()

    const [page, setPage] = useState(1);

    // Filtro de roles -- todos activos por defecto (se ven todos los usuarios)
    const [activeRoles, setActiveRoles] = useState<Set<RoleFilter>>(
        new Set(ROLE_ORDER)
    );

    useEffect(() => {
        getUsers()
    }, [])

    const allUsers = Array.isArray(users) ? users : [];

    const filteredUsers = useMemo(
        () => allUsers.filter((u: User) => activeRoles.has(getUserRole(u))),
        [allUsers, activeRoles]
    );

    const totalPages = Math.ceil(filteredUsers.length / PAGE_SIZE);
    const pageUsers   = filteredUsers.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

    // Si el filtro cambia y la página actual queda fuera de rango, volvemos a la 1
    useEffect(() => {
        setPage(1);
    }, [activeRoles]);

    const toggleRole = (role: RoleFilter) => {
        setActiveRoles(prev => {
            const next = new Set(prev);
            if (next.has(role)) next.delete(role);
            else next.add(role);
            return next;
        });
    };

    const renderRoleBadge = (user: User) => {
        const role = getUserRole(user);
        if (role === "admin")      return <span className="badge badge-admin">ADMIN</span>
        if (role === "enterprise") return <span className="badge badge-enterprise">ENTERPRISE</span>
        if (role === "trainee")    return <span className="badge badge-trainee">TRAINEE</span>
        return <span className="badge badge-user">USER</span>
    }

    // Guard: si metadata o creationTime vienen indefinidos (usuario sin
    // datos completos), no queremos que se rompa toda la tabla -- se
    // muestra un placeholder en vez de tirar un TypeError.
    const formatDate = (dateString?: string) => {
        if (!dateString) return "—";
        const date = new Date(dateString);
        if (isNaN(date.getTime())) return "—";
        return date.toLocaleString('es-ES', {
            year:  'numeric', month: 'short', day: 'numeric',
            hour:  '2-digit', minute: '2-digit',
        })
    }

    return (
        <div className={`user-list-container ${theme}`}>

            {/* ── Filtro de roles ── */}
            <div className="ul-role-filters">
                {ROLE_ORDER.map(role => (
                    <button
                        key={role}
                        type="button"
                        className={`ul-role-checkbox ul-role-checkbox--${role}${activeRoles.has(role) ? " active" : ""}`}
                        onClick={() => toggleRole(role)}
                        aria-pressed={activeRoles.has(role)}
                    >
                        <span className="ul-role-checkbox-dot" />
                        {ROLE_LABELS[role]}
                    </button>
                ))}
            </div>

            {/* ── Tabla desktop ── */}
            <table className="sec-table">
                <thead>
                    <tr>
                        <th>Usuario</th>
                        <th>Rol</th>
                        <th>Creado el</th>
                        <th style={{ textAlign: 'center' }}>Estado</th>
                        <th style={{ textAlign: 'right' }}>Acciones</th>
                    </tr>
                </thead>
                <tbody>
                    {pageUsers.map((user: User) => (
                        <tr key={user.uid}>
                            <td>
                                <div style={{ display: 'flex', flexDirection: 'column' }}>
                                    <span style={{ fontWeight: 'bold' }}>{user.email}</span>
                                    <span style={{ fontSize: '0.7rem', color: 'var(--sec-text-dim)' }}>
                                        ID: {user.uid.substring(0, 8)}...
                                    </span>
                                </div>
                            </td>
                            <td>{renderRoleBadge(user)}</td>
                            <td>{formatDate(user.metadata?.creationTime)}</td>
                            <td style={{ textAlign: 'center' }}>
                                {user.isBanned
                                    ? <span className="status-banned">Baneado</span>
                                    : <span className="status-active">Activo</span>
                                }
                            </td>
                            <td style={{ textAlign: 'right' }}>
                                {user.isBanned ? (
                                    <button onClick={() => handleUnbanUser(user.uid)} className="sec-btn btn-unban">
                                        Desbanear
                                    </button>
                                ) : (
                                    <button disabled={user.isAdmin} onClick={() => handleBanUser(user.email)} className="sec-btn btn-ban">
                                        Banear
                                    </button>
                                )}
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>

            {/* ── Cards mobile ── */}
            <div className="ul-mobile-list">
                {pageUsers.map((user: User) => (
                    <div key={user.uid} className="ul-mobile-card">
                        <div className="ul-mobile-card-top">
                            <div>
                                <p className="ul-mobile-email">{user.email}</p>
                                <p className="ul-mobile-uid">ID: {user.uid.substring(0, 8)}...</p>
                            </div>
                            {renderRoleBadge(user)}
                        </div>
                        <div className="ul-mobile-meta">
                            <div className="ul-mobile-left">
                                {user.isBanned
                                    ? <span className="status-banned">Baneado</span>
                                    : <span className="status-active">Activo</span>
                                }
                                <span className="ul-mobile-date">{formatDate(user.metadata?.creationTime)}</span>
                            </div>
                            {user.isBanned ? (
                                <button onClick={() => handleUnbanUser(user.uid)} className="sec-btn btn-unban">
                                    Desbanear
                                </button>
                            ) : (
                                <button disabled={user.isAdmin} onClick={() => handleBanUser(user.email)} className="sec-btn btn-ban">
                                    Banear
                                </button>
                            )}
                        </div>
                    </div>
                ))}
            </div>

            {/* ── Estado vacío por filtro ── */}
            {filteredUsers.length === 0 && (
                <p className="ul-empty">Ningún usuario coincide con los roles seleccionados.</p>
            )}

            {/* ── Paginación ── */}
            {totalPages > 1 && (
                <div className="ul-pagination">
                    <button
                        className="ul-page-btn"
                        onClick={() => setPage(p => Math.max(1, p - 1))}
                        disabled={page === 1}
                    >
                        ← ANTERIOR
                    </button>
                    <span className="ul-page-info">
                        {page} / {totalPages}
                        <span className="ul-page-total"> · {filteredUsers.length} usuarios</span>
                    </span>
                    <button
                        className="ul-page-btn"
                        onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                        disabled={page === totalPages}
                    >
                        SIGUIENTE →
                    </button>
                </div>
            )}
        </div>
    )
}

export default UserList