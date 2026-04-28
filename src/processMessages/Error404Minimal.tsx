import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import "./error404Minimal.css";
import { UseTheme } from "../contexts/ThemeContext";
import { UseSession } from "../contexts/SessionContext";

const DURATION = 6;

const Error404Minimal = () => {
  const { theme }    = UseTheme();
  const { setError } = UseSession();
  const navigate     = useNavigate();
  const [count, setCount] = useState(DURATION);

  useEffect(() => {
    const iv = setInterval(() => {
      setCount((c) => {
        if (c <= 1) { clearInterval(iv); setError(null); navigate("/"); }
        return c - 1;
      });
    }, 1000);
    return () => clearInterval(iv);
  }, [navigate, setError]);

  return (
    <main className={`em-root ${theme}`}>

      {/* ── fondo ── */}
      {/* <div className="em-grid" /> */}
      <div className="em-watermark">404</div>

      {/* ── contenido ── */}
      <section className="em-center">
        <motion.div
          className="em-box"
          initial={{ opacity: 0, y: 32 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 1, ease: [0.22, 1, 0.36, 1] }}
        >
          {/* eyebrow */}
          <motion.div
            className="em-eyebrow"
            initial={{ opacity: 0, x: -16 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.7, delay: 0.2, ease: [0.22, 1, 0.36, 1] }}
          >
            <span className="em-eyebrow-dot" />
            SYSTEM_RECOVERY · ERROR 404
          </motion.div>

          {/* título */}
          <motion.h1
            className="em-title"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.85, delay: 0.35, ease: [0.22, 1, 0.36, 1] }}
          >
            Página no
            <br />
            <span className="em-title-stroke">encontrada.</span>
          </motion.h1>

          {/* descripción */}
          <motion.p
            className="em-desc"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.8, delay: 0.55 }}
          >
            El contenido que buscás no existe o fue movido a otra dirección.
            Serás redirigido al inicio automáticamente.
          </motion.p>

          {/* acciones */}
          <motion.div
            className="em-actions"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.7 }}
          >
            <button
              className="em-btn-primary"
              onClick={() => { setError(null); navigate("/"); }}
            >
              Ir al inicio
              <svg viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M2 7h10M8 3l4 4-4 4"/>
              </svg>
            </button>
            <button className="em-btn-ghost" onClick={() => navigate(-1)}>
              Volver atrás
            </button>
          </motion.div>
        </motion.div>
      </section>

      {/* ── barra inferior ── */}
      <footer className="em-footer">

        {/* progress + countdown */}
        <div className="em-progress-row">
          <span className="em-countdown">
            Redirigiendo en <strong>{count}s</strong>
          </span>
          <div className="em-progress-track">
            <motion.div
              className="em-progress-fill"
              initial={{ width: "0%" }}
              animate={{ width: "100%" }}
              transition={{ duration: DURATION, ease: "linear" }}
            />
          </div>
        </div>

        {/* powered by */}
        <a
          href="https://www.deepdev.com.ar"
          target="_blank"
          rel="noreferrer"
          className="em-powered"
        >
          Powered by
          <span className="em-powered-name">DeepDev Studio</span>
          <svg viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
            <path d="M2 8L8 2M5 2h3v3"/>
          </svg>
        </a>

      </footer>

    </main>
  );
};

export default Error404Minimal;