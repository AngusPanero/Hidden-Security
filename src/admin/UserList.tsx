import { useEffect } from "react"
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
}

const UserList = () => {
    const { theme } = UseTheme()
    const { getUsers, users } = UseUsers()
    const { handleBanUser, handleUnbanUser } = UseSession()

    useEffect(() => {
        getUsers()
    }, [])
  
  const renderRoleBadge = (user: User) => {
    if (user.isAdmin) return <span className="badge badge-admin">ADMIN</span>
    if (user.isEnterprise) return <span className="badge badge-enterprise">ENTERPRISE</span>
    return <span className="badge badge-user">USER</span>
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('es-ES', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    })
  }

  return (
    <div className={`user-list-container ${theme}`}>
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
        {Array.isArray(users) && users.map((user: User) => (
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

              <td>{formatDate(user.metadata.creationTime)}</td>

              <td style={{ textAlign: 'center' }}>
                {user.isBanned ? (
                  <span className="status-banned">Baneado</span>
                ) : (
                  <span className="status-active">Activo</span>
                )}
              </td>

              <td style={{ textAlign: 'right' }}>
                {user.isBanned ? (
                  <button
                    onClick={() => handleUnbanUser(user.uid)}
                    className="sec-btn btn-unban"
                  >
                    Desbanear
                  </button>
                ) : (
                  <button
                    disabled={user.isAdmin}
                    onClick={() => handleBanUser(user.email)}
                    className="sec-btn btn-ban"
                  >
                    Banear
                  </button>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

export default UserList