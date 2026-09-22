import { UseTheme } from "../contexts/ThemeContext";
import "./politicasPrivacidad.css";

const LAST_UPDATE = "septiembre de 2026";
const CONTACT_EMAIL = "contacto@hidden-security.org";
const CONTACT_ADDRESS = "Agustín de Elía 521, Piso 2A, Ramos Mejía, La Matanza, Buenos Aires, Argentina";

// Revisar que estas URLs sigan vigentes antes de publicar
const LINKS = {
  mercadoPago: "https://www.mercadopago.com.ar/privacidad",
  aaip: "https://www.argentina.gob.ar/aaip/datospersonales",
  cookies: "/politica-cookies",
} as const;

/* --- TIPOS --- */
type ParagraphBlock = { type: "p"; text: string };
type ListBlock = { type: "list"; items: string[] };
type CardsBlock = { type: "cards"; items: { name: string; desc: string }[] };
type LinkBlock = { type: "link"; label: string; href: string; external?: boolean };

type Block = ParagraphBlock | ListBlock | CardsBlock | LinkBlock;

interface Section {
  title: string;
  blocks: Block[];
}

/* --- CONTENIDO --- */
const SECTIONS: Section[] = [
  {
    title: "Responsable del tratamiento",
    blocks: [
      { type: "p", text: "Hidden Security se compromete a proteger la privacidad y los datos personales de las personas que utilizan su plataforma." },
      { type: "p", text: "El responsable del tratamiento de los datos personales es:" },
      {
        type: "cards",
        items: [
          { name: "María Belén Arroyo – Hidden Security", desc: `Correo electrónico: ${CONTACT_EMAIL}` },
          { name: "Domicilio para el ejercicio de derechos", desc: CONTACT_ADDRESS },
        ],
      },
      { type: "p", text: "El tratamiento de datos personales se realiza de conformidad con la Ley N.º 25.326 de Protección de los Datos Personales, su normativa reglamentaria y demás disposiciones aplicables." },
    ],
  },
  {
    title: "Alcance",
    blocks: [
      { type: "p", text: "Esta Política de Privacidad describe cómo Hidden Security recopila, utiliza, almacena, comparte y protege los datos personales de quienes utilizan sus servicios." },
      { type: "p", text: "Comprende, según corresponda, a:" },
      {
        type: "list",
        items: [
          "Usuarios y profesionales registrados.",
          "Alumnos.",
          "Personas que realizan cursos o evaluaciones.",
          "Personas certificadas.",
          "Representantes y usuarios de empresas.",
          "Clientes que adquieren planes, vouchers u otros servicios.",
          "Personas que interactúan con las funcionalidades de la plataforma.",
        ],
      },
      { type: "p", text: "La utilización de Hidden Security implica el tratamiento de determinados datos necesarios para prestar los servicios solicitados." },
    ],
  },
  {
    title: "Datos personales que podemos recopilar",
    blocks: [
      { type: "p", text: "Dependiendo de las funcionalidades utilizadas, Hidden Security podrá tratar las siguientes categorías de información:" },
      {
        type: "cards",
        items: [
          { name: "Datos identificatorios y de contacto", desc: "Nombre, apellido, correo electrónico, teléfono, DNI y datos necesarios para identificar la cuenta." },
          { name: "Datos de domicilio", desc: "Dirección, ciudad, provincia y código postal cuando sean necesarios para una compra, facturación u otra operación." },
          { name: "Datos académicos y profesionales", desc: "Formación, experiencia laboral, conocimientos, habilidades, certificaciones, idiomas, CV y demás información incorporada al perfil profesional." },
          { name: "Información relacionada con Hidden Security", desc: "Cursos realizados, progreso, skills asociadas, certificaciones obtenidas, vigencia de certificaciones, evaluaciones y demás información generada mediante el uso de las funcionalidades educativas o profesionales de la plataforma." },
          { name: "Datos de compras y operaciones", desc: "Producto o plan contratado, importe, cuotas, descuentos, cupones, identificadores de órdenes y pagos, estado de la operación y fechas correspondientes." },
          { name: "Datos administrativos", desc: "Tipo y vigencia del plan, condición empresarial de una cuenta, estado de vouchers, verificación de órdenes y emisión de facturas." },
          { name: "Datos técnicos y de seguridad", desc: "Determinados proveedores tecnológicos pueden procesar información como dirección IP, navegador, dispositivo, user agent, registros técnicos y datos relacionados con autenticación y seguridad. Por ejemplo, Firebase Authentication informa que procesa, entre otros elementos, correo, teléfono, IP y user agent para autenticación y prevención de abuso." },
        ],
      },
      { type: "p", text: "Hidden Security no almacena números completos de tarjetas de crédito o débito, códigos CVV ni credenciales del medio de pago cuando el pago es procesado externamente por Mercado Pago." },
    ],
  },
  {
    title: "Cómo obtenemos los datos",
    blocks: [
      { type: "p", text: "Los datos pueden ser obtenidos:" },
      {
        type: "list",
        items: [
          "Directamente del titular al registrarse o completar su perfil.",
          "Al contratar productos o servicios.",
          "Durante la realización de cursos, evaluaciones o certificaciones.",
          "Mediante la utilización de las funcionalidades de Hidden Security.",
          "Como resultado de las operaciones realizadas dentro de la plataforma.",
          "Mediante proveedores tecnológicos necesarios para brindar el servicio.",
        ],
      },
    ],
  },
  {
    title: "Finalidades del tratamiento",
    blocks: [
      { type: "p", text: "Hidden Security podrá utilizar los datos personales para:" },
      {
        type: "list",
        items: [
          "Crear y administrar cuentas de usuario.",
          "Autenticar usuarios y proteger el acceso a la plataforma.",
          "Administrar perfiles profesionales.",
          "Brindar cursos, evaluaciones y certificaciones.",
          "Registrar y validar skills y evidencias.",
          "Gestionar vouchers y planes.",
          "Permitir el funcionamiento de la bolsa de empleo.",
          "Facilitar la interacción entre profesionales y empresas.",
          "Gestionar compras, pagos y facturación.",
          "Prestar soporte.",
          "Prevenir abuso, fraude o usos indebidos.",
          "Mantener la seguridad de la plataforma.",
          "Cumplir obligaciones legales.",
          "Operar, mantener y mejorar los servicios de Hidden Security.",
        ],
      },
      { type: "p", text: "Los datos no serán utilizados para finalidades incompatibles con aquellas informadas al momento de su recopilación." },
    ],
  },
  {
    title: "Perfiles profesionales y empresas",
    blocks: [
      { type: "p", text: "Una de las finalidades de Hidden Security es facilitar la conexión entre profesionales de ciberseguridad y empresas que buscan talento." },
      { type: "p", text: "Los perfiles profesionales no serán publicados de forma abierta en Internet." },
      { type: "p", text: "Determinada información del perfil podrá ser consultada por empresas registradas y con acceso habilitado a los servicios empresariales de Hidden Security, con la finalidad de buscar, evaluar y contactar potenciales candidatos en el marco de procesos profesionales o laborales." },
      { type: "p", text: "La información disponible podrá incluir, según corresponda, experiencia, skills, formación, certificaciones, idiomas y evidencias de validación obtenidas dentro de Hidden Security." },
      { type: "p", text: "Hidden Security no garantiza entrevistas, contrataciones ni resultados laborales. Las decisiones relacionadas con procesos de selección corresponden exclusivamente a las empresas y a los candidatos involucrados." },
    ],
  },
  {
    title: "Cursos, evaluaciones y certificaciones",
    blocks: [
      { type: "p", text: "Cuando una persona participe en actividades educativas, evaluaciones o procesos de certificación, Hidden Security podrá registrar información necesaria para administrar dichos servicios, incluyendo progreso, resultados, intentos, vigencia de certificaciones y evidencias asociadas a las habilidades evaluadas." },
      { type: "p", text: "Cuando corresponda, también podrán registrarse eventos relacionados con la integridad y seguridad de las evaluaciones." },
      { type: "p", text: "Los resultados podrán utilizarse para determinar el cumplimiento de los requisitos establecidos para la emisión de certificaciones o validaciones de habilidades." },
    ],
  },
  {
    title: "Pagos y facturación",
    blocks: [
      { type: "p", text: "Los pagos realizados a través de la plataforma podrán ser procesados mediante Mercado Pago." },
      { type: "p", text: "Mercado Pago trata los datos necesarios para procesar las operaciones conforme a sus propias condiciones y política de privacidad. Su declaración vigente contempla, entre otras categorías, información identificatoria, medios de pago y datos transaccionales." },
      { type: "link", label: "Política de Privacidad de Mercado Pago", href: LINKS.mercadoPago, external: true },
      { type: "p", text: "Hidden Security podrá conservar información administrativa relacionada con la operación, como identificador de pago, monto, cuotas, producto adquirido, estado, descuentos y fechas, pero no los datos completos de la tarjeta utilizados para realizar el pago." },
    ],
  },
  {
    title: "Proveedores tecnológicos",
    blocks: [
      { type: "p", text: "Para prestar sus servicios, Hidden Security utiliza proveedores tecnológicos externos. Actualmente estos incluyen:" },
      {
        type: "cards",
        items: [
          { name: "Google Firebase Authentication", desc: "Autenticación." },
          { name: "Render", desc: "Infraestructura de backend." },
          { name: "MongoDB Atlas", desc: "Almacenamiento de datos." },
          { name: "Cloudflare", desc: "Servicios de red, proxy/CDN y seguridad." },
          { name: "Mercado Pago", desc: "Procesamiento de pagos." },
        ],
      },
      { type: "p", text: "Estos proveedores podrán procesar determinada información en la medida necesaria para prestar sus respectivos servicios." },
    ],
  },
  {
    title: "Transferencias internacionales de datos",
    blocks: [
      { type: "p", text: "Algunos de los proveedores tecnológicos utilizados por Hidden Security operan infraestructura fuera de la República Argentina." },
      { type: "p", text: "Actualmente, el backend de Hidden Security se encuentra configurado en infraestructura de Render ubicada en Oregon, Estados Unidos, y la base de datos MongoDB Atlas se encuentra configurada sobre infraestructura de AWS en São Paulo, Brasil. Asimismo, Firebase informa oficialmente que su servicio Firebase Authentication procesa datos exclusivamente en centros de datos ubicados en Estados Unidos." },
      { type: "p", text: "En consecuencia, determinados datos personales pueden ser objeto de tratamiento o transferencia internacional." },
      { type: "p", text: "Hidden Security adoptará los mecanismos y garantías exigidos por la normativa argentina aplicable para las transferencias internacionales de datos personales." },
      { type: "p", text: "La AAIP establece mecanismos específicos para transferencias a jurisdicciones que no cuentan con reconocimiento de nivel adecuado de protección, incluyendo cláusulas contractuales modelo y otros mecanismos legalmente previstos." },
    ],
  },
  {
    title: "Conservación",
    blocks: [
      { type: "p", text: "Los datos personales serán conservados mientras la cuenta permanezca activa y durante el tiempo necesario para cumplir las finalidades para las cuales fueron recopilados." },
      { type: "p", text: "Determinada información podrá conservarse durante un período adicional cuando resulte necesario para cumplir obligaciones legales, fiscales, contables, contractuales, de seguridad o para atender eventuales reclamos." },
      { type: "p", text: "Cuando corresponda y resulte legalmente procedente, los datos podrán posteriormente ser eliminados o anonimizados." },
    ],
  },
  {
    title: "Seguridad",
    blocks: [
      { type: "p", text: "Hidden Security adopta medidas técnicas y organizativas destinadas a proteger la confidencialidad, integridad y disponibilidad de los datos personales." },
      { type: "p", text: "Entre ellas pueden incluirse mecanismos de autenticación, controles de acceso, separación de permisos según roles, acceso limitado a personal autorizado y medidas de seguridad proporcionadas por la infraestructura tecnológica utilizada." },
      { type: "p", text: "Ningún sistema informático permite garantizar un nivel de seguridad absoluto. Hidden Security revisará sus medidas de protección conforme evolucione la plataforma y sus riesgos." },
    ],
  },
  {
    title: "Derechos de los titulares",
    blocks: [
      { type: "p", text: "Los titulares podrán ejercer los derechos reconocidos por la normativa argentina, incluyendo solicitar acceso, rectificación, actualización o supresión de sus datos personales cuando corresponda." },
      { type: "p", text: "Las solicitudes podrán enviarse a:" },
      { type: "link", label: CONTACT_EMAIL, href: `mailto:${CONTACT_EMAIL}` },
      { type: "p", text: "La solicitud deberá permitir identificar al titular e indicar el derecho que desea ejercer. Cuando sea necesario verificar la identidad, Hidden Security solicitará únicamente la información necesaria para realizar dicha verificación." },
      {
        type: "cards",
        items: [
          { name: "Derecho de acceso", desc: "Según informa actualmente la AAIP, puede ejercerse gratuitamente cada seis meses y el responsable dispone de 10 días corridos para responder." },
          { name: "Rectificación, actualización o supresión", desc: "La AAIP informa un plazo de 5 días hábiles para responder." },
        ],
      },
      { type: "p", text: "El titular también podrá efectuar un reclamo ante la Agencia de Acceso a la Información Pública (AAIP), autoridad de aplicación en materia de protección de datos personales en Argentina." },
      { type: "link", label: "Derechos sobre tus datos personales — AAIP", href: LINKS.aaip, external: true },
    ],
  },
  {
    title: "Eliminación de la cuenta",
    blocks: [
      { type: "p", text: "El usuario podrá solicitar la eliminación de su cuenta y, cuando corresponda legalmente, la supresión de sus datos personales." },
      { type: "p", text: "La eliminación de una cuenta no necesariamente implica la eliminación inmediata de toda información asociada. Hidden Security podrá conservar aquella información cuya conservación sea necesaria para cumplir obligaciones legales, fiscales, contractuales, administrativas o de seguridad." },
    ],
  },
  {
    title: "Menores de edad",
    blocks: [
      { type: "p", text: "Los servicios de Hidden Security están destinados exclusivamente a personas de 18 años o más." },
      { type: "p", text: "No se permite el registro de menores de 18 años en la plataforma." },
      { type: "p", text: "Si Hidden Security detectara que se han proporcionado datos de una persona menor de edad en incumplimiento de esta condición, podrá adoptar las medidas necesarias para cancelar la cuenta y eliminar los datos cuando corresponda." },
    ],
  },
  {
    title: "Cookies y tecnologías similares",
    blocks: [
      { type: "p", text: "Hidden Security puede utilizar cookies y tecnologías similares necesarias para el funcionamiento, autenticación, seguridad y prestación de los servicios." },
      { type: "p", text: "Cuando se incorporen tecnologías de analítica, medición, publicidad u otras funcionalidades no estrictamente necesarias, su utilización será informada y gestionada conforme corresponda." },
      { type: "p", text: "La información específica se desarrollará en la Política de Cookies." },
      { type: "link", label: "Ver Política de Cookies", href: LINKS.cookies },
    ],
  },
  {
    title: "Modificaciones",
    blocks: [
      { type: "p", text: "Hidden Security podrá actualizar esta Política de Privacidad cuando se produzcan modificaciones en sus servicios, funcionalidades, proveedores, infraestructura o requisitos legales." },
      { type: "p", text: "Cuando las modificaciones sean relevantes, se comunicarán mediante medios razonables dentro de la plataforma o a través de los datos de contacto disponibles." },
      { type: "p", text: "La fecha de la última actualización estará indicada al comienzo del documento." },
    ],
  },
  {
    title: "Contacto",
    blocks: [
      { type: "p", text: "Para consultas relacionadas con privacidad, protección de datos personales o ejercicio de derechos, podés comunicarte a través de los datos que figuran a continuación." },
    ],
  },
];

