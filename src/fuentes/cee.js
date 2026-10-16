// Fuente: conferenciaepiscopal.es (CEE)
// RSS válido en /feed/. Solo se incluyen titulares que pasan el filtro de
// FILTROS_CEE (ver más abajo) — la CEE cubre actualidad nacional, y aquí
// solo interesan nombramientos de obispos y encuentros/ordenaciones de
// diáconos permanentes (excluyendo diaconado transitorio).

import Parser from "rss-parser";

const FEED_URL = "https://www.conferenciaepiscopal.es/feed/";
const FUENTE = "Conferencia Episcopal Española";

// Un titular pasa el filtro si contiene TODAS las palabras de al menos
// uno de estos grupos (comparación sin tildes y en minúsculas).
const FILTROS_CEE = [
  ["nombra", "obispo"],
  ["nuevo obispo"],
  ["nuevos obispos"],
  ["nuevo arzobispo"],
  ["ordenacion", "diacono permanente"],
  ["ordenacion", "diaconos permanentes"],
  ["encuentro", "diacono permanente"],
  ["encuentro", "diaconos permanentes"],
];

function normalizar(texto) {
  return (texto || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, ""); // quita tildes
}

export function pasaFiltro(titulo) {
  const t = normalizar(titulo);
  return FILTROS_CEE.some((grupo) =>
    grupo.every((palabra) => t.includes(normalizar(palabra)))
  );
}

export async function obtenerTitulares() {
  const parser = new Parser();
  const feed = await parser.parseURL(FEED_URL);

  return (feed.items || [])
    .filter((item) => pasaFiltro(item.title))
    .map((item) => ({
      titulo: (item.title || "").trim(),
      url: item.link,
      fecha: item.isoDate || item.pubDate || null,
      fuente: FUENTE,
    }));
}
