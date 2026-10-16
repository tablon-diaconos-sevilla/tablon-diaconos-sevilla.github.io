import assert from "node:assert/strict";
import { test } from "node:test";
import { generarPaginaHtml } from "../src/generador.js";
import { muestraArchisevilla, muestraAgenda } from "./fixtures/titulares-muestra.js";

test("genera HTML válido con titulares, enlaces y sin tarjetas con imagen", () => {
  const html = generarPaginaHtml({
    generadoEn: "2026-09-09T06:00:00.000Z",
    titulares: muestraArchisevilla,
    proximosActos: muestraAgenda,
  });

  assert.match(html, /<!doctype html>/i);
  assert.match(html, /Noticias de la Iglesia en Sevilla/);
  assert.match(html, /Próximos actos/);
  assert.match(html, /Últimas noticias/);

  for (const item of [...muestraArchisevilla, ...muestraAgenda]) {
    assert.ok(html.includes(item.titulo), `falta el titular: ${item.titulo}`);
    assert.ok(html.includes(item.url), `falta el enlace: ${item.url}`);
  }

  // No debe incluir imágenes (estilo lista sobria, no tarjetas)
});

test("muestra un mensaje adecuado cuando no hay titulares", () => {
  const html = generarPaginaHtml({
    generadoEn: "2026-09-09T06:00:00.000Z",
    titulares: [],
    proximosActos: [],
  });

  assert.match(html, /No se han encontrado titulares por ahora\./);
  assert.match(html, /No hay actos próximos publicados por ahora\./);
});
