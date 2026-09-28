// Combina titulares de todas las fuentes, quita duplicados exactos por URL
// y ordena cronológicamente (más recientes primero).
//
// Duplicados: misma URL, o mismo titular dentro de la misma fuente (ver
// src/duplicados.js). Si dos fuentes DISTINTAS cuentan el mismo suceso,
// se muestran ambas. Los próximos actos solo se deduplican por URL, porque
// un mismo acto puede repetirse en fechas distintas con el mismo título.

import * as archisevilla from "./fuentes/archisevilla.js";
import * as odisur from "./fuentes/odisur.js";
import * as catedral from "./fuentes/catedral.js";
import * as agenda from "./fuentes/agenda.js";
import * as cee from "./fuentes/cee.js";
import * as agendaClero from "./fuentes/agenda-clero.js";
import { quitarDuplicados } from "./duplicados.js";

const FUENTES_NOTICIAS = [archisevilla, odisur, catedral, cee];

function normalizarFecha(fecha) {
  if (!fecha) return null;
  const d = new Date(fecha);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

function quitarDuplicadosPorUrl(titulares) {
  const vistos = new Set();
  const resultado = [];
  for (const t of titulares) {
    const clave = (t.url || "").trim();
    if (!clave || vistos.has(clave)) continue;
    vistos.add(clave);
    resultado.push(t);
  }
  return resultado;
}

function ordenarPorFechaDesc(titulares) {
  return [...titulares].sort((a, b) => {
    // Sin fecha reconocible: al final.
    if (!a.fecha && !b.fecha) return 0;
    if (!a.fecha) return 1;
    if (!b.fecha) return -1;
    return new Date(b.fecha) - new Date(a.fecha);
  });
}

// obtenerFuentes permite inyectar módulos de fuentes falsos en los tests,
// para poder ejecutar `npm test` con datos de muestra sin salir a internet.
export async function agregarTitulares({
  fuentesNoticias = FUENTES_NOTICIAS,
  fuenteAgenda = agenda,
  fuenteClero = agendaClero,
  incluirAgenda = true,
} = {}) {
  const resultadosNoticias = await Promise.allSettled(
    fuentesNoticias.map((f) => f.obtenerTitulares())
  );

  const errores = [];
  let titulares = [];

  resultadosNoticias.forEach((resultado, i) => {
    if (resultado.status === "fulfilled") {
      titulares.push(...resultado.value);
    } else {
      errores.push({
        fuente: fuentesNoticias[i].name || `fuente_${i}`,
        error: resultado.reason?.message || String(resultado.reason),
      });
    }
  });

  let proximosActos = [];
  if (incluirAgenda) {
    try {
      proximosActos = await fuenteAgenda.obtenerProximosActos();
    } catch (error) {
      errores.push({ fuente: "agenda", error: error.message || String(error) });
    }

    // Agenda anual de la Delegación para el Clero (data/agenda-clero.json),
    // mezclada con la de Archisevilla sin repetir actos.
    if (fuenteClero) {
      try {
        const actosClero = await fuenteClero.obtenerActosClero();
        proximosActos = agendaClero.mezclarActos(proximosActos, actosClero);
      } catch (error) {
        errores.push({ fuente: "agenda-clero", error: error.message || String(error) });
      }
    }
  }

  titulares = titulares.map((t) => ({ ...t, fecha: normalizarFecha(t.fecha) }));
  proximosActos = proximosActos.map((t) => ({
    ...t,
    fecha: normalizarFecha(t.fecha),
  }));

  titulares = ordenarPorFechaDesc(quitarDuplicados(titulares));
 proximosActos = quitarDuplicadosPorUrl(proximosActos).sort((a, b) => {
    if (!a.fecha && !b.fecha) return 0;
    if (!a.fecha) return 1;
    if (!b.fecha) return -1;
    return new Date(a.fecha) - new Date(b.fecha);
  });

  return {
    generadoEn: new Date().toISOString(),
    titulares,
    proximosActos,
    errores,
  };
}
