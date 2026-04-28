import { UseTheme } from "../contexts/ThemeContext";
import "./politicaCookie.css";

const SECTIONS = [
  {
    title: "¿Qué son las cookies?",
    content: `Las cookies son pequeños archivos de texto que los sitios web almacenan en tu dispositivo cuando los visitás. Permiten que el sitio recuerde tus acciones y preferencias durante un período de tiempo, para que no tengas que volver a configurarlas cada vez que lo visitás.`,
  },
  {
    title: "Marco legal en Argentina",
    content: `En la República Argentina, el tratamiento de datos personales está regulado por la Ley N° 25.326 de Protección de los Datos Personales y su decreto reglamentario N° 1558/2001. Esta normativa establece que los titulares de los datos tienen derecho a conocer qué información se recopila sobre ellos y con qué finalidad. El uso de cookies que recopilen datos personales queda sujeto al cumplimiento de esta ley. La Agencia de Acceso a la Información Pública (AAIP) es el organismo de control competente.`,
  },
  {
    title: "¿Qué cookies utilizamos?",
    content: null,
    list: [
      {
        name: "Cookies esenciales",
        desc: "Necesarias para el funcionamiento básico del sitio. Sin ellas, servicios como el inicio de sesión o el carrito de compras no estarían disponibles. No requieren consentimiento.",
      },
      {
        name: "Cookies de rendimiento",
        desc: "Recopilan información anónima sobre cómo los usuarios navegan el sitio. Nos ayudan a identificar qué páginas son más visitadas y detectar errores de carga. Toda la información es agregada y no identifica al usuario.",
      },
      {
        name: "Cookies de funcionalidad",
        desc: "Recuerdan tus preferencias como el tema visual (oscuro o claro) o el idioma seleccionado. Mejoran tu experiencia sin compartir datos con terceros.",
      },
      {
        name: "Cookies de análisis",
        desc: "Utilizamos herramientas de analítica web (como Google Analytics) con IP anonimizada para entender el comportamiento de los visitantes de forma agregada y mejorar nuestros servicios.",
      },
    ],
  },
  {
    title: "¿Cómo gestionarlas?",
    content: `Podés configurar tu navegador para que rechace todas las cookies o te avise cuando se envíe una. Ten en cuenta que al deshabilitar ciertas cookies algunas funciones del sitio pueden no estar disponibles. La mayoría de los navegadores modernos (Chrome, Firefox, Safari, Edge) ofrecen configuraciones granulares desde su menú de privacidad.`,
  },
  {
    title: "Consentimiento",
    content: `Al continuar navegando este sitio, o al hacer clic en "Aceptar todo" en nuestro aviso de cookies, aceptás el uso de cookies no esenciales conforme a la presente política. Podés retirar tu consentimiento en cualquier momento limpiando las cookies de tu navegador. Este consentimiento es válido de acuerdo a lo establecido en la Ley N° 25.326 y sus modificatorias.`,
  },
  {
    title: "Derechos del titular",
    content: `Como titular de los datos, tenés derecho a acceder, rectificar, actualizar o suprimir la información personal que tengamos registrada, conforme al artículo 14 de la Ley N° 25.326. Para ejercer estos derechos podés contactarnos a través de la sección Contacto de este sitio. La AAIP tiene la atribución de atender denuncias y reclamos en caso de que se entienda vulnerado el derecho a la protección de datos.`,
  },
  {
    title: "Cambios en esta política",
    content: `Nos reservamos el derecho de actualizar esta política en cualquier momento. Las modificaciones serán publicadas en esta página con la fecha de última actualización. Te recomendamos revisarla periódicamente.`,
  },
];

const PoliticaCookies = () => {
  const { theme } = UseTheme();

  return (
    <section className={`pc-wrapper ${theme}`}>
      <div className="pc-container">

        {/* encabezado */}
        <div className="pc-header">
          <span className="pc-eyebrow">Política de Privacidad</span>
          <h1 className="pc-title">
            Política de<br />
            <span className="pc-title-accent">Cookies</span>
          </h1>
          <p className="pc-intro">
            En <strong>Hidden Security</strong> nos comprometemos a ser transparentes sobre cómo
            usamos la información que recopilamos cuando navegás nuestro sitio. Esta política
            explica qué son las cookies, cuáles utilizamos y cómo podés gestionarlas, en
            cumplimiento de la legislación argentina vigente.
          </p>
          <div className="pc-meta">
            <span>Última actualización: {new Date().toLocaleDateString("es-AR", { year: "numeric", month: "long", day: "numeric" })}</span>
            <span className="pc-meta-dot">·</span>
            <span>Ley N° 25.326</span>
          </div>
        </div>

        {/* secciones */}
        <div className="pc-body">
          {SECTIONS.map((sec, i) => (
            <div key={i} className="pc-section">
              <h2 className="pc-section-title">
                <span className="pc-section-bar" />
                {sec.title}
              </h2>

              {sec.content && (
                <p className="pc-section-text">{sec.content}</p>
              )}

              {sec.list && (
                <ul className="pc-list">
                  {sec.list.map((item, j) => (
                    <li key={j} className="pc-list-item">
                      <span className="pc-list-name">{item.name}</span>
                      <span className="pc-list-desc">{item.desc}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          ))}
        </div>

        {/* contacto */}
        <div className="pc-contact">
          <p>
            ¿Tenés dudas sobre esta política?{" "}
            <a href="/contact" className="pc-contact-link">Contactanos</a>.
          </p>
        </div>

      </div>
    </section>
  );
};

export default PoliticaCookies;