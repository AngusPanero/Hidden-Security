import { UseLanguage } from "../../contexts/LanguageContext";
import { UseTheme } from "../../contexts/ThemeContext";
import "./politicaCookieCube.css";

const PoliticaCookiesCube = () => {
    const { theme } = UseTheme();
    const { texts, language } = UseLanguage();
    
    return (
        <section className={`cookies-page-wrapper ${theme}`}>
            <div className="cookies-container">
                <div className="cookies-header">
                    <span className="cookies-tag">SYSTEM_PRIVACY_PROTOCOL</span>
                    <h1 className="cookies-title">{texts[language].cookies.title}</h1>
                </div>

                <p className="cookies-text">
                    {texts[language].cookies.intro}
                </p>

                <div className="cookies-content-body">
                    <div className="cookies-section">
                        <h3>{texts[language].cookies.questionWhat}</h3>
                        <p className="cookies-text">
                            {texts[language].cookies.answerWhat}
                        </p>
                    </div>

                    <div className="cookies-section">
                        <h3>{texts[language].cookies.questionTypes}</h3>
                        <ul className="cookies-list">
                            <li>{texts[language].cookies.typeEssential}</li>
                            <li>{texts[language].cookies.typePerformance}</li>
                            <li>{texts[language].cookies.typeFunctionality}</li>
                        </ul>
                    </div>

                    <div className="cookies-section">
                        <h3>{texts[language].cookies.questionManage}</h3>
                        <p className="cookies-text">
                            {texts[language].cookies.answerManage}
                        </p>
                    </div>
                </div>
            </div>
        </section>
    );
};

export default PoliticaCookiesCube;