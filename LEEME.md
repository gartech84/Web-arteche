# Web Gonzalo Arteche Arquitecto — versión con panel de proyectos

## Cómo está armada

- `index.html`, `estudio.html`, `metodologia.html`, `contacto.html`, `404.html`: páginas fijas.
- `img/`: fotos de las páginas fijas.
- `content/proyectos/`: una ficha de datos por proyecto (la edita el panel).
- `media/proyectos/`: fotos de los proyectos (las sube el panel).
- `templates/`: diseño de la grilla y de la ficha de proyecto.
- `build.mjs`: arma la web completa en la carpeta `dist/` cada vez que hay un cambio.
- `.pages.yml`: configuración del panel (Pages CMS).

La página de Proyectos y las fichas individuales ya no se suben a mano: se generan solas
a partir de `content/proyectos` cada vez que guardas algo en el panel.

## Configuración en Cloudflare (una sola vez)

Proyecto web-arteche → Settings → Build:

- Build command: `npm install && npm run build`
- Deploy command: `npx wrangler deploy --assets=./dist --name web-arteche --compatibility-date 2026-09-18`

## Panel de proyectos (una sola vez)

1. Entra a app.pagescms.org y conéctate con tu cuenta de GitHub.
2. Instala la app de Pages CMS en tu cuenta y dale acceso al repositorio de la web.
3. Abre el repositorio: verás la sección «Proyectos».

## Agregar un proyecto

1. En el panel: Proyectos → New (nuevo).
2. Completa nombre, categoría, ubicación, año, superficie, estado, materialidad y programa.
3. Sube la foto de portada y agrega las fotos de la galería (una por ítem), eligiendo el formato de cada una.
4. Guarda (Save). En 2 o 3 minutos aparece en la web.

Para ocultar un proyecto sin borrarlo, desmarca «Mostrar en la web».
Para cambiar el orden en la grilla, cambia el número de «Orden».

Las fotos se optimizan solas al publicar (1600 px y miniatura de 900 px). Súbelas en buena calidad.
