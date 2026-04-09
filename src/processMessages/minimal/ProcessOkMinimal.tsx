import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import "./errorMinimal.css";
import { UseTheme } from "../../contexts/ThemeContext";

interface ProcessProps {
  processMessage: string;
}

const ProcessOkMinimal = ({ processMessage }: ProcessProps) => {
    const { theme } = UseTheme()
    const navigate = useNavigate();

    useEffect(() => {
        const timer = setTimeout(() => {
            navigate("/");
        }, 5000);
        return () => clearTimeout(timer);
    }, [navigate]);

    return (
        <>
        <div className={`error-container ${theme}`}>
            <div className="error-content">
                <h1 className={`error-title ${theme}`}>{processMessage}</h1>
                <p className={`error-text small ${theme}`}>Serás redirigido automáticamente al inicio.</p>
            </div>
        </div>
        </>
    );
};

export default ProcessOkMinimal;