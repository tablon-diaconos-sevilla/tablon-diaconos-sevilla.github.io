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
    fecha: evento.start_date || null,
    // Datos extra para el botón "Añadir a mi agenda" (ver src/calendario.js).
    fechaFin: fechaIso(evento.end_date),
    todoElDia: Boolean(evento.all_day),
    lugar: lugarDelEvento(evento.venue),
    fuente: FUENTE,
    esAgenda: true,
  }));
}

// La API da las fechas en hora de Madrid ("2026-10-01 10:00:00"); el build
// se ejecuta con TZ=Europe/Madrid, así que new Date() las interpreta bien.
function fechaIso(texto) {
  if (!texto) return null;
  const d = new Date(texto);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
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
