// Contador de visitas del tablón (sin cookies ni datos personales).
// La página avisa aquí, con navigator.sendBeacon, cuando:
//   - alguien abre el tablón             -> { tipo: "pagina" }
//   - pulsa un titular                   -> { tipo: "titular", url, titulo }
//   - pulsa un botón del calendario      -> { tipo: "calendario" }
// Se guarda un resumen por día en el almacén "visitas" de Netlify Blobs.
// Las cifras se consultan en /estadisticas.

import { getStore } from "@netlify/blobs";

const ROBOTS = /bot|crawl|spider|slurp|preview|facebookexternalhit|whatsapp|telegram|curl|wget|python|headless/i;

export function diaDeHoy() {
  // Fecha de España (AAAA-MM-DD)
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Madrid" }).format(new Date());
}

export default async (req) => {
  const sinContenido = new Response(null, { status: 204 });
  if (ROBOTS.test(req.headers.get("user-agent") || "")) return sinContenido;

  let aviso;
  try {
    aviso = JSON.parse(await req.text());
  } catch {
    return sinContenido;
  }
  const tipo = ["pagina", "titular", "calendario"].includes(aviso?.tipo) ? aviso.tipo : null;
  if (!tipo) return sinContenido;

  const store = getStore({ name: "visitas", consistency: "strong" });
  const clave = `dia/${diaDeHoy()}`;
  const dia = (await store.get(clave, { type: "json" })) || { pagina: 0, calendario: 0, titulares: {} };

  if (tipo === "pagina") dia.pagina += 1;
  if (tipo === "calendario") dia.calendario += 1;
  if (tipo === "titular") {
    const url = String(aviso.url || "").slice(0, 500);
    if (/^https?:\/\//.test(url)) {
      const t = dia.titulares[url] || { titulo: String(aviso.titulo || "").trim().slice(0, 200), clics: 0 };
      t.clics += 1;
      dia.titulares[url] = t;
    }
  }

  await store.setJSON(clave, dia);
  return sinContenido;
};

export const config = {
  path: "/api/visita",
  method: ["POST"],
};