const pad = (n: number): string => String(n).padStart(2, "0");

const renderBlock = (block: Block, key: number) => {
  switch (block.type) {
    case "p":
      return <p key={key} className="pp-section-text">{block.text}</p>;

    case "list":
      return (
        <ul key={key} className="pp-bullets">
          {block.items.map((item, j) => (
            <li key={j} className="pp-bullet">{item}</li>
          ))}
        </ul>
      );

    case "cards":
      return (
        <ul key={key} className="pp-list">
          {block.items.map((item, j) => (
            <li key={j} className="pp-list-item">
              <span className="pp-list-name">{item.name}</span>
              <span className="pp-list-desc">{item.desc}</span>
            </li>
          ))}
        </ul>
      );

    case "link":
      return (
        <a
          key={key}
          href={block.href}
          className="pp-inline-link"
          {...(block.external ? { target: "_blank", rel: "noopener noreferrer" } : {})}
        >
          {block.label}
          {block.external && <span className="pp-sr-only"> (se abre en una nueva pestaña)</span>}
        </a>
      );

    default:
      return null;
  }
};

const PoliticasPrivacidad = () => {
  const { theme } = UseTheme();

  return (
    <section className={`pp-wrapper ${theme}`}>
      <div className="pp-container">

        {/* encabezado */}
        <div className="pp-header">
          <span className="pp-eyebrow">Legal</span>
          <h1 className="pp-title">
            Política de<br />
            <span className="pp-title-accent">Privacidad</span>
          </h1>
          <p className="pp-intro">
            En <strong>Hidden Security</strong> tratamos tus datos personales para que puedas
            formarte, certificarte y conectar con empresas. Esta política explica qué datos
            recopilamos, para qué los usamos, con quién los compartimos y cómo podés ejercer
            tus derechos.
          </p>
          <div className="pp-meta">
            <span>Última actualización: {LAST_UPDATE}</span>
            <span className="pp-meta-dot">·</span>
            <span>Ley N° 25.326</span>
          </div>
        </div>

        {/* índice */}
        <nav className="pp-index" aria-label="Índice de secciones">
          <span className="pp-index-title">Índice</span>
          <ol className="pp-index-list">
            {SECTIONS.map((sec, i) => (
              <li key={i}>
                <a href={`#pp-${i + 1}`} className="pp-index-link">
                  <span className="pp-index-num">{pad(i + 1)}</span>
                  {sec.title}
                </a>
              </li>
            ))}
          </ol>
        </nav>

        {/* secciones */}
        <div className="pp-body">
          {SECTIONS.map((sec, i) => (
            <article key={i} id={`pp-${i + 1}`} className="pp-section">
              <h2 className="pp-section-title">
                <span className="pp-section-bar" />
                <span className="pp-section-num">{pad(i + 1)}</span>
                {sec.title}
              </h2>
              <div className="pp-section-content">
                {sec.blocks.map((block, j) => renderBlock(block, j))}
              </div>
            </article>
          ))}
        </div>

        {/* contacto */}
        <div className="pp-contact">
          <p className="pp-contact-name">Hidden Security · Responsable: María Belén Arroyo</p>
          <p>
            <a href={`mailto:${CONTACT_EMAIL}`} className="pp-contact-link">{CONTACT_EMAIL}</a>
          </p>
          <p className="pp-contact-address">{CONTACT_ADDRESS}</p>
        </div>

      </div>
    </section>
  );
};

export default PoliticasPrivacidad;