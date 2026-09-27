// Detección de duplicados compartida por el agregador y el histórico.
//
// Un titular se considera repetido si ya se ha visto:
// - su misma URL, o
// - otro titular con el mismo texto (comparado en minúsculas, sin tildes ni
//   signos), sea de la misma fuente o de otra. Esto cubre dos casos:
//   · ODISUR publica a veces la misma noticia dos veces y WordPress le da a
//     la segunda la URL terminada en "-2";
//   · ODISUR reproduce noticias de archisevilla.org con el mismo titular.
//
// Cuando dos fuentes tienen el mismo titular se conserva el de la fuente
// original (ver PRIORIDAD_FUENTES): Archidiócesis antes que ODISUR, que es
// un agregador de varias diócesis.

// Fuentes ordenadas de más a menos preferente. Las que no aparecen aquí
// van entre las listadas y ODISUR.
const PRIORIDAD_FUENTES = [
  "Archidiócesis de Sevilla",
  "Catedral de Sevilla",
  "Conferencia Episcopal Española",
];
const FUENTES_AL_FINAL = ["ODISUR"];

function prioridad(fuente) {
  const i = PRIORIDAD_FUENTES.indexOf(fuente);
  if (i >= 0) return i;
  if (FUENTES_AL_FINAL.includes(fuente)) return 1000;
  return PRIORIDAD_FUENTES.length;
}

// Ordena de modo que, ante un duplicado, se vea primero la fuente original.
// Es estable: entre titulares de igual prioridad se respeta el orden dado.
export function ordenarPorPrioridad(titulares) {
  return titulares
    .map((t, i) => ({ t, i }))
    .sort((a, b) => prioridad(a.t.fuente) - prioridad(b.t.fuente) || a.i - b.i)
    .map(({ t }) => t);
}

function normalizarTexto(texto) {
  return (texto || "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9ñ]+/g, " ")
    .trim();
}

function clavesDe(t) {
  const claves = [];
  const url = (t.url || "").trim();
  if (url) claves.push(`url:${url}`);
  const titulo = normalizarTexto(t.titulo);
  if (titulo) claves.push(`titulo:${titulo}`);
  return claves;
}

export function crearFiltroDuplicados() {
  const vistos = new Set();
  return {
    // Devuelve true si el titular es nuevo (y lo marca como visto).
    aceptar(t) {
      if (!(t.url || "").trim()) return false;
      const claves = clavesDe(t);
      if (claves.some((c) => vistos.has(c))) return false;
      claves.forEach((c) => vistos.add(c));
      return true;
    },
  };
}

export function quitarDuplicados(titulares) {
  const filtro = crearFiltroDuplicados();
  return ordenarPorPrioridad(titulares).filter((t) => filtro.aceptar(t));
}
