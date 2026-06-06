import type { InternalCompanyListType } from "@/types";

// ---------------------------------------------------------------------------
// Email templates: hotel (alojamiento) vs empresa, in Catalan or Spanish,
// for first contact and follow-up. Section headings are marked with a leading
// "## " so they can render as plain text (Gmail compose link) or bold (HTML).
// ---------------------------------------------------------------------------

export type OutreachLang = "ca" | "es";
export type OutreachTemplateKind = "first" | "follow_up";
export type OutreachAttachment = "hoteles" | "empresas";

export interface OutreachTemplate {
  listType: InternalCompanyListType;
  lang: OutreachLang;
  kind: OutreachTemplateKind;
  subject: string;
  body: string;
  attachment: OutreachAttachment | null;
}

export interface TemplateContext {
  companyName: string;
}

/**
 * PDF attachments, kept in /docs. `fileName` is the real file on disk (read
 * server-side when sending); `asciiName` is used as the MIME attachment name to
 * avoid header-encoding issues; `label` is shown in the UI.
 */
export const PDF_FILES: Record<OutreachAttachment, { fileName: string; asciiName: string; label: string }> = {
  hoteles: { fileName: "¿Qué es Attendi - Hoteles.pdf", asciiName: "Attendi-Hoteles.pdf", label: "¿Qué es Attendi - Hoteles.pdf" },
  empresas: { fileName: "Attendi_para_empresas (1).pdf", asciiName: "Attendi-para-empresas.pdf", label: "Attendi para empresas.pdf" }
};

export const LANG_LABEL: Record<OutreachLang, string> = { ca: "Català", es: "Castellano" };
export const KIND_LABEL: Record<OutreachTemplateKind, string> = { first: "Primer contacto", follow_up: "Seguimiento" };

const CALENDLY = "https://calendly.com/attendi-rent-app/30min";

const HOTEL_SUBJECT_CA = "Attendi - Catàleg d’activitats i serveis locals per als vostres hostes";
const HOTEL_SUBJECT_ES = "Attendi - Catálogo de actividades y servicios locales para vuestros huéspedes";
const EMPRESA_SUBJECT = "Attendi";

