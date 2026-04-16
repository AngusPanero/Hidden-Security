import { UseLanguage } from "../contexts/LanguageContext";
import { UseTheme } from "../contexts/ThemeContext";
import "./raffleTermsCube.css";

const RaffleTermsCube = () => {
    const { theme } = UseTheme();
    const { texts, language } = UseLanguage()

    return (
        <section className={`terminos-page-wrapper ${theme}`}>
            <div className="terminos-container">
                {/*TITULO*/}
                <h1 className="terminos-title">{texts[language].raffleTerm.terms_title}</h1>
                {/*SUB TITULO*/}
                <p className="terminos-intro">
                    {texts[language].raffleTerm.terms_subtitle}
                </p>

                <div className="terminos-content-body">
                    <h3>{texts[language].raffleTerm.term1_title}</h3>
                    <p className="terminos-text">
                        {texts[language].raffleTerm.term1_text}
                    </p>

                    <h3>{texts[language].raffleTerm.term2_title}</h3>
                    <p className="terminos-text">
                        {texts[language].raffleTerm.term2_text}
                    </p>

                    <h3>{texts[language].raffleTerm.term3_title}</h3>
                    <p className="terminos-text">
                        {texts[language].raffleTerm.term3_text}
                    </p>

                    <h3>{texts[language].raffleTerm.term4_title}</h3>
                    <p className="terminos-text">
                        {texts[language].raffleTerm.term4_text}
                    </p>

                    <h3>{texts[language].raffleTerm.term5_title}</h3>
                    <p className="terminos-text">
                        {texts[language].raffleTerm.term5_text}
                    </p>

                    <div className="terminos-footer">
                        <p>{texts[language].raffleTerm.terms_footer}</p>
                    </div>
                </div>
            </div>
        </section>
    );
};

export default RaffleTermsCube;