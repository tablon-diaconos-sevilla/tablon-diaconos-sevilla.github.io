// Agenda anual de la Delegación Diocesana para el Clero.
//
// No hay web ni RSS: llega una vez al año en PDF/Word y se pasa a mano a
// data/agenda-clero.json (solo los actos que interesan a la Comunidad
// Diaconal). Aquí se leen esos actos y se mezclan con los de la agenda de
// archisevilla.org en "Próximos actos".
//
// Si archisevilla.org publica el mismo acto, no se repite: se muestra el de
// Archisevilla (título y enlace a su ficha), pero con la hora y el lugar de
// la Delegación, que es la fuente oficial para el clero. Si la Delegación no
// da hora o lugar, se usan los de Archisevilla.

import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ARCHIVO = path.resolve(__dirname, "..", "..", "data", "agenda-clero.json");
const URL_SITIO = "https://tablon-diaconos-sevilla.github.io";
export const FUENTE_CLERO = "Delegación para el Clero";
const ZONA = "Europe/Madrid";

// Palabras demasiado comunes para decidir que dos actos son el mismo.
const PALABRAS_COMUNES = new Set([
  "misa", "misas", "eucaristia", "celebracion", "solemne", "solemnidad",
  "retiro", "encuentro", "formacion", "jornada", "jornadas", "acto",
  "apertura", "inauguracion", "inaugural", "curso", "clero", "sacerdotes",
  "sacerdotal", "sacerdotales", "diocesano", "diocesana", "sevilla",
  "catedral", "seminario", "facultad", "arzobispo", "arzobispado",
  "obispo", "auxiliar", "hermandad", "santo", "santa", "nuestra", "senora",
  "virgen", "parroquia", "dirige", "preside", "sobre", "para", "desde",
  "entre", "hasta", "como", "este", "esta", "todos", "todas",
]);

function normalizar(texto) {
  return (texto || "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9ñ]+/g, " ")
    .trim();
}

function palabrasDistintivas(titulo) {
  return new Set(
    normalizar(titulo)
      .split(" ")
      .filter((p) => p.length >= 4 && !PALABRAS_COMUNES.has(p))
  );
}

function diaMadrid(iso) {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleDateString("sv-SE", { timeZone: ZONA });
}

function aIso(texto) {
  if (!texto) return null;
  const d = new Date(texto);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

function slug(texto) {
  return normalizar(texto).replace(/ /g, "-").slice(0, 60);
}

// Lee data/agenda-clero.json. `ahora` permite fijar la fecha en los tests.
export async function obtenerActosClero({ archivo = ARCHIVO, ahora = new Date() } = {}) {
  const datos = JSON.parse(await readFile(archivo, "utf8"));
  const hoy = new Date(ahora).toLocaleDateString("sv-SE", { timeZone: ZONA });

  return (datos.actos || [])
    .map((a) => {
      const fecha = aIso(a.fecha);
      const dia = diaMadrid(fecha);
      return {
        titulo: (a.titulo || "").trim(),
        // Sin ficha propia en internet: enlace interno único (para que el
        // acto no se descarte como duplicado) y título sin enlace en la página.
        url: `${URL_SITIO}/#clero-${dia}-${slug(a.titulo)}`,
        sinEnlace: true,
        fecha,
        fechaFin: aIso(a.fechaFin),
        todoElDia: Boolean(a.todoElDia),
        lugar: (a.lugar || "").trim(),
        fuente: FUENTE_CLERO,
        esAgenda: true,
      };
    })
    .filter((a) => a.titulo && a.fecha)
    // Se quitan los que ya han terminado.
    .filter((a) => diaMadrid(a.fechaFin || a.fecha) >= hoy);
}

// ¿Son el mismo acto? Mismo día (en Madrid) y alguna palabra distintiva
// del título en común.
export function esMismoActo(clero, archi) {
  const dia = diaMadrid(clero.fecha);
  if (!dia || dia !== diaMadrid(archi.fecha)) return false;
  const a = palabrasDistintivas(clero.titulo);
  for (const p of palabrasDistintivas(archi.titulo)) if (a.has(p)) return true;
  return false;
}

// Mezcla los actos de Archisevilla con los de la Delegación sin repetir.
export function mezclarActos(actosArchisevilla, actosClero) {
  const usados = new Set();
  const resultado = actosArchisevilla.map((archi) => ({ ...archi }));

  const soloClero = [];
  for (const clero of actosClero) {
    const i = resultado.findIndex((archi, j) => !usados.has(j) && esMismoActo(clero, archi));
    if (i < 0) {
      soloClero.push(clero);
      continue;
    }
    usados.add(i);
    const archi = resultado[i];
    // Hora de la Delegación si la da (si no, se queda la de Archisevilla).
    if (!clero.todoElDia) {
      archi.fecha = clero.fecha;
      archi.todoElDia = false;
      const finArchi = archi.fechaFin && new Date(archi.fechaFin) > new Date(clero.fecha)
        ? archi.fechaFin
        : null;
      archi.fechaFin = clero.fechaFin || finArchi;
    }
    if (clero.lugar) archi.lugar = clero.lugar;
  }

  return [...resultado, ...soloClero];
}
