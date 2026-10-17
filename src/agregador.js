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

// Tiempo máximo de espera por fuente. La recogida automática en Netlify
// tiene un límite de 30 segundos en total, así que una web caída o lenta no
// debe bloquear a las demás: se anota como error y se sigue.
const LIMITE_POR_FUENTE_MS = 15000;

function conLimite(promesa, nombre, ms = LIMITE_POR_FUENTE_MS) {
  let temporizador;
  const limite = new Promise((_, rechazar) => {
    temporizador = setTimeout(
      () => rechazar(new Error(`${nombre}: sin respuesta en ${ms / 1000} s`)),
      ms
    );
  });
  return Promise.race([promesa, limite]).finally(() => clearTimeout(temporizador));
}

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
  // Noticias y agenda se piden a la vez (no una detrás de otra).
  const [resultadosNoticias, resultadoAgenda] = await Promise.all([
    Promise.allSettled(
      fuentesNoticias.map((f, i) =>
        conLimite(Promise.resolve().then(() => f.obtenerTitulares()), f.name || `fuente_${i}`)
      )
    ),
    incluirAgenda
      ? conLimite(Promise.resolve().then(() => fuenteAgenda.obtenerProximosActos()), "agenda").then(
          (valor) => ({ status: "fulfilled", value: valor }),
          (motivo) => ({ status: "rejected", reason: motivo })
        )
      : null,
  ]);

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
    if (resultadoAgenda.status === "fulfilled") {
      proximosActos = resultadoAgenda.value;
    } else {
      const e = resultadoAgenda.reason;
      errores.push({ fuente: "agenda", error: e?.message || String(e) });
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
