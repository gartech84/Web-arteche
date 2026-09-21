# Web Gonzalo Arteche Arquitecto — versión de prueba

Todo el sitio son archivos sueltos: no necesita servidor, base de datos ni programas.
Se puede subir a cualquier hosting. Estas instrucciones usan Cloudflare Pages, que es gratis.

## Qué hay en la carpeta

- `index.html` — landing (página de inicio)
- `estudio.html` — Estudio
- `metodologia.html` — Metodología de trabajo
- `contacto.html` — Contacto con formulario
- `proyectos.html`, `iniciar-proyecto.html` — páginas en preparación
- `404.html` — página de error
- `favicon.svg` — ícono del sitio
- `img/` — las fotos

## Subirla a internet (unos 20 minutos)

1. Crea una cuenta en github.com (gratis).
2. En GitHub: botón **+** arriba a la derecha → **New repository**.
   Nombre: `web-arteche`. Deja **Public**. Crear.
3. En el repositorio recién creado: **uploading an existing file**.
   Arrastra TODO lo que está dentro de esta carpeta (incluida la carpeta `img`) y abajo **Commit changes**.
4. Crea una cuenta en dash.cloudflare.com (gratis).
5. En Cloudflare: **Workers & Pages** → **Create** → pestaña **Pages** → **Connect to Git**.
   Autoriza GitHub, elige `web-arteche`.
6. En la configuración de compilación deja todo vacío:
   - Framework preset: **None**
   - Build command: **vacío**
   - Build output directory: **/** (la raíz)
   Luego **Save and Deploy**.
7. En 1 o 2 minutos queda publicada en una dirección tipo
   `https://web-arteche.pages.dev`. Esa es la versión de prueba.

Tu web actual en Wix no se toca: sigue funcionando igual.

## Cómo actualizar algo

Editas o reemplazas el archivo en GitHub y Cloudflare vuelve a publicar solo, en un par de minutos.
Para cambiar una foto, sube otra con el mismo nombre dentro de `img/`.

## Activar las analíticas (gratis)

En Cloudflare, dentro de tu proyecto de Pages: pestaña **Metrics** o **Web Analytics** → activar.
No usa cookies, así que no necesita aviso de cookies.

## Hacer que el formulario llegue a tu correo

Hoy el formulario valida los datos y muestra "Gracias", pero todavía no envía nada.
Para activarlo:

1. Crea una cuenta gratuita en formspree.io (o web3forms.com).
2. Crea un formulario nuevo y copia la dirección que te entregan
   (algo como `https://formspree.io/f/xxxxxxx`).
3. Abre `contacto.html`, busca la palabra `PENDIENTE` (está cerca de `<form class="cform"`)
   y reemplázala por esa dirección.
4. Sube el archivo corregido a GitHub. Listo: los formularios te llegan por correo.

## Pendientes conocidos

- Las fotos de `estudio.html` y `contacto.html` salieron de capturas de pantalla: conviene
  reemplazarlas por los archivos originales en buena resolución.
- Las etapas de la metodología son una propuesta y hay que revisarlas.
- Falta el portafolio de proyectos.