const HOTEL_FIRST_CA = `Hola,

Soc en Martí, d’Attendi, una plataforma que connecta hotels, càmpings, apartaments turístics i altres allotjaments amb empreses locals d’activitats, experiències, serveis i lloguers.

Acabem de parlar per telèfon i m’heu comentat que us enviés més informació sobre la plataforma, així que us explico breument la idea i us adjunto un PDF.

## Què és Attendi?

Attendi és una plataforma pensada perquè els allotjaments puguin oferir als seus hostes una selecció d’activitats, experiències i serveis locals des d’un únic espai digital.

La idea és que el client pugui descobrir, reservar i pagar fàcilment activitats properes, serveis de l’allotjament o experiències recomanades, ja sigui des de recepció o directament des del seu mòbil.

Per al vostre hotel, Attendi pot funcionar com una eina per millorar l’experiència del client, generar ingressos addicionals i tenir més control sobre les recomanacions i serveis que oferiu als hostes.

## Com funciona?

Cada hotel o allotjament té el seu propi perfil dins d’Attendi. Des d’aquest perfil, l’hoste pot accedir a diferents seccions: serveis propis de l’hotel, activitats properes, experiències locals, lloguers, excursions o altres serveis complementaris.

Per exemple, un hoste podria veure activitats d’aventura, visites guiades, lloguer de bicicletes, transport, experiències gastronòmiques o qualsevol altre servei disponible a la zona.

Des de la plataforma, el client pot consultar imatges, preus, horaris, disponibilitat, ubicació en un mapa interactiu i fer la reserva directament.

## El que proposem

Ens agradaria comptar amb el vostre hotel dins de la xarxa d’allotjaments d’Attendi.

La idea és que pugueu oferir als vostres hostes una eina senzilla i visual per descobrir activitats i serveis durant la seva estada, sense haver de gestionar-ho tot manualment des de recepció.

A més, Attendi us permetria tenir un canal digital propi on centralitzar tant els serveis de l’hotel com les activitats d’empreses locals col·laboradores.

D’aquesta manera, el vostre hotel pot oferir una experiència més completa al client i, alhora, generar una nova via d’ingressos a través de les reserves que es facin des del vostre perfil.

## Condicions

No hi ha quota mensual ni cost fix per formar part de la plataforma.

Attendi només aplica una comissió quan es realitza una reserva a través del perfil del vostre allotjament. Aquesta comissió es reparteix entre l’hotel i Attendi.

Això permet que l’hotel pugui obtenir ingressos addicionals per recomanar activitats i serveis locals, sense haver d’assumir cap cost inicial ni risc econòmic.

També us ajudem a configurar el vostre perfil, pujar la informació inicial i connectar-vos amb empreses locals de la zona.

## Panell i estadístiques

Des del vostre panell podreu veure informació útil com ara quines activitats reserven més els vostres hostes, quins serveis tenen més demanda, el volum de reserves generades, els ingressos obtinguts i altres dades que us ajudin a entendre millor els interessos dels vostres clients.

Aquesta informació també pot ajudar-vos a millorar l’experiència del client i a prendre millors decisions sobre quins serveis o activitats promocionar.

## Avantatges per al vostre hotel

Attendi us permet oferir una experiència més moderna, digital i personalitzada als vostres hostes.

També ajuda a reduir la dependència de recomanacions manuals des de recepció, facilita la connexió amb empreses locals i us permet participar en els ingressos generats per activitats i serveis reservats pels vostres clients.

A diferència d’altres plataformes, Attendi està pensada per donar protagonisme al vincle entre l’allotjament, el client final i les empreses locals de la zona.

Si us encaixa, estarem encantats d’agendar una breu videotrucada per ensenyar-vos com funciona la plataforma i veure com podríem adaptar-la al vostre hotel.

Si voleu, podeu triar en aquest enllaç l'hora que us aniria millor per fer una demo: ${CALENDLY}

I si teniu qualsevol pregunta, no dubteu a contactar-me.

Una salutació,
Martí

616965738`;

