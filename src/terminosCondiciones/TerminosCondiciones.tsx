import { UseTheme } from "../contexts/ThemeContext";
import "./terminosCondiciones.css";

const LAST_UPDATE = "septiembre de 2026";
const CONTACT_EMAIL = "contacto@hidden-security.org";

/* --- TIPOS --- */
type ParagraphBlock = { type: "p"; text: string };
type ListBlock = { type: "list"; items: string[] };
type CardsBlock = { type: "cards"; items: { name: string; desc: string }[] };

type Block = ParagraphBlock | ListBlock | CardsBlock;

interface Section {
  title: string;
  blocks: Block[];
}

/* --- CONTENIDO --- */
const SECTIONS: Section[] = [
  {
    title: "Identificación y aceptación",
    blocks: [
      { type: "p", text: "Los presentes Términos y Condiciones regulan el acceso y utilización de la plataforma Hidden Security, así como la contratación y utilización de los productos y servicios ofrecidos a través de ella." },
      { type: "p", text: `Hidden Security es operada por María Belén Arroyo, con domicilio en la Provincia de Buenos Aires, República Argentina, y correo electrónico de contacto ${CONTACT_EMAIL}.` },
      { type: "p", text: "Al registrarse, utilizar la plataforma o contratar alguno de sus servicios, el usuario declara haber leído y aceptado estos Términos y Condiciones y la Política de Privacidad." },
      { type: "p", text: "Cuando corresponda una relación de consumo, serán asimismo aplicables la Ley N.º 24.240, el Código Civil y Comercial de la Nación y demás normativa vigente de protección al consumidor." },
    ],
  },
  {
    title: "Requisitos para utilizar Hidden Security",
    blocks: [
      { type: "p", text: "La plataforma está destinada exclusivamente a personas de 18 años o más." },
      { type: "p", text: "Al crear una cuenta, el usuario declara que:" },
      {
        type: "list",
        items: [
          "Posee capacidad legal para utilizar y contratar los servicios.",
          "La información proporcionada es verdadera, completa y actualizada.",
          "Utilizará la plataforma de conformidad con estos Términos y la normativa aplicable.",
          "No utilizará cuentas de terceros ni permitirá el uso indebido de su propia cuenta.",
        ],
      },
      { type: "p", text: "Hidden Security podrá solicitar verificaciones razonables de identidad cuando resulte necesario para proteger la seguridad de la plataforma, administrar certificaciones, procesar operaciones o prevenir fraude." },
    ],
  },
  {
    title: "Cuenta de usuario",
    blocks: [
      { type: "p", text: "Cada cuenta es personal." },
      { type: "p", text: "El usuario es responsable de mantener la confidencialidad de sus credenciales y de las actividades realizadas mediante su cuenta." },
      { type: "p", text: "Hidden Security podrá restringir o suspender una cuenta cuando existan indicios razonables de fraude, suplantación de identidad, manipulación de evaluaciones, utilización abusiva de la plataforma, incumplimiento de estos Términos o riesgos para la seguridad." },
      { type: "p", text: "Cuando las circunstancias lo permitan, el usuario será informado de las medidas adoptadas." },
    ],
  },
  {
    title: "Servicios de Hidden Security",
    blocks: [
      { type: "p", text: "Hidden Security es una plataforma especializada en ciberseguridad que podrá ofrecer, entre otras funcionalidades:" },
      {
        type: "list",
        items: [
          "Cursos y contenidos de formación.",
          "Evaluaciones y certificaciones profesionales.",
          "Validación de habilidades.",
          "Perfiles profesionales estructurados.",
          "Acceso a oportunidades laborales.",
          "Herramientas de búsqueda y selección para empresas.",
          "Publicación de oportunidades laborales.",
          "Planes empresariales.",
          "Otros productos o servicios relacionados.",
        ],
      },
      { type: "p", text: "Las funcionalidades disponibles podrán variar de acuerdo con el plan, producto, tipo de cuenta o etapa de desarrollo de la plataforma." },
    ],
  },
  {
    title: "Cursos y contenidos educativos",
    blocks: [
      { type: "p", text: "Los cursos de Hidden Security tienen como finalidad brindar formación y preparación en determinadas áreas de ciberseguridad." },
      { type: "p", text: "La adquisición o finalización de un curso no implica automáticamente la obtención de una certificación profesional, salvo que la oferta del producto indique expresamente lo contrario." },
      { type: "p", text: "Cuando un plan incluya acceso a un curso por un período determinado, el acceso estará disponible durante la vigencia informada al momento de la compra." },
      { type: "p", text: "La finalización de determinados cursos podrá generar habilidades identificadas como validadas mediante formación de Hidden Security, cuando el contenido efectivamente impartido permita acreditar dicha formación." },
      { type: "p", text: "Esta validación no debe confundirse con una certificación obtenida mediante un examen independiente." },
    ],
  },
  {
    title: "Certificaciones",
    blocks: [
      { type: "p", text: "Las certificaciones de Hidden Security buscan validar conocimientos, habilidades y capacidad de análisis mediante evaluaciones diseñadas para cada dominio profesional." },
      { type: "p", text: "La compra de un examen o voucher otorga el derecho a realizar la evaluación correspondiente conforme a las condiciones vigentes para ese producto." },
      { type: "p", text: "La compra de un voucher no garantiza la aprobación del examen ni la obtención de una certificación." },
      { type: "p", text: "La certificación se otorgará únicamente cuando el candidato alcance los requisitos de aprobación establecidos para la evaluación correspondiente y cumpla las reglas de integridad aplicables." },
      { type: "p", text: "Los requisitos específicos —incluyendo duración, estructura, puntaje mínimo, cantidad de intentos y demás condiciones— serán informados antes de realizar la evaluación." },
    ],
  },
  {
    title: "Vigencia de las certificaciones",
    blocks: [
      { type: "p", text: "Salvo que se indique expresamente una vigencia diferente para determinada certificación, las certificaciones emitidas por Hidden Security tendrán una vigencia de dos (2) años desde su fecha de emisión." },
      { type: "p", text: "Una vez vencida, el perfil podrá indicar que la certificación ya no se encuentra vigente." },
      { type: "p", text: "Hidden Security podrá establecer mecanismos de renovación o recertificación, cuyas condiciones serán informadas cuando se encuentren disponibles." },
    ],
  },
  {
    title: "Intentos de examen y vouchers",
    blocks: [
      { type: "p", text: "Cada voucher de certificación habilita la cantidad de intentos indicada al momento de su adquisición." },
      { type: "p", text: "Cuando el producto contemple un (1) intento, la utilización del voucher para iniciar la evaluación consumirá dicho intento, sujeto a las excepciones que correspondan ante fallas técnicas verificables atribuibles a Hidden Security." },
      { type: "p", text: "Si el candidato no alcanza los requisitos de aprobación, deberá adquirir un nuevo intento o voucher, salvo que su plan incluya expresamente un beneficio de reintento." },
      { type: "p", text: "La vigencia del voucher será informada al momento de su compra." },
    ],
  },
  {
    title: "Integridad de las evaluaciones",
    blocks: [
      { type: "p", text: "Para preservar el valor de las certificaciones, los candidatos deberán cumplir las reglas de integridad establecidas para cada examen." },
      { type: "p", text: "Podrán considerarse incumplimientos, entre otros:" },
      {
        type: "list",
        items: [
          "Copiar o intentar extraer preguntas o contenido del examen.",
          "Compartir preguntas, respuestas o material confidencial de una evaluación.",
          "Recibir asistencia externa no autorizada.",
          "Utilizar herramientas, sistemas o recursos expresamente prohibidos.",
          "Permitir que otra persona realice una evaluación.",
          "Realizar la evaluación utilizando la identidad de otra persona.",
          "Manipular mecanismos técnicos o controles de seguridad.",
          "Intentar obtener acceso no autorizado al banco de preguntas o sistemas de evaluación.",
        ],
      },
      { type: "p", text: "Hidden Security podrá registrar eventos técnicos necesarios para detectar incumplimientos de estas reglas, de acuerdo con su Política de Privacidad." },
      { type: "p", text: "Cuando existan evidencias suficientes de una infracción, Hidden Security podrá invalidar el intento o la certificación correspondiente y aplicar restricciones a la cuenta, respetando los derechos que correspondan al usuario." },
    ],
  },
  {
    title: "Confidencialidad del contenido de los exámenes",
    blocks: [
      { type: "p", text: "Las preguntas, escenarios, imágenes, casos prácticos, bancos de preguntas y demás elementos utilizados en las evaluaciones constituyen contenido confidencial y/o protegido de Hidden Security o de sus respectivos titulares." },
      { type: "p", text: "La realización de un examen no otorga al candidato autorización para reproducir, publicar, vender, distribuir o compartir dicho contenido." },
      { type: "p", text: "Esta obligación continúa luego de finalizada la evaluación." },
    ],
  },
  {
    title: "Resultados",
    blocks: [
      { type: "p", text: "Los resultados podrán informarse mediante aprobación/no aprobación y podrán incluir información adicional sobre desempeño, áreas evaluadas, fortalezas o aspectos de mejora." },
      { type: "p", text: "Hidden Security no está obligada a revelar las respuestas correctas ni el contenido completo de las evaluaciones cuando hacerlo pudiera comprometer la integridad del sistema de certificación." },
      { type: "p", text: "En casos excepcionales de errores técnicos o administrativos verificables, Hidden Security podrá revisar el resultado de una evaluación." },
    ],
  },
  {
    title: "Perfil profesional y habilidades",
    blocks: [
      { type: "p", text: "Los usuarios podrán crear un perfil profesional que incluya información sobre experiencia, conocimientos, formación, certificaciones, idiomas y habilidades." },
      { type: "p", text: "Hidden Security podrá diferenciar entre distintos niveles de evidencia, por ejemplo:" },
      {
        type: "cards",
        items: [
          { name: "Habilidades declaradas", desc: "Informadas por el propio usuario en su perfil." },
          { name: "Habilidades respaldadas", desc: "Respaldadas mediante formación de Hidden Security." },
          { name: "Habilidades validadas", desc: "Validadas mediante certificaciones o evaluaciones." },
        ],
      },
      { type: "p", text: "La existencia de una habilidad en un perfil no deberá interpretarse como certificada por Hidden Security salvo que la plataforma la identifique expresamente como tal." },
    ],
  },
  {
    title: "Bolsa de empleo",
    blocks: [
      { type: "p", text: "Hidden Security podrá permitir que usuarios habilitados accedan a oportunidades laborales publicadas por empresas." },
      { type: "p", text: "Hidden Security funciona como plataforma de conexión entre profesionales y organizaciones y no constituye una agencia que garantice contratación o empleo." },
      { type: "p", text: "La certificación, participación en cursos, creación de un perfil o utilización de la plataforma no garantiza:" },
      {
        type: "list",
        items: [
          "Una entrevista.",
          "El ingreso a un proceso de selección.",
          "Una oferta laboral.",
          "Una contratación.",
          "Un determinado salario.",
          "Ningún otro resultado profesional.",
        ],
      },
      { type: "p", text: "Las decisiones de selección y contratación corresponden exclusivamente a las empresas y candidatos involucrados." },
    ],
  },
  {
    title: "Empresas",
    blocks: [
      { type: "p", text: "Las empresas con acceso habilitado podrán, según el plan contratado:" },
      {
        type: "list",
        items: [
          "Buscar perfiles profesionales.",
          "Utilizar filtros.",
          "Consultar habilidades y sus niveles de validación.",
          "Visualizar certificaciones.",
          "Publicar oportunidades laborales.",
          "Gestionar búsquedas.",
          "Utilizar otras funcionalidades empresariales disponibles.",
        ],
      },
      { type: "p", text: "Las empresas deberán utilizar la información de los candidatos exclusivamente para finalidades profesionales y de selección compatibles con las informadas por Hidden Security y la normativa aplicable." },
      { type: "p", text: "Queda prohibida la extracción masiva de información, creación de bases paralelas no autorizadas, comercialización de datos, utilización para publicidad no autorizada o cualquier tratamiento incompatible con la finalidad de la plataforma." },
    ],
  },
  {
    title: "Información proporcionada por las empresas",
    blocks: [
      { type: "p", text: "Las empresas son responsables de la información contenida en las oportunidades laborales que publiquen." },
      { type: "p", text: "No podrán publicar contenido falso, engañoso, discriminatorio, ilícito o que vulnere derechos de terceros." },
      { type: "p", text: "Hidden Security podrá moderar, suspender o eliminar publicaciones que incumplan estas reglas." },
    ],
  },
  {
    title: "Precios y contratación",
    blocks: [
      { type: "p", text: "Los precios y características aplicables serán aquellos informados al usuario antes de confirmar la compra." },
      { type: "p", text: "La plataforma podrá comercializar, entre otros:" },
      {
        type: "list",
        items: [
          "Acceso temporal a cursos.",
          "Vouchers de certificación.",
          "Paquetes que combinen formación y certificación.",
          "Planes empresariales.",
          "Otros servicios digitales.",
        ],
      },
      { type: "p", text: "Las promociones, descuentos y cupones podrán estar sujetos a condiciones particulares, fechas de vigencia y límites de utilización previamente informados." },
      { type: "p", text: "Hidden Security podrá modificar precios para contrataciones futuras, sin alterar retroactivamente las condiciones económicas de compras ya perfeccionadas." },
    ],
  },
  {
    title: "Pagos",
    blocks: [
      { type: "p", text: "Los pagos podrán procesarse mediante proveedores externos, inicialmente Mercado Pago." },
      { type: "p", text: "La disponibilidad de tarjetas, cuotas y demás medios de pago dependerá de las opciones habilitadas al momento de la operación." },
      { type: "p", text: "Hidden Security no almacena los datos completos de las tarjetas utilizadas para realizar pagos procesados por Mercado Pago." },
      { type: "p", text: "Podrá conservar los datos administrativos necesarios de la operación conforme a su Política de Privacidad." },
    ],
  },
  {
    title: "Facturación",
    blocks: [
      { type: "p", text: "Hidden Security emitirá los comprobantes fiscales correspondientes conforme a la normativa argentina aplicable y a los datos proporcionados por el cliente." },
      { type: "p", text: "El usuario es responsable de proporcionar información correcta para la emisión del comprobante." },
    ],
  },
  {
    title: "Derecho de arrepentimiento y cancelaciones",
    blocks: [
      { type: "p", text: "Cuando resulte aplicable la normativa argentina de defensa del consumidor, el usuario contará con el derecho de revocar una contratación realizada a distancia dentro del plazo legal correspondiente." },
      { type: "p", text: "La legislación argentina establece actualmente un plazo de diez (10) días corridos para el ejercicio del derecho de revocación en contrataciones a distancia, sujeto a las condiciones y excepciones previstas legalmente." },
      { type: "p", text: "Hidden Security implementará los mecanismos correspondientes para facilitar el ejercicio de este derecho y de la baja de servicios cuando resulte aplicable. La regulación vigente exige que los sitios que comercializan bienes o servicios a distancia cuenten con un “Botón de Arrepentimiento” visible y establece requisitos específicos para su utilización." },
      { type: "p", text: "Las condiciones particulares de cancelación, devolución o reembolso serán informadas de acuerdo con el producto adquirido y sin limitar derechos irrenunciables reconocidos por la legislación aplicable." },
    ],
  },
  {
    title: "Fallas técnicas durante evaluaciones",
    blocks: [
      { type: "p", text: "Si una evaluación se interrumpe debido a una falla técnica atribuible a Hidden Security que impida razonablemente su continuación, el usuario podrá reportar el incidente para su análisis." },
      { type: "p", text: "Cuando Hidden Security verifique la incidencia, podrá restablecer el intento, emitir un nuevo acceso o adoptar otra solución equivalente según corresponda." },
      { type: "p", text: "No se considerarán automáticamente fallas atribuibles a Hidden Security aquellas originadas exclusivamente en problemas de conectividad, hardware, software o entorno técnico del usuario." },
      { type: "p", text: "Cada caso podrá ser evaluado según sus circunstancias y evidencia disponible." },
    ],
  },
  {
    title: "Propiedad intelectual",
    blocks: [
      { type: "p", text: "La plataforma, identidad visual, marca, materiales educativos, contenidos, textos, diseños, metodologías, evaluaciones, bancos de preguntas, escenarios, recursos audiovisuales, software y demás elementos propios de Hidden Security se encuentran protegidos por las normas aplicables de propiedad intelectual." },
      { type: "p", text: "La adquisición de un producto otorga únicamente un derecho personal y limitado de utilización conforme a las condiciones del servicio." },
      { type: "p", text: "No se autoriza su reproducción, distribución, comercialización, publicación o explotación fuera de los usos expresamente permitidos." },
    ],
  },
  {
    title: "Uso prohibido",
    blocks: [
      { type: "p", text: "No se permite utilizar Hidden Security para:" },
      {
        type: "list",
        items: [
          "Cometer actividades ilícitas.",
          "Acceder sin autorización a sistemas o cuentas.",
          "Realizar fraude.",
          "Vulnerar controles de seguridad.",
          "Suplantar identidades.",
          "Recolectar masivamente información.",
          "Distribuir malware.",
          "Atacar la infraestructura.",
          "Manipular evaluaciones.",
          "Compartir contenido confidencial de exámenes.",
          "Acosar a otros usuarios.",
          "Utilizar la plataforma de forma contraria a su finalidad.",
        ],
      },
    ],
  },
  {
    title: "Disponibilidad de la plataforma",
    blocks: [
      { type: "p", text: "Hidden Security procurará mantener sus servicios disponibles y adoptar medidas razonables para asegurar su continuidad." },
      { type: "p", text: "Sin embargo, podrán existir interrupciones temporales por mantenimiento, actualizaciones, incidentes técnicos, proveedores externos u otras circunstancias." },
      { type: "p", text: "Cuando una interrupción afecte una prestación adquirida por un usuario, Hidden Security adoptará las medidas que correspondan conforme a las características del servicio y la normativa aplicable." },
    ],
  },
  {
    title: "Responsabilidad",
    blocks: [
      { type: "p", text: "Hidden Security será responsable por sus obligaciones conforme a la legislación aplicable." },
      { type: "p", text: "La plataforma no controla ni garantiza las decisiones independientes adoptadas por empresas, candidatos u otros terceros que interactúen mediante sus servicios." },
      { type: "p", text: "Nada de lo establecido en estos Términos deberá interpretarse como una renuncia o limitación de derechos que la legislación argentina reconozca con carácter irrenunciable a consumidores o usuarios. La Ley 24.240 establece que las cláusulas que restrinjan derechos del consumidor o desnaturalicen obligaciones pueden tenerse por no convenidas." },
    ],
  },
  {
    title: "Suspensión y cancelación",
    blocks: [
      { type: "p", text: "Hidden Security podrá suspender o cancelar cuentas ante incumplimientos graves o reiterados de estos Términos, fraude, manipulación de evaluaciones, ataques a la plataforma, utilización ilícita o riesgos relevantes para la seguridad." },
      { type: "p", text: "La medida deberá guardar relación razonable con el incumplimiento detectado." },
      { type: "p", text: "La suspensión o cancelación no afectará los derechos legales que correspondan al usuario respecto de servicios adquiridos." },
    ],
  },
  {
    title: "Modificaciones",
    blocks: [
      { type: "p", text: "Hidden Security podrá actualizar estos Términos para reflejar modificaciones en sus servicios, funcionalidades, modelo operativo o normativa aplicable." },
      { type: "p", text: "Los cambios relevantes serán comunicados por medios razonables y no se aplicarán retroactivamente cuando ello afecte derechos adquiridos, salvo cuando resulte necesario por una obligación legal." },
    ],
  },
  {
    title: "Legislación aplicable",
    blocks: [
      { type: "p", text: "Estos Términos se regirán por las leyes de la República Argentina." },
      { type: "p", text: "Cuando exista una relación de consumo, serán aplicables las normas protectorias y reglas de competencia jurisdiccional que correspondan, sin que estos Términos impliquen una renuncia a derechos legalmente reconocidos al consumidor." },
    ],
  },
  {
    title: "Contacto",
    blocks: [
      { type: "p", text: "Para consultas relacionadas con estos Términos y Condiciones podés escribirnos a los datos que figuran a continuación." },
    ],
  },
];

