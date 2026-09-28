import assert from "node:assert/strict";
import { test } from "node:test";
import {
  asignarArchivosIcs,
  generarIcsActo,
  generarIcsSuscripcion,
  enlaceGoogleCalendar,
} from "../src/calendario.js";
import { generarPaginaHtml } from "../src/generador.js";

const acto = {
  titulo: "Encuentro diocesano de diáconos permanentes, con el Arzobispo",
  url: "https://www.archisevilla.org/evento/encuentro-diaconos/",
  fecha: "2026-10-17T08:30:00.000Z",
  fechaFin: "2026-10-17T12:00:00.000Z",
  todoElDia: false,
  lugar: "Seminario Metropolitano, Sevilla",
  fuente: "Agenda — Archidiócesis de Sevilla",
  esAgenda: true,
};

test("genera un .ics válido con hora UTC, lugar y enlace", () => {
  const [a] = asignarArchivosIcs([acto]);
  assert.equal(a.archivoIcs, "actos/2026-10-17-encuentro-diaconos.ics");
  const ics = generarIcsActo(a, new Date("2026-09-28T00:00:00Z"));
  assert.match(ics, /DTSTART:20261017T083000Z\r\n/);
  assert.match(ics, /DTEND:20261017T120000Z\r\n/);
  assert.match(ics, /SUMMARY:Encuentro diocesano de diáconos permanentes\\, con el/);
  assert.match(ics, /LOCATION:Seminario Metropolitano\\, Sevilla/);
  for (const linea of ics.split("\r\n")) assert.ok(Buffer.byteLength(linea) <= 75, linea);
});

test("acto sin hora de fin dura 1 hora; todo el día usa fechas", () => {
  const sinFin = generarIcsActo({ ...acto, fechaFin: null });
  assert.match(sinFin, /DTEND:20261017T093000Z/);
  const diaEntero = generarIcsActo({ ...acto, todoElDia: true, fecha: "2026-10-16T22:00:00.000Z", fechaFin: "2026-10-17T21:59:00.000Z" });
  assert.match(diaEntero, /DTSTART;VALUE=DATE:20261017/);
  assert.match(diaEntero, /DTEND;VALUE=DATE:20261018/);
});

test("enlace de Google Calendar y calendario suscribible", () => {
  const g = new URL(enlaceGoogleCalendar(acto));
  assert.equal(g.searchParams.get("dates"), "20261017T083000Z/20261017T120000Z");
  const feed = generarIcsSuscripcion([acto, { ...acto, url: "https://x.org/evento/otro/" }]);
  assert.equal(feed.match(/BEGIN:VEVENT/g).length, 2);
  assert.match(feed, /X-WR-CALNAME:/);
});

test("la página muestra los botones solo en los próximos actos", () => {
  const html = generarPaginaHtml({
    generadoEn: "2026-09-28T06:00:00.000Z",
    titulares: [{ titulo: "Noticia", url: "https://x.org/n", fecha: "2026-09-27T10:00:00Z", fuente: "X" }],
    proximosActos: asignarArchivosIcs([acto]),
  });
  assert.equal(html.match(/Añadir a mi agenda/g).length, 1);
  assert.match(html, /href="actos\/2026-10-17-encuentro-diaconos\.ics"/);
  assert.match(html, /webcal:\/\/tablon-diaconos-sevilla\.github\.io\/agenda\.ics/);
});

test("acto publicado a las 00:00 de Madrid se trata como de todo el día", () => {
  const ics = generarIcsActo({ ...acto, fecha: "2026-11-07T23:00:00.000Z", fechaFin: null });
  assert.match(ics, /DTSTART;VALUE=DATE:20261108/);
  assert.match(ics, /DTEND;VALUE=DATE:20261109/);
});
