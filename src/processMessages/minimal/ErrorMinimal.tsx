import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import "./errorMinimal.css";
import { UseTheme } from "../../contexts/ThemeContext";
import { UseSession } from "../../contexts/SessionContext";

interface ErrorProps {
errorMessage: string 
}

const ErrorMinimal = ({errorMessage}: ErrorProps) => {
    const { theme } = UseTheme()
    const { setError } = UseSession()
    const navigate = useNavigate();

    useEffect(() => {
        const timer = setTimeout(() => {
            setError(null)
            navigate("/");
        }, 5000);
        return () => clearTimeout(timer);
    }, [ navigate, setError ]);

    return (
        <>
        <div className={`error-container ${theme}`}>
            <div className="error-content">
                <h1 className={`error-title ${theme}`}>{errorMessage}</h1>
                <p className={`error-text small ${theme}`}>Serás redirigido automáticamente al inicio.</p>
            </div>
        </div>
        </>
    );
};

export default ErrorMinimal;