import axios from "axios";
import { createContext, useContext, useState, type ReactNode } from "react";

interface UserContextType {
    getUsers: () => void;
    users: any
}

const UserContext = createContext<UserContextType | null>(null)

interface ProviderProps {
  children: ReactNode;
}

export const UsersProvider = ({ children }: ProviderProps) => {
    // Como no uso error y loading, pongo así sin la primera posición asi no da error .tsx pero uso [1], para que tome el valor que le doy por defecto
    const setError = useState<boolean>(false)[1];
    const setLoading = useState<boolean>(false)[1];
    const [ users, setUsers ] = useState<any>("")

    const getUsers = async () => {
        try {
            setError(false)
            setLoading(true)

            const response = await axios.get(`${import.meta.env.VITE_API_URL}/admin/users`, { withCredentials: true })
            if(response.status === 200){
                setUsers(response.data)
            }

        } catch (error: any) {
            setError(true)
            console.error("Error al conseguir listado de usuarios! 🔴", error)
        } finally{
            setLoading(false)
        }
        
    }

    return(
        <UserContext.Provider value={{ users, getUsers }}>
            { children }
        </UserContext.Provider>
    )
}

export const UseUsers = () => {
  const context = useContext(UserContext);

  if (!context) {
    throw new Error("UseUsers debe ser usado dentro de un UsersProvider");
  }
  return context; 
};

