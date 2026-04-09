import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

interface WidthContextType {
  width: number;
  isMobile: boolean;
}

const WidthContext = createContext<WidthContextType | undefined>(undefined);
interface ProviderProps {
  children: ReactNode;
}

export const WidthProvider = ({ children }: ProviderProps) => {
    const [width, setWidth] = useState(typeof window !== 'undefined' ? window.innerWidth : 0);

    useEffect(() => {
        const handleResize = () => setWidth(window.innerWidth);

        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    const isMobile = width < 768;

    return (
        <WidthContext.Provider value={{ width, isMobile }}>
            {children}
        </WidthContext.Provider>
    );
};

export const UseWidth = () => {
    const context = useContext(WidthContext);
    if (!context) {
        throw new Error("UseWidth debe usarse dentro de un WidthProvider");
    }
    return context;
};