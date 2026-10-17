# Tablón — Noticias de la Iglesia · Comunidad Diaconal · Sevilla

**Dirección:** https://tablon-diaconos-sevilla.netlify.app (desde el 17 oct 2026).
La antigua https://tablon-diaconos-sevilla.github.io solo redirige aquí
(carpeta `docs/`, publicada por GitHub Pages desde la rama `main`, carpeta `/docs`).

## Cómo funciona ahora (Netlify, sin GitHub Actions)

- **Recogida de titulares:** la función programada `netlify/functions/actualizar.mjs`
  se ejecuta cada hora (minuto 7) en Netlify. Guarda la página, `agenda.ics`, los
  `.ics` de cada acto y el histórico de 2 días en Netlify Blobs (almacén `tablon`).
- **Página:** `netlify/functions/pagina.mjs` la sirve desde ese almacén. El logo
  está en `public/logo.png`.
- **Publicar cambios:** al subir a `main` un cambio de código o de
  `data/agenda-clero.json`, Netlify publica solo (un deploy por cambio, no cada hora).
- **Forzar una recogida ya:** Netlify → proyecto → Functions → `actualizar` → *Run now*.
- `npm test`: pruebas con datos de muestra. `npm run build`: genera el tablón en local.

---

# Noticias de la Iglesia en Sevilla

Tablón de titulares de noticias de la Iglesia en Sevilla, ordenado
cronológicamente, con enlace a la fuente original (no se reproduce el
contenido de las noticias).

## Qué hace

1. Recoge titulares de:
   - **archisevilla.org** (RSS)
   - **odisur.es** (RSS)
   - **catedraldesevilla.es** (scraping, porque su RSS está bloqueado por robots.txt)
   - **Agenda de próximos actos** de archisevilla.org (API pública de eventos de WordPress)
2. Quita duplicados exactos por URL y ordena todo cronológicamente.
3. Genera una página estática sencilla (`public/index.html`): lista
   cronológica sobria, sin tarjetas ni imágenes.
4. Un GitHub Action (`.github/workflows/actualizar.yml`) repite este proceso
   cada hora y hace commit/push si hay titulares nuevos. Ese push dispara el
   redespliegue en Netlify o Vercel.

## Cómo subir esto a GitHub (a mano)

No hay conector de GitHub disponible desde Claude, así que este paso lo
haces tú:

1. Crea un repositorio nuevo y vacío en GitHub (no lo inicialices con
   README, .gitignore ni licencia — ya vienen en este proyecto).
2. En una terminal, dentro de esta carpeta:

   ```bash
   git remote add origin https://github.com/TU-USUARIO/TU-REPO.git
   git branch -M main
   git push -u origin main
   ```

   (Sustituye la URL por la de tu repositorio.)

## Cómo conectar el despliegue (Netlify o Vercel)

Puedes hacerlo desde el propio panel de Netlify/Vercel importando el
repositorio de GitHub, o autorizando el conector correspondiente desde
claude.ai si lo prefieres así:

- **Comando de build:** `npm run build`
- **Carpeta de publicación:** `public`

Esto ya está configurado en `netlify.toml` y `vercel.json`, así que en
la mayoría de los casos basta con importar el repositorio y aceptar los
valores por defecto que detecte la plataforma.

Una vez importado, cada `git push` a `main` (incluidos los que hace el
GitHub Action cada hora) dispara un redespliegue automático.

## Desarrollo local

```bash
npm install
npm run build   # necesita acceso normal a internet
npm run demo    # genera un ejemplo con datos de muestra, no sale a internet
npm test        # usa datos de muestra, no sale a internet
```

- `npm run build` escribe `data/titulares.json` (los datos crudos, útil para
  depurar) y `public/index.html` (la página final).
- `npm test` verifica el agregador (orden cronológico, dedupe por URL,
  tolerancia a que una fuente falle) y el generador de HTML, todo con datos
  de muestra fijos — no depende de que las webs reales estén disponibles.

## Pendiente / cosas a revisar (ver también el documento de estado técnico del Proyecto "Noticias" en claude.ai)

1. **catedraldesevilla.es**: los selectores CSS de `src/fuentes/catedral.js`
   están escritos de forma defensiva porque no se pudo comprobar el HTML
   real desde el entorno donde se escribió este código. Tras el primer
   build real, conviene revisar si siguen encontrando las noticias
   correctamente y ajustarlos si hace falta.
2. **Fase 2**: incorporar las cuentas de X de periodistas de
   Religión/Cofradías de ABC Sevilla y Diario de Sevilla (se había valorado
   usar alternativas gratuitas tipo Nitter en vez de la API de pago de X).
3. **Fase 2 (opcional)**: fusionar duplicados que cuentan el mismo suceso
   desde archisevilla.org y odisur.es bajo URLs distintas — hoy el dedupe es
   solo por URL exacta.

## Estructura del proyecto

```
src/
  fuentes/
    archisevilla.js   # RSS de archisevilla.org
    odisur.js         # RSS de odisur.es
    catedral.js       # scraping de catedraldesevilla.es
    agenda.js         # API de eventos de archisevilla.org
  agregador.js         # combina, deduplica y ordena
  generador.js         # genera public/index.html
  build.js             # script principal (npm run build)
test/                  # pruebas con datos de muestra (npm test)
data/titulares.json    # datos generados (se sobrescribe en cada build)
public/index.html      # página generada (se sobrescribe en cada build)
.github/workflows/actualizar.yml   # automatización horaria
netlify.toml / vercel.json         # configuración de despliegue
```
