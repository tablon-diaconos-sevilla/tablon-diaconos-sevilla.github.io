// Sirve el tablón (página, calendario de actos y .ics de cada acto) desde
// el almacén de Netlify Blobs que rellena cada hora actualizar.mjs.
// El logo y demás archivos fijos se sirven tal cual desde public/.

import { actualizarTablon, almacen, clavePagina, ETIQUETA_CACHE } from "../lib/tablon.mjs";

const TIPOS = {
  html: "text/html; charset=utf-8",
  ics: "text/calendar; charset=utf-8",
  json: "application/json; charset=utf-8",
};

function rutaPedida(url) {
  const ruta = decodeURIComponent(new URL(url).pathname);
  if (ruta === "/" || ruta === "/index.html") return "index.html";
  return ruta.replace(/^\/+/, "");
}

export default async (req) => {
  const ruta = rutaPedida(req.url);
  if (ruta.includes("..")) return new Response("No encontrado", { status: 404 });

  const store = almacen();
  let contenido;
  if (ruta === "titulares.json") {
    contenido = await store.get("datos.json");
  } else {
    contenido = await store.get(clavePagina(ruta));
  }

  // Primera visita tras publicar: el almacén aún está vacío, se rellena ya.
  if (contenido === null && ruta === "index.html") {
    await actualizarTablon();
    contenido = await store.get(clavePagina(ruta));
  }

  if (contenido === null) {
    return new Response("No encontrado", {
      status: 404,
      headers: { "content-type": "text/plain; charset=utf-8" },
    });
  }

  const extension = ruta.split(".").pop();
  return new Response(contenido, {
    headers: {
      "content-type": TIPOS[extension] || "application/octet-stream",
      // El navegador pregunta siempre; la caché de Netlify guarda la página
      // hasta que actualizar.mjs la vacía tras cada recogida.
      "cache-control": "public, max-age=0, must-revalidate",
      "netlify-cdn-cache-control": "public, durable, s-maxage=3600, stale-while-revalidate=86400",
      "cache-tag": ETIQUETA_CACHE,
    },
  });
};

export const config = {
  path: ["/", "/index.html", "/agenda.ics", "/titulares.json", "/actos/*"],
  method: ["GET", "HEAD"],
};
