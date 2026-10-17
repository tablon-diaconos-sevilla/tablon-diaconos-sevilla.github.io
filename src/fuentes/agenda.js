// Agenda / adelanto de noticia: archisevilla.org usa el plugin "The Events
// Calendar" de WordPress, que expone una API REST pública. Esto permite
// mostrar "Próximos actos" antes de que se conviertan en noticia.
//
// El Archivo BOAS (archisevilla.org/archidiocesis/archivo-boas/) resultó
// ser solo boletines PDF mensuales retrospectivos, no una agenda, así que
// NO se usa como fuente de agenda.

const EVENTOS_URL =
  "https://www.archisevilla.org/wp-json/tribe/events/v1/events";
const FUENTE = "Agenda — Archidiócesis de Sevilla";

export async function obtenerProximosActos() {
  const respuesta = await fetch(`${EVENTOS_URL}?per_page=25`);

  if (!respuesta.ok) {
    throw new Error(
      `API de eventos de archisevilla.org respondió ${respuesta.status}`
    );
  }

  const datos = await respuesta.json();
  const eventos = datos.events || [];

  return eventos.map((evento) => ({
    titulo: (evento.title || "").trim(),
    url: evento.url,
    fecha: fechaIso(evento.start_date),
    // Datos extra para el botón "Añadir a mi agenda" (ver src/calendario.js).
    fechaFin: fechaIso(evento.end_date),
    todoElDia: Boolean(evento.all_day),
    lugar: lugarDelEvento(evento.venue),
    fuente: FUENTE,
    esAgenda: true,
  }));
}

// La API da las fechas en hora de Madrid ("2026-10-01 10:00:00"), sin
// indicar el desfase. Se interpretan siempre como hora de Madrid, sea cual
// sea la zona horaria del servidor (las funciones de Netlify van en UTC).
export function fechaIso(texto) {
  if (!texto) return null;
  const r = String(texto).match(/^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})(?::(\d{2}))?$/);
  if (!r) {
    const d = new Date(texto);
    return Number.isNaN(d.getTime()) ? null : d.toISOString();
  }
  const [a, m, d, h, min, seg] = r.slice(1).map((x) => Number(x || 0));
  const comoUtc = Date.UTC(a, m - 1, d, h, min, seg);
  // Desfase de Madrid en ese momento (+1 h en invierno, +2 h en verano).
  const desfase = desfaseMadridMs(comoUtc);
  let ms = comoUtc - desfase;
  // Corrección en los días de cambio de hora.
  const desfase2 = desfaseMadridMs(ms);
  if (desfase2 !== desfase) ms = comoUtc - desfase2;
  return new Date(ms).toISOString();
}

function desfaseMadridMs(ms) {
  const partes = Object.fromEntries(
    new Intl.DateTimeFormat("en-US", {
      timeZone: "Europe/Madrid",
      hourCycle: "h23",
      year: "numeric", month: "2-digit", day: "2-digit",
      hour: "2-digit", minute: "2-digit", second: "2-digit",
    })
      .formatToParts(new Date(ms))
      .map((p) => [p.type, p.value])
  );
  const local = Date.UTC(
    +partes.year, +partes.month - 1, +partes.day,
    +partes.hour, +partes.minute, +partes.second
  );
  return local - Math.floor(ms / 1000) * 1000;
}

// "venue" puede venir como objeto ({ venue, address, city }) o vacío ([]).
function lugarDelEvento(venue) {
  if (!venue || Array.isArray(venue)) return "";
  const partes = [venue.venue, venue.address, venue.city]
    .map((p) => decodificarEntidades(String(p || "").trim()))
    .filter(Boolean);
  return [...new Set(partes)].join(", ");
}

function decodificarEntidades(texto) {
  return texto
    .replace(/&#8211;/g, "–")
    .replace(/&#8217;/g, "’")
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;/g, "'")
    .replace(/&amp;/g, "&");
}
