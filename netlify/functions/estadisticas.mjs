// Página de estadísticas del tablón: /estadisticas
// Muestra las visitas de los últimos 30 días y los titulares más pulsados.
// No está enlazada desde el tablón ni la indexan los buscadores.

import { getStore } from "@netlify/blobs";

const esc = (t) => String(t).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);

function fechaCorta(iso) {
  const [a, m, d] = iso.split("-");
  return `${d}/${m}/${a}`;
}

export default async () => {
  const store = getStore({ name: "visitas", consistency: "strong" });
  const { blobs } = await store.list({ prefix: "dia/" });
  const claves = blobs.map((b) => b.key).sort().reverse();

  const dias = [];
  for (const clave of claves) {
    const d = await store.get(clave, { type: "json" });
    if (d) dias.push({ fecha: clave.slice(4), ...d });
  }

  const ultimos = dias.slice(0, 30);
  const total = (lista, campo) => lista.reduce((s, d) => s + (d[campo] || 0), 0);
  const clicsDia = (d) => Object.values(d.titulares || {}).reduce((s, t) => s + t.clics, 0);

  // Titulares más pulsados en los últimos 30 días
  const ranking = {};
  for (const d of ultimos) {
    for (const [url, t] of Object.entries(d.titulares || {})) {
      ranking[url] = ranking[url] || { titulo: t.titulo, clics: 0 };
      ranking[url].clics += t.clics;
    }
  }
  const top = Object.entries(ranking).sort((a, b) => b[1].clics - a[1].clics).slice(0, 15);

  const filasDias = ultimos
    .map((d) => `<tr><td>${fechaCorta(d.fecha)}</td><td>${d.pagina || 0}</td><td>${clicsDia(d)}</td><td>${d.calendario || 0}</td></tr>`)
    .join("");
  const filasTop = top
    .map(([url, t]) => `<tr><td><a href="${esc(url)}" target="_blank" rel="noopener noreferrer">${esc(t.titulo || url)}</a></td><td>${t.clics}</td></tr>`)
    .join("");

  const html = `<!doctype html><html lang="es"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1"><meta name="robots" content="noindex">
<title>Estadísticas del tablón</title>
<style>
 body{font-family:Georgia,serif;max-width:760px;margin:2rem auto;padding:0 1rem;color:#262220;background:#faf8f5}
 h1{font-size:1.6rem} h2{font-size:1.2rem;margin-top:2rem}
 .cifras{display:flex;gap:1rem;flex-wrap:wrap}.cifra{background:#fff;border:1px solid #e4ddd3;padding:.8rem 1.2rem;border-radius:6px}
 .cifra b{display:block;font-size:1.6rem}
 table{width:100%;border-collapse:collapse;background:#fff}td,th{border-bottom:1px solid #e4ddd3;padding:.4rem .6rem;text-align:left}
 td:not(:first-child),th:not(:first-child){text-align:right} a{color:#7a4b2a}
</style></head><body>
<h1>Estadísticas del tablón</h1>
<p>Últimos 30 días con actividad. Se cuentan las veces que se abre el tablón, no personas distintas.</p>
<div class="cifras">
 <div class="cifra"><b>${total(ultimos, "pagina")}</b>visitas al tablón</div>
 <div class="cifra"><b>${ultimos.reduce((s, d) => s + clicsDia(d), 0)}</b>titulares abiertos</div>
 <div class="cifra"><b>${total(ultimos, "calendario")}</b>usos del calendario</div>
 <div class="cifra"><b>${total(dias, "pagina")}</b>visitas desde el inicio</div>
</div>
<h2>Titulares más leídos</h2>
${filasTop ? `<table><tr><th>Titular</th><th>Clics</th></tr>${filasTop}</table>` : "<p>Todavía no hay datos.</p>"}
<h2>Por día</h2>
${filasDias ? `<table><tr><th>Día</th><th>Visitas</th><th>Titulares</th><th>Calendario</th></tr>${filasDias}</table>` : "<p>Todavía no hay datos.</p>"}
<p><a href="/">← Volver al tablón</a></p>
</body></html>`;

  return new Response(html, {
    headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" },
  });
};

export const config = {
  path: "/estadisticas",
  method: ["GET"],
};
