// "Añadir a mi agenda": para cada próximo acto se genera
//   - un archivo .ics propio (public/actos/<fecha>-<nombre>.ics), que el
//     iPhone abre directamente con "Añadir al calendario" y que en Android
//     abre la app de calendario;
//   - un enlace a Google Calendar con el evento ya relleno (lo más cómodo
//     en Android);
// y además un calendario completo (public/agenda.ics) al que uno puede
// suscribirse una sola vez para recibir todos los actos automáticamente.
//
// Las horas se escriben en UTC (terminadas en "Z"): así cada móvil las
// muestra en su hora local sin desfases de horario de verano.

export const URL_SITIO = "https://tablon-diaconos-sevilla.github.io";
export const NOMBRE_CALENDARIO = "Tablón – Comunidad Diaconal de Sevilla";
const ZONA = "Europe/Madrid";
const DURACION_POR_DEFECTO_MS = 60 * 60 * 1000; // 1 hora

// ---------- Fechas ----------

function aFecha(iso) {
  if (!iso) return null;
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? null : d;
}

// 2026-10-01T08:00:00.000Z -> 20261001T080000Z
function formatoUtc(d) {
  return d.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
}

// Día en hora de Madrid, formato 20261001 (para actos de todo el día).
function formatoDiaMadrid(d) {
  return d.toLocaleDateString("sv-SE", { timeZone: ZONA }).replace(/-/g, "");
}

function esMedianocheMadrid(d) {
  return d.toLocaleTimeString("es-ES", { timeZone: ZONA, hour: "2-digit", minute: "2-digit" }) === "00:00";
}

function diaSiguiente(yyyymmdd) {
  const d = new Date(
    Date.UTC(+yyyymmdd.slice(0, 4), +yyyymmdd.slice(4, 6) - 1, +yyyymmdd.slice(6, 8) + 1)
  );
  return d.toISOString().slice(0, 10).replace(/-/g, "");
}

// Devuelve { todoElDia, inicio, fin } ya formateados, o null si el acto no
// tiene fecha reconocible (entonces no se ofrece el botón).
function tramoDelActo(acto) {
  const inicio = aFecha(acto.fecha);
  if (!inicio) return null;

  // Actos de todo el día: marcados así por la agenda, o que empiezan a las
  // 00:00 en Madrid (así publica archisevilla los actos sin hora concreta).
  if (acto.todoElDia || esMedianocheMadrid(inicio)) {
    const diaInicio = formatoDiaMadrid(inicio);
    const finReal = aFecha(acto.fechaFin);
    const diaFin = finReal ? formatoDiaMadrid(finReal) : diaInicio;
    // En iCalendar el día final de un acto "todo el día" es exclusivo.
    return {
      todoElDia: true,
      inicio: diaInicio,
      fin: diaSiguiente(diaFin < diaInicio ? diaInicio : diaFin),
    };
  }

  let fin = aFecha(acto.fechaFin);
  if (!fin || fin <= inicio) fin = new Date(inicio.getTime() + DURACION_POR_DEFECTO_MS);
  return { todoElDia: false, inicio: formatoUtc(inicio), fin: formatoUtc(fin) };
}

// ---------- Nombres de archivo ----------

function nombreBase(acto) {
  const inicio = aFecha(acto.fecha);
  const dia = inicio ? inicio.toLocaleDateString("sv-SE", { timeZone: ZONA }) : "sin-fecha";
  let slug = "";
  try {
    const partes = new URL(acto.url).pathname.split("/").filter(Boolean);
    slug = partes[partes.length - 1] || "";
    if (!slug) slug = acto.titulo || "";
  } catch {
    slug = acto.titulo || "";
  }
  slug = slug
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
  return `${dia}-${slug || "acto"}`;
}

// Asigna un nombre de archivo único a cada acto (por si dos coinciden).
export function asignarArchivosIcs(actos) {
  const usados = new Set();
  return actos.map((acto) => {
    if (!tramoDelActo(acto)) return { ...acto, archivoIcs: null };
    const base = nombreBase(acto);
    let nombre = base;
    for (let n = 2; usados.has(nombre); n++) nombre = `${base}-${n}`;
    usados.add(nombre);
    return { ...acto, archivoIcs: `actos/${nombre}.ics` };
  });
}

