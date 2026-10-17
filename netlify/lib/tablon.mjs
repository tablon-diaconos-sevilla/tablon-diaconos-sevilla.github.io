// Recogida de titulares y almacenamiento en Netlify Blobs.
//
// El tablón ya no se publica de nuevo cada hora (cada publicación de
// Netlify gasta muchos créditos). La web se publica una sola vez y:
//   - netlify/functions/actualizar.mjs llama cada hora a actualizarTablon(),
//     que genera la página y la guarda en el almacén "tablon";
//   - netlify/functions/pagina.mjs sirve la página y los .ics desde ahí.

import { getStore } from "@netlify/blobs";
import { purgeCache } from "@netlify/functions";
import { construir } from "../../src/construir.js";
// Histórico de partida (el último que guardó la versión de GitHub Pages),
// solo para la primera actualización, cuando el almacén aún está vacío.
import HISTORICO_INICIAL from "../../data/titulares.json" with { type: "json" };

export const ETIQUETA_CACHE = "tablon";
const CLAVE_DATOS = "datos.json";
const PREFIJO_PAGINA = "pagina/";
const PREFIJO_ACTOS = "pagina/actos/";

export function almacen() {
  return getStore({ name: "tablon", consistency: "strong" });
}

export function clavePagina(ruta) {
  return PREFIJO_PAGINA + ruta.replace(/^\/+/, "");
}

async function leerHistorico(store) {
  try {
    const datos = await store.get(CLAVE_DATOS, { type: "json" });
    if (datos) return datos;
  } catch (error) {
    console.error("[aviso] No se pudo leer el histórico guardado:", error.message);
  }
  return HISTORICO_INICIAL || { titulares: [], proximosActos: [] };
}

export async function actualizarTablon() {
  const store = almacen();
  const historico = await leerHistorico(store);
  const { datos, archivos, nuevosEnFuentes } = await construir(historico);

  // Primero los .ics de cada acto, luego el calendario y la página, y por
  // último los datos: así la página nunca enlaza a un .ics que aún no existe.
  const rutasActos = Object.keys(archivos).filter((r) => r.startsWith("actos/"));
  await Promise.all(rutasActos.map((r) => store.set(clavePagina(r), archivos[r])));
  await store.set(clavePagina("agenda.ics"), archivos["agenda.ics"]);
  await store.set(clavePagina("index.html"), archivos["index.html"]);
  await store.setJSON(CLAVE_DATOS, datos);

  // Se borran los .ics de actos que ya no están en la agenda.
  const vigentes = new Set(rutasActos.map(clavePagina));
  const { blobs } = await store.list({ prefix: PREFIJO_ACTOS });
  await Promise.all(
    blobs.filter((b) => !vigentes.has(b.key)).map((b) => store.delete(b.key))
  );

  // La página se guarda en la caché de Netlify hasta la siguiente
  // actualización; aquí se vacía para que se vea ya la nueva.
  try {
    await purgeCache({ tags: [ETIQUETA_CACHE] });
  } catch (error) {
    console.error("[aviso] No se pudo vaciar la caché:", error.message);
  }

  const resumen = `${datos.titulares.length} titulares (${nuevosEnFuentes} en las fuentes ahora), ${datos.proximosActos.length} próximos actos, ${datos.errores.length} fuentes con error.`;
  console.log(`Tablón actualizado: ${resumen}`);
  return resumen;
}
