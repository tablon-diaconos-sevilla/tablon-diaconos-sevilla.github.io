import assert from "node:assert/strict";
import { test } from "node:test";
import { agregarTitulares } from "../src/agregador.js";
import {
  muestraArchisevilla,
  muestraOdisur,
  muestraCatedral,
  muestraAgenda,
} from "./fixtures/titulares-muestra.js";

function fuenteFalsa(nombre, titulares) {
  return {
    name: nombre,
    async obtenerTitulares() {
      return titulares;
    },
  };
}

test("agrega, ordena cronológicamente y quita duplicados por URL", async () => {
  const duplicado = muestraArchisevilla[0];
  const fuentesNoticias = [
    fuenteFalsa("archisevilla", [...muestraArchisevilla, duplicado]),
    fuenteFalsa("odisur", muestraOdisur),
    fuenteFalsa("catedral", muestraCatedral),
  ];
  const fuenteAgenda = {
    async obtenerProximosActos() {
      return muestraAgenda;
    },
  };

  const resultado = await agregarTitulares({ fuentesNoticias, fuenteAgenda, fuenteClero: null });

  assert.equal(resultado.errores.length, 0);
  assert.equal(resultado.titulares.length, 4); // 2 archisevilla + 1 odisur + 1 catedral, sin el duplicado
  assert.equal(resultado.proximosActos.length, 1);

  // Orden cronológico descendente
  const fechas = resultado.titulares.map((t) => new Date(t.fecha).getTime());
  const fechasOrdenadas = [...fechas].sort((a, b) => b - a);
  assert.deepEqual(fechas, fechasOrdenadas);
});

test("recoge el error de una fuente sin tumbar el build entero", async () => {
  const fuentesNoticias = [
    fuenteFalsa("archisevilla", muestraArchisevilla),
    {
      name: "catedral",
      async obtenerTitulares() {
        throw new Error("catedraldesevilla.es respondió 403");
      },
    },
  ];
  const fuenteAgenda = {
    async obtenerProximosActos() {
      return [];
    },
  };

  const resultado = await agregarTitulares({ fuentesNoticias, fuenteAgenda, fuenteClero: null });

  assert.equal(resultado.titulares.length, muestraArchisevilla.length);
  assert.equal(resultado.errores.length, 1);
  assert.match(resultado.errores[0].error, /403/);
});

test("quita la noticia repetida por la misma fuente con URL terminada en -2", async () => {
  const original = {
    titulo: "Jerez se prepara para celebrar mañana la solemnidad",
    url: "https://odisur.es/asidonia-jerez/jerez-se-prepara/",
    fecha: "2026-09-23T11:20:13.000Z",
    fuente: "ODISUR",
  };
  const copia = { ...original, url: "https://odisur.es/asidonia-jerez/jerez-se-prepara-2/" };
  const otraFuente = { ...original, url: "https://www.archisevilla.org/jerez/", fuente: "Archidiócesis de Sevilla" };
  const resultado = await agregarTitulares({
    fuentesNoticias: [fuenteFalsa("odisur", [original, copia]), fuenteFalsa("archisevilla", [otraFuente])],
    incluirAgenda: false,
  });
  assert.equal(resultado.titulares.length, 2); // la copia -2 fuera; la de otra fuente se mantiene
  assert.ok(!resultado.titulares.some((t) => t.url.endsWith("-2/")));
});
