// Script principal: agrega titulares de todas las fuentes, los combina con
// el histórico guardado en data/titulares.json (últimos DIAS_HISTORICO
// días), guarda el JSON de datos y genera la página estática en
// public/index.html.
//
// Necesita salida a internet normal (local, GitHub Actions o el build de
// Netlify/Vercel). No funciona en un sandbox sin acceso a internet — para
// eso está `npm test`, que usa datos de muestra.

import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
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

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const RAIZ = path.resolve(__dirname, "..");
const DATA_DIR = path.join(RAIZ, "data");
const PUBLIC_DIR = path.join(RAIZ, "public");
const DATOS_JSON = path.join(DATA_DIR, "titulares.json");

// Cuántos días se conservan las noticias en "Últimas noticias", aunque ya
// hayan salido de los RSS de sus fuentes. Solo afecta a las noticias; los
// "Próximos actos" no llevan histórico.
const DIAS_HISTORICO = 2;

// Lee los datos guardados en el build anterior. Si el archivo no existe o
// está dañado, se empieza sin histórico (el build no falla).
async function leerHistorico() {
  try {
    const datos = JSON.parse(await readFile(DATOS_JSON, "utf8"));
    return {
      titulares: Array.isArray(datos.titulares) ? datos.titulares : [],
      proximosActos: Array.isArray(datos.proximosActos) ? datos.proximosActos : [],
    };
  } catch {
    return { titulares: [], proximosActos: [] };
  }
}

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

async function main() {
  const historico = await leerHistorico();
  const resultado = await agregarTitulares();

  if (resultado.errores.length) {
    for (const e of resultado.errores) {
      console.error(`[aviso] Fuente "${e.fuente}" falló: ${e.error}`);
    }
  }

  const nuevosEnFuentes = resultado.titulares.length;
  resultado.titulares = combinarConHistorico(
    resultado.titulares,
    historico.titulares
  );

  if (resultado.errores.some((e) => e.fuente === "agenda")) {
    // Los de la Delegación para el Clero no dependen de archisevilla.org:
    // se vuelven a leer de data/agenda-clero.json y se mezclan de nuevo.
    const anterioresArchi = actosAnterioresVigentes(historico.proximosActos).filter(
      (a) => a.fuente !== FUENTE_CLERO
    );
    let actosClero = [];
    try {
      actosClero = await obtenerActosClero();
    } catch {
      actosClero = actosAnterioresVigentes(historico.proximosActos).filter(
        (a) => a.fuente === FUENTE_CLERO
      );
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

  await mkdir(DATA_DIR, { recursive: true });
  await mkdir(PUBLIC_DIR, { recursive: true });

  // "Añadir a mi agenda": un .ics por acto + el calendario suscribible.
  // La carpeta public/actos se rehace entera en cada build.
  resultado.proximosActos = asignarArchivosIcs(resultado.proximosActos);
  const actosDir = path.join(PUBLIC_DIR, "actos");
  await rm(actosDir, { recursive: true, force: true });
  await mkdir(actosDir, { recursive: true });
  for (const acto of resultado.proximosActos) {
    if (!acto.archivoIcs) continue;
    await writeFile(path.join(PUBLIC_DIR, acto.archivoIcs), generarIcsActo(acto), "utf8");
  }
  await writeFile(
    path.join(PUBLIC_DIR, "agenda.ics"),
    generarIcsSuscripcion(resultado.proximosActos),
    "utf8"
  );

  await writeFile(
    DATOS_JSON,
    JSON.stringify(resultado, null, 2) + "\n",
    "utf8"
  );

  const html = generarPaginaHtml(resultado);
  await writeFile(path.join(PUBLIC_DIR, "index.html"), html, "utf8");

  console.log(
    `Listo: ${resultado.titulares.length} titulares (${nuevosEnFuentes} en las fuentes ahora, histórico de ${DIAS_HISTORICO} días), ${resultado.proximosActos.length} próximos actos.`
  );
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("El build falló:", error);
    process.exit(1);
  });