const pad = (n: number): string => String(n).padStart(2, "0");

const renderBlock = (block: Block, key: number) => {
  switch (block.type) {
    case "p":
      return <p key={key} className="tc-section-text">{block.text}</p>;

    case "list":
      return (
        <ul key={key} className="tc-bullets">
          {block.items.map((item, j) => (
            <li key={j} className="tc-bullet">{item}</li>
          ))}
        </ul>
      );

    case "cards":
      return (
        <ul key={key} className="tc-list">
          {block.items.map((item, j) => (
            <li key={j} className="tc-list-item">
              <span className="tc-list-name">{item.name}</span>
              <span className="tc-list-desc">{item.desc}</span>
            </li>
          ))}
        </ul>
      );

    default:
      return null;
  }
};

const TerminosCondiciones = () => {
  const { theme } = UseTheme();

  return (
    <section className={`tc-wrapper ${theme}`}>
      <div className="tc-container">

        {/* encabezado */}
        <div className="tc-header">
          <span className="tc-eyebrow">Legal</span>
          <h1 className="tc-title">
            Términos y<br />
            <span className="tc-title-accent">Condiciones</span>
          </h1>
          <p className="tc-intro">
            Estas condiciones regulan el uso de <strong>Hidden Security</strong>: la plataforma,
            los cursos, las certificaciones, la bolsa de empleo y los servicios para empresas.
            Te pedimos que las leas antes de registrarte o contratar cualquiera de nuestros productos.
          </p>
          <div className="tc-meta">
            <span>Última actualización: {LAST_UPDATE}</span>
            <span className="tc-meta-dot">·</span>
            <span>Ley N° 24.240</span>
          </div>
        </div>

        {/* índice */}
        <nav className="tc-index" aria-label="Índice de secciones">
          <span className="tc-index-title">Índice</span>
          <ol className="tc-index-list">
            {SECTIONS.map((sec, i) => (
              <li key={i}>
                <a href={`#tc-${i + 1}`} className="tc-index-link">
                  <span className="tc-index-num">{pad(i + 1)}</span>
                  {sec.title}
                </a>
              </li>
            ))}
          </ol>
        </nav>

        {/* secciones */}
        <div className="tc-body">
          {SECTIONS.map((sec, i) => (
            <article key={i} id={`tc-${i + 1}`} className="tc-section">
              <h2 className="tc-section-title">
                <span className="tc-section-bar" />
                <span className="tc-section-num">{pad(i + 1)}</span>
                {sec.title}
              </h2>
              <div className="tc-section-content">
                {sec.blocks.map((block, j) => renderBlock(block, j))}
              </div>
            </article>
          ))}
        </div>

        {/* contacto */}
        <div className="tc-contact">
          <p className="tc-contact-name">Hidden Security · María Belén Arroyo</p>
          <p>
            ¿Tenés dudas sobre estos términos?{" "}
            <a href={`mailto:${CONTACT_EMAIL}`} className="tc-contact-link">{CONTACT_EMAIL}</a>
          </p>
        </div>

      </div>
    </section>
  );
};

export default TerminosCondiciones;