const HOTEL_FIRST_ES = `Hola,

Soy Martí, de Attendi, una plataforma que conecta hoteles, campings, apartamentos turísticos y otros alojamientos con empresas locales de actividades, experiencias, servicios y alquileres.

Acabamos de hablar por teléfono y me habéis comentado que os enviara más información sobre la plataforma, así que os explico brevemente la idea y os adjunto un PDF.

## ¿Qué es Attendi?

Attendi es una plataforma pensada para que los alojamientos puedan ofrecer a sus huéspedes una selección de actividades, experiencias y servicios locales desde un único espacio digital.

La idea es que el cliente pueda descubrir, reservar y pagar fácilmente actividades cercanas, servicios del alojamiento o experiencias recomendadas, ya sea desde recepción o directamente desde su móvil.

Para vuestro hotel, Attendi puede funcionar como una herramienta para mejorar la experiencia del cliente, generar ingresos adicionales y tener más control sobre las recomendaciones y servicios que ofrecéis a los huéspedes.

## ¿Cómo funciona?

Cada hotel o alojamiento tiene su propio perfil dentro de Attendi. Desde este perfil, el huésped puede acceder a diferentes secciones: servicios propios del hotel, actividades cercanas, experiencias locales, alquileres, excursiones u otros servicios complementarios.

Por ejemplo, un huésped podría ver actividades de aventura, visitas guiadas, alquiler de bicicletas, transporte, experiencias gastronómicas o cualquier otro servicio disponible en la zona.

Desde la plataforma, el cliente puede consultar imágenes, precios, horarios, disponibilidad, ubicación en un mapa interactivo y hacer la reserva directamente.

## Lo que proponemos

Nos gustaría contar con vuestro hotel dentro de la red de alojamientos de Attendi.

La idea es que podáis ofrecer a vuestros huéspedes una herramienta sencilla y visual para descubrir actividades y servicios durante su estancia, sin tener que gestionarlo todo manualmente desde recepción.

Además, Attendi os permitiría tener un canal digital propio donde centralizar tanto los servicios del hotel como las actividades de empresas locales colaboradoras.

De esta manera, vuestro hotel puede ofrecer una experiencia más completa al cliente y, al mismo tiempo, generar una nueva vía de ingresos a través de las reservas que se hagan desde vuestro perfil.

## Condiciones

No hay cuota mensual ni coste fijo por formar parte de la plataforma.

Attendi solo aplica una comisión cuando se realiza una reserva a través del perfil de vuestro alojamiento. Esta comisión se reparte entre el hotel y Attendi.

Esto permite que el hotel pueda obtener ingresos adicionales por recomendar actividades y servicios locales, sin tener que asumir ningún coste inicial ni riesgo económico.

También os ayudamos a configurar vuestro perfil, subir la información inicial y conectaros con empresas locales de la zona.

## Panel y estadísticas

Desde vuestro panel podréis ver información útil como qué actividades reservan más vuestros huéspedes, qué servicios tienen más demanda, el volumen de reservas generadas, los ingresos obtenidos y otros datos que os ayuden a entender mejor los intereses de vuestros clientes.

Esta información también puede ayudaros a mejorar la experiencia del cliente y a tomar mejores decisiones sobre qué servicios o actividades promocionar.

## Ventajas para vuestro hotel

Attendi os permite ofrecer una experiencia más moderna, digital y personalizada a vuestros huéspedes.

También ayuda a reducir la dependencia de recomendaciones manuales desde recepción, facilita la conexión con empresas locales y os permite participar en los ingresos generados por actividades y servicios reservados por vuestros clientes.

A diferencia de otras plataformas, Attendi está pensada para dar protagonismo al vínculo entre el alojamiento, el cliente final y las empresas locales de la zona.

Si os encaja, estaremos encantados de agendar una breve videollamada para enseñaros cómo funciona la plataforma y ver cómo podríamos adaptarla a vuestro hotel.

Y si tenéis cualquier pregunta, no dudéis en contactarme.

Si quereis, podeis elegir en este enlace la hora que mejor os iría para hacer la demo: ${CALENDLY}

Un saludo,

Martí

616965738`;

