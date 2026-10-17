// Genera todo el contenido del tablón (sin escribir nada en disco):
// recoge titulares, los combina con el histórico y devuelve los datos y
// los archivos de la página. Lo usan tanto `npm run build` (que los
// escribe en public/ y data/) como la función programada de Netlify (que
// los guarda en Netlify Blobs).

import { agregarTitulares } from "./agregador.js";
import { crearFiltroDuplicados, ordenarPorPrioridad } from "./duplicados.js";
import { generarPaginaHtml } from "./generador.js";
import {
  FUENTE_CLERO,
  mezclarActos,
  obtenerActosClero,
} from "./fuentes/agenda-clero.js";
import {
  asignarArchivosIcs,
  generarIcsActo,
  generarIcsSuscripcion,
} from "./calendario.js";

// Cuántos días se conservan las noticias en "Últimas noticias", aunque ya
// hayan salido de los RSS de sus fuentes. Solo afecta a las noticias; los
// "Próximos actos" no llevan histórico.
export const DIAS_HISTORICO = 2;

// Si la agenda de archisevilla.org falla (web caída), se mantienen los
// actos de la última actualización buena, quitando los que ya pasaron.
function actosAnterioresVigentes(actos, ahora = new Date()) {
  const hoy = new Date(ahora);
  hoy.setHours(0, 0, 0, 0);
  return actos.filter((a) => a.fecha && new Date(a.fecha) >= hoy);
}

// Une los titulares nuevos con el histórico:
// - si un titular está en ambos (misma URL o mismo titular), gana la
//   versión nueva; si el mismo titular viene de dos fuentes, gana la
//   original (Archidiócesis antes que ODISUR);
// - del histórico solo se conservan los de los últimos DIAS_HISTORICO días
//   (los antiguos sin fecha reconocible se descartan, porque no se puede
//   saber cuándo caducan);
// - resultado ordenado del más reciente al más antiguo, sin fecha al final.
function combinarConHistorico(nuevos, historico, ahora = new Date()) {
  const limite = ahora.getTime() - DIAS_HISTORICO * 24 * 60 * 60 * 1000;
  const filtro = crearFiltroDuplicados();
  const resultado = [];

  const historicoVigente = historico.filter((t) => {
    const ms = t.fecha ? new Date(t.fecha).getTime() : NaN;
    return !Number.isNaN(ms) && ms >= limite;
  });

  // Nuevos antes que histórico y, ante un mismo titular en dos fuentes, la
  // fuente original antes que ODISUR (ver src/duplicados.js).
  for (const t of ordenarPorPrioridad([...nuevos, ...historicoVigente])) {
    if (filtro.aceptar(t)) resultado.push(t);
  }

  // También se retiran las noticias nuevas más antiguas que el límite, para
  // que la ventana de días sea la misma para todas.
  return resultado
    .filter((t) => {
      if (!t.fecha) return true;
      const ms = new Date(t.fecha).getTime();
      return Number.isNaN(ms) || ms >= limite;
    })
    .sort((a, b) => {
      if (!a.fecha && !b.fecha) return 0;
      if (!a.fecha) return 1;
      if (!b.fecha) return -1;
      return new Date(b.fecha) - new Date(a.fecha);
    });
}

// historico: { titulares, proximosActos } de la actualización anterior.
// Devuelve { datos, archivos, nuevosEnFuentes }, donde archivos es un
// objeto { "ruta/relativa": contenido } con index.html, agenda.ics y un
// .ics por acto (actos/...).
export async function construir(historico = { titulares: [], proximosActos: [] }) {
  const resultado = await agregarTitulares();

  if (resultado.errores.length) {
    for (const e of resultado.errores) {
      console.error(`[aviso] Fuente "${e.fuente}" falló: ${e.error}`);
    }
  }

  const nuevosEnFuentes = resultado.titulares.length;
  resultado.titulares = combinarConHistorico(
    resultado.titulares,
    historico.titulares || []
  );

  if (resultado.errores.some((e) => e.fuente === "agenda")) {
    // Los de la Delegación para el Clero no dependen de archisevilla.org:
    // se vuelven a leer de data/agenda-clero.json y se mezclan de nuevo.
    const anteriores = actosAnterioresVigentes(historico.proximosActos || []);
    const anterioresArchi = anteriores.filter((a) => a.fuente !== FUENTE_CLERO);
    let actosClero = [];
    try {
      actosClero = await obtenerActosClero();
    } catch {
      actosClero = anteriores.filter((a) => a.fuente === FUENTE_CLERO);
    }
    resultado.proximosActos = mezclarActos(anterioresArchi, actosClero).sort((a, b) => {
      if (!a.fecha && !b.fecha) return 0;
      if (!a.fecha) return 1;
      if (!b.fecha) return -1;
      return new Date(a.fecha) - new Date(b.fecha);
    });
    console.error(
      `[aviso] Agenda no disponible: se mantienen ${resultado.proximosActos.length} actos de la actualización anterior.`
    );
  }

  // "Añadir a mi agenda": un .ics por acto + el calendario suscribible.
  resultado.proximosActos = asignarArchivosIcs(resultado.proximosActos);
  const archivos = {};
  for (const acto of resultado.proximosActos) {
    if (acto.archivoIcs) archivos[acto.archivoIcs] = generarIcsActo(acto);
  }
  archivos["agenda.ics"] = generarIcsSuscripcion(resultado.proximosActos);
  archivos["index.html"] = generarPaginaHtml(resultado);

  return { datos: resultado, archivos, nuevosEnFuentes };
}
