// Genera la página estática: lista cronológica sobria (sin tarjetas con
// imagen), con enlace a la fuente original. No reproduce contenido de las
// fuentes, solo el titular y el enlace.

function escapeHtml(texto = "") {
  return texto
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function formatearFecha(isoString) {
  if (!isoString) return "Sin fecha";
  const d = new Date(isoString);
  if (Number.isNaN(d.getTime())) return "Sin fecha";
  return d.toLocaleDateString("es-ES", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
}

function renderizarItem(item) {
  return `
      <li class="titular">
        <span class="titular__fecha">${formatearFecha(item.fecha)}</span>
        <a class="titular__enlace" href="${escapeHtml(item.url)}" target="_blank" rel="noopener noreferrer">
          ${escapeHtml(item.titulo)}
        </a>
        <span class="titular__fuente">${escapeHtml(item.fuente)}</span>
      </li>`;
}

function renderizarSeccion(titulo, items, mensajeVacio) {
  if (!items.length) {
    return `<section>
      <h2>${escapeHtml(titulo)}</h2>
      <p class="vacio">${escapeHtml(mensajeVacio)}</p>
    </section>`;
  }
  return `<section>
      <h2>${escapeHtml(titulo)}</h2>
      <ul class="lista-titulares">${items.map(renderizarItem).join("")}
      </ul>
    </section>`;
}

export function generarPaginaHtml({ generadoEn, titulares, proximosActos }) {
  const actualizado = new Date(generadoEn).toLocaleString("es-ES", {
    dateStyle: "long",
    timeStyle: "short",
  });

  return `<!doctype html>
<html lang="es">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Noticias de la Iglesia en Sevilla</title>
<meta name="description" content="Tablón cronológico de titulares de noticias de la Iglesia en Sevilla, con enlace a la fuente original.">
<style>
  :root {
    color-scheme: light dark;
    --fondo: #faf8f4;
    --texto: #2a2622;
    --texto-tenue: #6b645c;
    --acento: #7a1f2b;
    --borde: #e4ddd2;
  }
  @media (prefers-color-scheme: dark) {
    :root {
      --fondo: #1c1a17;
      --texto: #ece7de;
      --texto-tenue: #a89f92;
      --acento: #d98b93;
      --borde: #33302a;
    }
  }
  * { box-sizing: border-box; }
  body {
    margin: 0;
    padding: 32px 16px 64px;
    background: var(--fondo);
    color: var(--texto);
    font-family: Georgia, "Times New Roman", serif;
    line-height: 1.5;
  }
  main { max-width: 720px; margin: 0 auto; }
  header { margin-bottom: 32px; text-align: center; }
  h1 {
    font-size: 1.7rem;
    font-weight: bold;
    margin: 0 0 2px;
    line-height: 1.25;
  }
  .h1-desde {
    display: block;
    font-size: 1.7rem;
    font-weight: bold;
  }
  .subtitulo {
    color: var(--texto-tenue);
    font-size: 0.95rem;
    margin: 10px 0 0;
  }
  h2 {
    font-size: 1.05rem;
    text-transform: uppercase;
    letter-spacing: 0.04em;
    color: var(--acento);
    border-bottom: 1px solid var(--borde);
    padding-bottom: 6px;
    margin: 40px 0 12px;
  }
  .lista-titulares { list-style: none; margin: 0; padding: 0; }
  .titular {
    display: flex;
    flex-wrap: wrap;
    align-items: baseline;
    gap: 4px 10px;
    padding: 10px 0;
    border-bottom: 1px solid var(--borde);
  }
  .titular__fecha {
    color: var(--texto-tenue);
    font-size: 0.82rem;
    white-space: nowrap;
    min-width: 120px;
  }
  .titular__enlace {
    color: var(--texto);
    text-decoration: none;
    flex: 1 1 320px;
  }
  .titular__enlace:hover { text-decoration: underline; }
  .titular__fuente {
    color: var(--texto-tenue);
    font-size: 0.78rem;
    font-style: italic;
    white-space: nowrap;
  }
  .vacio { color: var(--texto-tenue); font-style: italic; }
  footer {
    margin-top: 48px;
    color: var(--texto-tenue);
    font-size: 0.8rem;
    border-top: 1px solid var(--borde);
    padding-top: 16px;
  }
</style>
</head>
<body>
<main>
  <header>
  <h1 style="text-align:center">Noticias de la Iglesia<span class="h1-desde" style="font-weight:normal">Comunidad Diaconal</span><span class="h1-desde" style="font-weight:normal">- Sevilla -</span></h1>
    <p class="subtitulo">Titulares ordenados cronológicamente, con enlace a la fuente original.<br>No se reproduce el contenido de las noticias.</p>
  </header>

  ${renderizarSeccion("Próximos actos", proximosActos, "No hay actos próximos publicados por ahora.")}

  ${renderizarSeccion("Últimas noticias", titulares, "No se han encontrado titulares por ahora.")}

  <footer>
    Actualizado automáticamente el ${escapeHtml(actualizado)}. Fuentes: Archidiócesis de Sevilla, ODISUR, Catedral de Sevilla.
  </footer>
</main>
</body>
</html>
`;
}
