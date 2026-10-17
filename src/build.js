// `npm run build`: genera el tablón en local (o en cualquier máquina con
// internet) y lo escribe en data/titulares.json y public/.
//
// En producción NO se usa: en Netlify la recogida la hace cada hora la
// función programada netlify/functions/actualizar.mjs, que guarda el
// resultado en Netlify Blobs. Esto queda para probar en casa.
// Sin internet, usar `npm test` (datos de muestra).

import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { construir, DIAS_HISTORICO } from "./construir.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const RAIZ = path.resolve(__dirname, "..");
const DATA_DIR = path.join(RAIZ, "data");
const PUBLIC_DIR = path.join(RAIZ, "public");
const DATOS_JSON = path.join(DATA_DIR, "titulares.json");

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

async function main() {
  const historico = await leerHistorico();
  const { datos, archivos, nuevosEnFuentes } = await construir(historico);

  await mkdir(DATA_DIR, { recursive: true });
  await rm(path.join(PUBLIC_DIR, "actos"), { recursive: true, force: true });
  for (const [ruta, contenido] of Object.entries(archivos)) {
    const destino = path.join(PUBLIC_DIR, ruta);
    await mkdir(path.dirname(destino), { recursive: true });
    await writeFile(destino, contenido, "utf8");
  }
  await writeFile(DATOS_JSON, JSON.stringify(datos, null, 2) + "\n", "utf8");

  console.log(
    `Listo: ${datos.titulares.length} titulares (${nuevosEnFuentes} en las fuentes ahora, histórico de ${DIAS_HISTORICO} días), ${datos.proximosActos.length} próximos actos.`
  );
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("El build falló:", error);
    process.exit(1);
  });