const EMPRESA_FIRST_ES = `Hola,

Soy Martí, de Attendi, la plataforma que conecta hoteles y alojamientos turísticos del Maresme y la Costa Brava con empresas locales de actividades, experiencias y alquileres.

Acabamos de hablar por teléfono y me has comentado que te enviara más información sobre la plataforma, así que te explico brevemente la idea y te adjunto un PDF.

## ¿Qué es Attendi?

Attendi es una plataforma que conecta empresas de actividades y experiencias locales con hoteles, campings, apartamentos turísticos y otros alojamientos. La idea es que los huéspedes puedan descubrir, reservar y pagar fácilmente actividades cercanas desde la recepción del alojamiento o directamente desde su móvil.

En vuestro caso, creemos que {{company}} encaja muy bien en la plataforma por el tipo de actividades y experiencias que ofrecéis.

## ¿Cómo funciona?

Attendi funciona como una web y una app donde cada hotel o alojamiento tiene su propio perfil. Desde ese perfil, el huésped puede ver los servicios propios del alojamiento y también una sección con actividades y experiencias cercanas.

Ahí es donde apareceríais vosotros. El cliente podría ver vuestras actividades con imágenes, precios, descripciones, horarios, disponibilidad y ubicación en un mapa interactivo. Desde ahí podría elegir la actividad que le interese y hacer la reserva directamente desde la plataforma.

## Lo que proponemos

Nos gustaría contar con {{company}} como proveedor dentro de la plataforma. La idea es acercaros a clientes que ya están alojados en hoteles, campings y apartamentos turísticos de la zona y que buscan actividades para hacer durante su estancia.

Attendi os daría visibilidad dentro de esta red de alojamientos y os conectaría con huéspedes que ya están en destino y tienen intención de consumir experiencias locales.

Además, dentro de la plataforma podríais definir horarios, disponibilidad, precios y condiciones de reserva de forma sencilla, adaptándolo a vuestra operativa.

## Condiciones

No hay tarifa mensual ni coste fijo. Si no entra ninguna reserva, no pagáis nada.

Solo aplicamos una comisión del 10% cuando se realiza una reserva a través de la plataforma. Esta comisión se reparte entre el hotel o alojamiento de donde viene el huésped y Attendi, cubriendo el mantenimiento de la plataforma, soporte, atención al cliente y adquisición de usuarios a través de la red hotelera.

También os ayudamos a crear vuestro perfil y subir las actividades inicialmente.

## Dashboard y estadísticas

Desde vuestro panel podréis ver información útil como de qué hoteles os llegan los clientes, qué actividades funcionan mejor, el volumen de reservas, horarios con más demanda y otros datos que os ayuden a optimizar la colaboración con los alojamientos.

## Ventajas frente a otros canales

Nuestra comisión es inferior a la de intermediarios como GetYourGuide, Tripadvisor o plataformas similares. Además, Attendi mantiene una relación más directa entre la empresa local, el cliente final y los hoteles colaboradores de la zona.

Si os encaja, estaremos encantados de agendar una breve videollamada para enseñaros cómo funciona la plataforma y ayudaros a crear el perfil de {{company}}.

Y si tenéis cualquier pregunta, no dudéis en contactarme.

Un saludo,
Martí`;

const EMPRESA_FIRST_CA = `Hola,

Soc en Martí, d'Attendi, la plataforma que connecta hotels i allotjaments turístics del Maresme i la Costa Brava amb empreses locals d'activitats, experiències i lloguers.

Acabem de parlar per telèfon i m'has comentat que t'enviés més informació sobre la plataforma, així que t'explico breument la idea i t'adjunto un PDF.

## Què és Attendi?

Attendi és una plataforma que connecta empreses d'activitats i experiències locals amb hotels, càmpings, apartaments turístics i altres allotjaments. La idea és que els hostes puguin descobrir, reservar i pagar fàcilment activitats properes des de la recepció de l'allotjament o directament des del seu mòbil.

En el vostre cas, creiem que {{company}} encaixa molt bé a la plataforma pel tipus d'activitats i experiències que oferiu.

## Com funciona?

Attendi funciona com una web i una app on cada hotel o allotjament té el seu propi perfil. Des d'aquest perfil, l'hoste pot veure els serveis propis de l'allotjament i també una secció amb activitats i experiències properes.

Aquí és on apareixeríeu vosaltres. El client podria veure les vostres activitats amb imatges, preus, descripcions, horaris, disponibilitat i ubicació en un mapa interactiu. Des d'allà podria triar l'activitat que li interessi i fer la reserva directament des de la plataforma.

## El que proposem

Ens agradaria comptar amb {{company}} com a proveïdor dins de la plataforma. La idea és acostar-vos a clients que ja estan allotjats en hotels, càmpings i apartaments turístics de la zona i que busquen activitats per fer durant la seva estada.

Attendi us donaria visibilitat dins d'aquesta xarxa d'allotjaments i us connectaria amb hostes que ja són a destí i tenen intenció de consumir experiències locals.

A més, dins de la plataforma podríeu definir horaris, disponibilitat, preus i condicions de reserva de manera senzilla, adaptant-ho a la vostra operativa.

## Condicions

No hi ha tarifa mensual ni cost fix. Si no entra cap reserva, no pagueu res.

Només apliquem una comissió del 10% quan es realitza una reserva a través de la plataforma. Aquesta comissió es reparteix entre l'hotel o allotjament d'on ve l'hoste i Attendi, cobrint el manteniment de la plataforma, suport, atenció al client i adquisició d'usuaris a través de la xarxa hotelera.

També us ajudem a crear el vostre perfil i pujar les activitats inicialment.

## Dashboard i estadístiques

Des del vostre panell podreu veure informació útil com ara de quins hotels us arriben els clients, quines activitats funcionen millor, el volum de reserves, horaris amb més demanda i altres dades que us ajudin a optimitzar la col·laboració amb els allotjaments.

## Avantatges respecte a altres canals

La nostra comissió és inferior a la d'intermediaris com GetYourGuide, Tripadvisor o plataformes similars. A més, Attendi manté una relació més directa entre l'empresa local, el client final i els hotels col·laboradors de la zona.

Si us encaixa, estarem encantats d'agendar una breu videotrucada per ensenyar-vos com funciona la plataforma i ajudar-vos a crear el perfil de {{company}}.

I si teniu qualsevol pregunta, no dubteu a contactar-me.

Una salutació,
Martí`;

