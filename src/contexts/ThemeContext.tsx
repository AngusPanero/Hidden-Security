import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

interface ThemeContextType {
    handleTheme: (e: any) => void;
    theme: string
}

const ThemeContext = createContext<ThemeContextType | null>(null)

interface ProviderProps {
  children: ReactNode;
}

export const ThemeProvider = ({ children }: ProviderProps) => {
    const [ theme, setTheme ] = useState(localStorage.getItem("theme") || "dark")
    
    useEffect(() => {
        localStorage.setItem('theme', theme);
    }, [theme]);

    const handleTheme = (e: any) => {
        setTheme(e)
        localStorage.setItem("theme", theme)
        console.log("Theme: ", theme);
        
    }

    return(
        <ThemeContext.Provider value={{ theme, handleTheme }}>
            { children }
        </ThemeContext.Provider>
    )
}

export const UseTheme = () => {
  const context = useContext(ThemeContext);

  if (!context) {
    throw new Error("useTheme debe ser usado dentro de un ThemeProvider");
  }
  return context; 
};