// ---------- iCalendar (.ics) ----------

function escaparIcs(texto = "") {
  return String(texto)
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\r?\n/g, "\\n");
}

// Las líneas de un .ics no deben pasar de 75 bytes: se parten con
// salto + espacio, sin cortar caracteres acentuados por la mitad.
function plegarLinea(linea) {
  const bytes = (s) => Buffer.byteLength(s, "utf8");
  if (bytes(linea) <= 75) return linea;
  const trozos = [];
  let actual = "";
  let limite = 75;
  for (const car of linea) {
    if (bytes(actual + car) > limite) {
      trozos.push(actual);
      actual = car;
      limite = 74; // las líneas de continuación empiezan con un espacio
    } else {
      actual += car;
    }
  }
  if (actual) trozos.push(actual);
  return trozos.join("\r\n ");
}

function uidDelActo(acto) {
  return `${nombreBase(acto)}@tablon-diaconos-sevilla.github.io`;
}

function lineasEvento(acto, sello) {
  const tramo = tramoDelActo(acto);
  if (!tramo) return [];
  const descripcion = [
    "Más información:",
    acto.url,
    "",
    `Publicado en el Tablón de la Comunidad Diaconal de Sevilla (${URL_SITIO}).`,
  ].join("\n");

  const lineas = [
    "BEGIN:VEVENT",
    `UID:${uidDelActo(acto)}`,
    `DTSTAMP:${sello}`,
    tramo.todoElDia ? `DTSTART;VALUE=DATE:${tramo.inicio}` : `DTSTART:${tramo.inicio}`,
    tramo.todoElDia ? `DTEND;VALUE=DATE:${tramo.fin}` : `DTEND:${tramo.fin}`,
    `SUMMARY:${escaparIcs(acto.titulo)}`,
  ];
  if (acto.lugar) lineas.push(`LOCATION:${escaparIcs(acto.lugar)}`);
  lineas.push(`DESCRIPTION:${escaparIcs(descripcion)}`);
  if (acto.url) lineas.push(`URL:${acto.url}`);
  lineas.push("END:VEVENT");
  return lineas;
}

function envolverCalendario(lineasEventos, { suscripcion = false } = {}) {
  const cabecera = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Tablon Comunidad Diaconal Sevilla//ES",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
  ];
  if (suscripcion) {
    cabecera.push(
      `X-WR-CALNAME:${escaparIcs(NOMBRE_CALENDARIO)}`,
      `X-WR-TIMEZONE:${ZONA}`,
      "REFRESH-INTERVAL;VALUE=DURATION:PT6H",
      "X-PUBLISHED-TTL:PT6H"
    );
  }
  return [...cabecera, ...lineasEventos, "END:VCALENDAR"].map(plegarLinea).join("\r\n") + "\r\n";
}

// .ics de un solo acto (botón "Añadir a mi agenda").
export function generarIcsActo(acto, ahora = new Date()) {
  return envolverCalendario(lineasEvento(acto, formatoUtc(ahora)));
}

// .ics con todos los próximos actos (calendario suscribible).
export function generarIcsSuscripcion(actos, ahora = new Date()) {
  const sello = formatoUtc(ahora);
  return envolverCalendario(
    actos.flatMap((a) => lineasEvento(a, sello)),
    { suscripcion: true }
  );
}

// ---------- Google Calendar ----------

export function enlaceGoogleCalendar(acto) {
  const tramo = tramoDelActo(acto);
  if (!tramo) return null;
  const params = new URLSearchParams({
    action: "TEMPLATE",
    text: acto.titulo || "",
    dates: `${tramo.inicio}/${tramo.fin}`,
    details: `Más información: ${acto.url}`,
    ctz: ZONA,
  });
  if (acto.lugar) params.set("location", acto.lugar);
  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}

export function enlaceSuscripcion() {
  return `${URL_SITIO.replace(/^https?:/, "webcal:")}/agenda.ics`;
}