const HOTEL_FOLLOWUP_CA = `Hola bones,

Us escric per recuperar el correu anterior sobre Attendi. Heu pogut fer-hi un cop d'ull?

Creiem que encaixaria molt bé amb el vostre hotel per oferir als hostes activitats i serveis locals sense feina extra des de recepció.

Si us encaixa, podeu triar aquí el dia i l'hora que us vagi millor per fer una breu demo: ${CALENDLY}

Quedo atent a qualsevol dubte.

Una salutació,
Martí

616965738`;

const HOTEL_FOLLOWUP_ES = `Hola,

Os escribo para retomar el correo anterior sobre Attendi. ¿Habéis podido echarle un vistazo?

Creemos que encajaría muy bien con vuestro hotel para ofrecer a los huéspedes actividades y servicios locales sin trabajo extra desde recepción.

Si os encaja, podéis elegir aquí el día y la hora que mejor os vaya para una breve demo: ${CALENDLY}

Quedo atento a cualquier duda.

Un saludo,
Martí

616965738`;

const EMPRESA_FOLLOWUP_CA = `Hola,

T'escric per recuperar el correu anterior sobre Attendi. Has pogut fer-hi un cop d'ull?

Creiem que {{company}} encaixaria molt bé a la plataforma per arribar a hostes que ja estan allotjats a la zona i busquen activitats durant la seva estada.

Si t'encaixa, pots triar aquí el dia i l'hora que et vagi millor per fer una breu demo: ${CALENDLY}

Quedo atent a qualsevol dubte.

Una salutació,
Martí`;

const EMPRESA_FOLLOWUP_ES = `Hola,

Te escribo para retomar el correo anterior sobre Attendi. ¿Has podido echarle un vistazo?

Creemos que {{company}} encajaría muy bien en la plataforma para llegar a huéspedes que ya están alojados en la zona y buscan actividades durante su estancia.

Si te encaja, puedes elegir aquí el día y la hora que mejor te vaya para una breve demo: ${CALENDLY}

Quedo atento a cualquier duda.

Un saludo,
Martí`;

const TEMPLATES: OutreachTemplate[] = [
  { listType: "alojamiento", lang: "ca", kind: "first", subject: HOTEL_SUBJECT_CA, body: HOTEL_FIRST_CA, attachment: "hoteles" },
  { listType: "alojamiento", lang: "es", kind: "first", subject: HOTEL_SUBJECT_ES, body: HOTEL_FIRST_ES, attachment: "hoteles" },
  { listType: "alojamiento", lang: "ca", kind: "follow_up", subject: HOTEL_SUBJECT_CA, body: HOTEL_FOLLOWUP_CA, attachment: null },
  { listType: "alojamiento", lang: "es", kind: "follow_up", subject: HOTEL_SUBJECT_ES, body: HOTEL_FOLLOWUP_ES, attachment: null },
  { listType: "empresa", lang: "ca", kind: "first", subject: EMPRESA_SUBJECT, body: EMPRESA_FIRST_CA, attachment: "empresas" },
  { listType: "empresa", lang: "es", kind: "first", subject: EMPRESA_SUBJECT, body: EMPRESA_FIRST_ES, attachment: "empresas" },
  { listType: "empresa", lang: "ca", kind: "follow_up", subject: EMPRESA_SUBJECT, body: EMPRESA_FOLLOWUP_CA, attachment: null },
  { listType: "empresa", lang: "es", kind: "follow_up", subject: EMPRESA_SUBJECT, body: EMPRESA_FOLLOWUP_ES, attachment: null }
];

