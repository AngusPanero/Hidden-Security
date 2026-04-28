import React, { useState, useEffect } from 'react';
import './cookiesCorporate.css';
import { UseTheme } from '../contexts/ThemeContext';

const CookieBanner: React.FC = () => {
  const { theme } = UseTheme();
  const [visible, setVisible] = useState(false);
  const [leaving, setLeaving] = useState(false);

  useEffect(() => {
    localStorage.clear()
    const consent = localStorage.getItem('cookie-consent');
    if (!consent) {
      const t = setTimeout(() => setVisible(true), 1200);
      return () => clearTimeout(t);
    }
  }, []);

  const dismiss = (value: 'accepted' | 'declined') => {
    setLeaving(true);
    setTimeout(() => {
      localStorage.setItem('cookie-consent', value);
      setVisible(false);
    }, 450);
  };

  if (!visible) return null;

  return (
    <div className={`ck-overlay ${theme} ${leaving ? 'ck-leaving' : ''}`}>
      <div className={`ck-card ${theme}`}>

        {/* emoji */}
        <div className="ck-emoji">🍪</div>

        {/* texto */}
        <div className="ck-body">
          <h3 className="ck-title">Usamos cookies</h3>
          <p className="ck-text">
            Utilizamos cookies para mejorar tu experiencia, recordar tus preferencias y
            analizar el tráfico de forma anónima.{' '}
            <a href="/policy-cookie" className="ck-link">Política de privacidad</a>.
          </p>
        </div>

        {/* acciones */}
        <div className="ck-actions">
          <button className="ck-btn-accept" onClick={() => dismiss('accepted')}>
            Aceptar
          </button>
        </div>

      </div>
    </div>
  );
};

export default CookieBanner;