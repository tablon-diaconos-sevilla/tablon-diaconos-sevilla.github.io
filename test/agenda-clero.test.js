import { test } from "node:test";
import assert from "node:assert/strict";
import {
  obtenerActosClero,
  mezclarActos,
  esMismoActo,
} from "../src/fuentes/agenda-clero.js";

const AHORA = new Date("2026-09-28T18:00:00+02:00");

// Actos tal como los publicaba archisevilla.org el 28 sept 2026.
const archiApertura = {
  titulo: "Apertura del curso académico en la Facultad de Teología",
  url: "https://www.archisevilla.org/evento/apertura-del-curso-academico-en-la-facultad-de-teologia-2/",
  fecha: "2026-10-01T08:00:00.000Z",
  fechaFin: "2026-10-01T11:00:00.000Z",
  todoElDia: false,
  lugar: "Facultad de Teología San Isidoro de Sevilla",
  fuente: "Agenda — Archidiócesis de Sevilla",
  esAgenda: true,
};
const archiCofrade = {
  titulo: "Apertura de curso cofrade en Sevilla",
  url: "https://www.archisevilla.org/evento/apertura-de-curso-cofrade-en-sevilla/",
  fecha: "2026-10-01T18:30:00.000Z",
  todoElDia: false,
  lugar: "Consejo de Hermandades y Cofradías de Sevilla",
  fuente: "Agenda — Archidiócesis de Sevilla",
  esAgenda: true,
};
const archiAmparo = {
  titulo: "Coronación canónica de Ntra. Sra. del Amparo",
  url: "https://www.archisevilla.org/evento/coronacion-canonica-de-ntra-sra-del-amparo/",
  fecha: "2026-11-07T23:00:00.000Z",
  todoElDia: true,
  lugar: "",
  fuente: "Agenda — Archidiócesis de Sevilla",
  esAgenda: true,
};

test("lee los 17 actos de la Delegación para el Clero", async () => {
  const actos = await obtenerActosClero({ ahora: AHORA });
  assert.equal(actos.length, 17);
  assert.ok(actos.every((a) => a.esAgenda && a.sinEnlace && a.url));
  assert.equal(new Set(actos.map((a) => a.url)).size, 17);
});

test("quita los actos que ya han terminado", async () => {
  const actos = await obtenerActosClero({ ahora: new Date("2026-11-10T12:00:00+01:00") });
  // Ya han pasado: 1 oct, 15 oct, 21 oct y los ejercicios del 8 al 13 nov
  // siguen vigentes hasta el 13.
  assert.equal(actos.length, 14);
  assert.ok(actos.some((a) => a.titulo.includes("1.ª tanda")));
});

test("la inauguración del curso se funde con la de Archisevilla, con la hora de la Delegación", async () => {
  const clero = await obtenerActosClero({ ahora: AHORA });
  const mezcla = mezclarActos([archiApertura, archiCofrade, archiAmparo], clero);

  // 3 de Archisevilla + 17 de la Delegación - 1 repetido = 19
  assert.equal(mezcla.length, 19);

  const apertura = mezcla.find((a) => a.url === archiApertura.url);
  assert.equal(apertura.titulo, archiApertura.titulo); // título y enlace de Archisevilla
  assert.equal(new Date(apertura.fecha).toISOString(), "2026-10-01T09:00:00.000Z"); // 11:00 en Madrid
  assert.equal(apertura.lugar, "Seminario · Facultad de Teología");
  assert.ok(!mezcla.some((a) => a.titulo.startsWith("Misa solemne de inauguración")));

  // El acto cofrade del mismo día no se toca.
  const cofrade = mezcla.find((a) => a.url === archiCofrade.url);
  assert.deepEqual(cofrade, archiCofrade);
});

test("actos distintos del mismo día no se confunden", async () => {
  const clero = await obtenerActosClero({ ahora: AHORA });
  const ejercicios = clero.find((a) => a.titulo.includes("1.ª tanda"));
  assert.equal(esMismoActo(ejercicios, archiAmparo), false);
});

test("si la Delegación no da hora, se queda la de Archisevilla", async () => {
  const clero = await obtenerActosClero({ ahora: AHORA });
  const archiCorpus = {
    titulo: "Procesión del Corpus Christi",
    url: "https://www.archisevilla.org/evento/corpus-christi/",
    fecha: "2027-05-27T06:30:00.000Z",
    todoElDia: false,
    lugar: "",
    fuente: "Agenda — Archidiócesis de Sevilla",
    esAgenda: true,
  };
  const mezcla = mezclarActos([archiCorpus], clero);
  const corpus = mezcla.find((a) => a.url === archiCorpus.url);
  assert.equal(corpus.fecha, archiCorpus.fecha);
  assert.equal(corpus.lugar, "Catedral de Sevilla");
  assert.ok(!mezcla.some((a) => a.titulo === "Solemnidad del Corpus Christi"));
});