export function findTemplate(listType: InternalCompanyListType, lang: OutreachLang, kind: OutreachTemplateKind): OutreachTemplate {
  return (
    TEMPLATES.find((template) => template.listType === listType && template.lang === lang && template.kind === kind) ?? TEMPLATES[0]
  );
}

function substitute(text: string, ctx: TemplateContext, lang: OutreachLang) {
  const fallback = lang === "ca" ? "la vostra empresa" : "vuestra empresa";
  return text.replaceAll("{{company}}", ctx.companyName.trim() || fallback);
}

export function renderSubject(template: OutreachTemplate, ctx: TemplateContext) {
  return substitute(template.subject, ctx, template.lang);
}

/** Plain-text body (headings kept as plain lines). For Gmail compose links. */
export function renderPlain(template: OutreachTemplate, ctx: TemplateContext) {
  return substitute(template.body, ctx, template.lang)
    .split("\n")
    .map((line) => (line.startsWith("## ") ? line.slice(3) : line))
    .join("\n")
    .trim();
}

function escapeHtml(value: string) {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function linkify(value: string) {
  return value.replace(/(https?:\/\/[^\s]+)/g, '<a href="$1">$1</a>');
}

function wrapHtml(inner: string) {
  return `<div style="font-family:Arial,Helvetica,sans-serif;font-size:14px;color:#111;line-height:1.5;">${inner}</div>`;
}

/** HTML body with bold headings. For server-side (Gmail API / Resend) sending. */
export function renderHtml(template: OutreachTemplate, ctx: TemplateContext) {
  const text = substitute(template.body, ctx, template.lang).trim();
  const blocks = text.split(/\n{2,}/).map((block) => {
    const lines = block.split("\n");
    if (lines.length === 1 && lines[0].startsWith("## ")) {
      return `<p style="margin:18px 0 6px;font-weight:bold;">${escapeHtml(lines[0].slice(3))}</p>`;
    }
    const inner = lines.map((line) => linkify(escapeHtml(line.startsWith("## ") ? line.slice(3) : line))).join("<br>");
    return `<p style="margin:0 0 12px;">${inner}</p>`;
  });
  return wrapHtml(blocks.join("\n"));
}

/** Heading lines of a template (without the "## " marker), used to re-bold edited bodies. */
export function templateHeadings(template: OutreachTemplate): string[] {
  return template.body
    .split("\n")
    .filter((line) => line.startsWith("## "))
    .map((line) => line.slice(3).trim());
}

/**
 * Converts a (possibly user-edited) plain-text body to HTML, bolding any line
 * that matches a known section heading. Used when sending the edited draft.
 */
export function htmlFromPlain(plain: string, headingLines: string[]) {
  const headings = new Set(headingLines.map((heading) => heading.trim()));
  const blocks = plain
    .trim()
    .split(/\n{2,}/)
    .map((block) => {
      const lines = block.split("\n");
      if (lines.length === 1 && headings.has(lines[0].trim())) {
        return `<p style="margin:18px 0 6px;font-weight:bold;">${escapeHtml(lines[0])}</p>`;
      }
      const inner = lines.map((line) => linkify(escapeHtml(line))).join("<br>");
      return `<p style="margin:0 0 12px;">${inner}</p>`;
    });
  return wrapHtml(blocks.join("\n"));
}
