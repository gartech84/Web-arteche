// Arma la web en la carpeta dist/ a partir de las páginas fijas, las plantillas y las fichas de content/proyectos.
// Si "sharp" está disponible, optimiza las fotos (1600 px y miniatura de 900 px); si no, las copia tal cual.
import fs from 'node:fs';
import path from 'node:path';

const OUT = 'dist';
const esc = s => String(s ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
const slugify = s => String(s).normalize('NFKD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'');

let sharp = null;
try { sharp = (await import('sharp')).default; } catch { console.log('sharp no disponible: las fotos se copian sin optimizar'); }

fs.rmSync(OUT, { recursive: true, force: true });
fs.mkdirSync(OUT, { recursive: true });

// 1) Copiar páginas fijas, íconos e imágenes generales
const copyDir = (src, dst) => { if (!fs.existsSync(src)) return; fs.mkdirSync(dst, { recursive: true });
  for (const f of fs.readdirSync(src)) { const a = path.join(src, f), b = path.join(dst, f);
    fs.statSync(a).isDirectory() ? copyDir(a, b) : fs.copyFileSync(a, b); } };
for (const f of fs.readdirSync('.')) {
  if (/\.(html|svg|ico|png|txt|xml)$/i.test(f) && fs.statSync(f).isFile()) fs.copyFileSync(f, path.join(OUT, f));
}
copyDir('img', path.join(OUT, 'img'));

// 2) Fotos de proyectos: versión grande y miniatura
const done = new Map();
async function photo(url) {
  if (!url) return null;
  if (done.has(url)) return done.get(url);
  const rel = url.replace(/^\//, '');
  if (!fs.existsSync(rel)) { console.warn('No encontré la foto', rel); return null; }
  const dir = path.dirname(rel), base = path.basename(rel, path.extname(rel));
  fs.mkdirSync(path.join(OUT, dir), { recursive: true });
  let r;
  if (sharp) {
    const lg = `${dir}/${base}.jpg`, sm = `${dir}/${base}-sm.jpg`;
    await sharp(rel).rotate().resize({ width: 2000, height: 2000, fit: 'inside', withoutEnlargement: true }).flatten({ background: '#ffffff' }).jpeg({ quality: 82, mozjpeg: true }).toFile(path.join(OUT, lg));
    await sharp(rel).rotate().resize({ width: 900, height: 900, fit: 'inside', withoutEnlargement: true }).flatten({ background: '#ffffff' }).jpeg({ quality: 76, mozjpeg: true }).toFile(path.join(OUT, sm));
    r = { lg, sm };
  } else {
    fs.copyFileSync(rel, path.join(OUT, rel)); r = { lg: rel, sm: rel };
  }
  done.set(url, r); return r;
}

// Recorte exacto (misma proporción que el marco donde se muestra), para que fotos
// panorámicas o verticales no se vean pixeladas al llenar un marco de otra forma.
const doneC = new Map();
async function crop(url, sizes) { // sizes: [[ancho, alto], ...] de menor a mayor
  if (!url) return null;
  const key = url + JSON.stringify(sizes);
  if (doneC.has(key)) return doneC.get(key);
  const base = await photo(url);
  if (!base || !sharp) { doneC.set(key, base && { src: base.lg, srcset: '' }); return doneC.get(key); }
  const rel = url.replace(/^\//, '');
  const dir = path.dirname(rel), name = path.basename(rel, path.extname(rel));
  const out = [];
  for (const [w, h] of sizes) {
    const f = `${dir}/${name}-${w}x${h}.jpg`;
    await sharp(rel).rotate().resize({ width: w, height: h, fit: 'cover', position: 'centre' }).flatten({ background: '#ffffff' }).jpeg({ quality: 80, mozjpeg: true }).toFile(path.join(OUT, f));
    out.push(`${f} ${w}w`);
  }
  const r = { src: out[0].split(' ')[0], srcset: ` srcset="${out.join(', ')}"` };
  doneC.set(key, r); return r;
}

// 3) Leer fichas
const CAT1 = { 'Casas': 'Casa', 'Comercial': 'Comercial', 'Quinchos y remodelaciones': 'Quincho o remodelación' };
const FORM = { 'Cuadrada': 'sq', 'Vertical': 'tall', 'Horizontal': 'wide', 'Panorámica': 'pano' };
const POS = { 'Arriba': 'center 25%', 'Centro': 'center 50%', 'Abajo': 'center 75%' };
const dirP = 'content/proyectos';
const proyectos = fs.readdirSync(dirP).filter(f => f.endsWith('.json')).map(f => {
  const d = JSON.parse(fs.readFileSync(path.join(dirP, f), 'utf8'));
  d.slug = slugify(path.basename(f, '.json')) || slugify(d.nombre);
  return d;
}).filter(p => p.visible !== false)
  .sort((a, b) => (a.orden ?? 9999) - (b.orden ?? 9999) || a.nombre.localeCompare(b.nombre, 'es'));

// 4) Fichas individuales
const tplP = fs.readFileSync('templates/proyecto.html', 'utf8');

// Título y descripción para Google de cada ficha. El nombre visible del proyecto no cambia.
// Se arman con la categoría, la ubicación y la superficie que ya están en el CMS, para que la gente
// encuentre la casa buscando el lugar ("casa de playa en Maitencillo") y no solo el nombre del proyecto.
// Si en el CMS se llenan "Título para Google" o "Descripción para Google", se usan esos textos tal cual.
const PLAYA = ['maitencillo', 'santo domingo', 'pichilemu', 'zapallar', 'cachagua', 'papudo', 'tunquén', 'matanzas', 'puchuncaví', 'algarrobo', 'navidad', 'la ligua'];
const LAGO = ['lago ranco', 'futrono', 'puerto varas', 'frutillar', 'llanquihue', 'pucón', 'villarrica', 'panguipulli'];
const TIPO = { 'Casas': 'casa', 'Quinchos': 'quincho', 'Remodelaciones': 'remodelación', 'Comercial': 'proyecto comercial' };
function seoProyecto(p) {
  const nombre = (p.nombre || '').trim();
  const ubic = (p.ubicacion || '').trim();
  const lugar = ubic.split(',')[0].trim();
  const l = lugar.toLowerCase();
  let tipo = TIPO[p.categoria] || '';
  if (tipo === 'casa' && PLAYA.includes(l)) tipo = 'casa de playa';
  else if (tipo === 'casa' && LAGO.includes(l)) tipo = 'casa de lago';
  // "Casa Maitenes, casa de playa en Maitencillo". Si el nombre ya dice el tipo ("Quincho Matte"), basta con "Quincho Matte en La Reina".
  const sobra = !tipo || tipo === 'proyecto comercial' || nombre.toLowerCase() === tipo || nombre.toLowerCase().startsWith(tipo + ' ');
  let auto = sobra ? nombre : `${nombre}, ${tipo}`;
  if (lugar) auto += ` en ${lugar}`;
  const titulo = ((p.titulo_google || '').trim() || auto) + ' | Gonzalo Arteche Arquitecto';
  const queEs = tipo ? tipo[0].toUpperCase() + tipo.slice(1) : 'Proyecto';
  const base = [queEs, p.superficie ? `de ${p.superficie} m²` : '', ubic ? `en ${ubic}` : ''].filter(Boolean).join(' ')
    + `. ${nombre}, proyecto de Gonzalo Arteche Arquitecto.`;
  const encargo = (p.encargo || '').trim().replace(/\s+/g, ' ');
  let desc = (p.descripcion_google || '').trim();
  if (!desc) {
    desc = encargo ? `${base} ${encargo}` : base;
    if (desc.length > 158) desc = desc.slice(0, 155).replace(/[\s,.;:]+\S*$/, '') + '…';
  }
  return { titulo, desc, largo: auto };
}

// Páginas de zona: agrupan las casas de un lugar para que Google las muestre en búsquedas como
// "arquitecto Maitencillo". Se arman solas con las casas del CMS cuya ubicación calza con "lugares".
// No se agregan al menú: se enlazan desde /proyectos ("Por zona") y desde la ubicación de cada ficha.
const ZONAS = [
  { pagina: 'casas-en-maitencillo.html', corto: 'Maitencillo', donde: 'Maitencillo',
    lugares: ['maitencillo'],
    titulo: 'Arquitecto en Maitencillo, casas a medida',
    desc: 'Diseño y construcción de casas a medida en Maitencillo, con constructoras de confianza que conocen la zona. Mira las casas que hemos proyectado ahí.',
    lema: 'Casas a medida en Maitencillo.' },
  { pagina: 'casas-en-santo-domingo.html', corto: 'Santo Domingo y Pichilemu', donde: 'Santo Domingo y Pichilemu',
    terreno: 'Santo Domingo, Pichilemu o el litoral central',
    lugares: ['santo domingo', 'pichilemu', 'algarrobo', 'el quisco', 'el tabo', 'cartagena', 'las cruces', 'navidad', 'matanzas', 'tunquén'],
    titulo: 'Arquitecto en Santo Domingo y Pichilemu, casas a medida',
    desc: 'Diseño y construcción de casas a medida en Santo Domingo, Pichilemu y el litoral central, con constructoras de confianza que conocen la zona.',
    lema: 'Casas a medida en Santo Domingo y Pichilemu.' },
  { pagina: 'casas-en-el-sur.html', corto: 'Sur de Chile', donde: 'el sur de Chile',
    lugares: ['lago ranco', 'futrono', 'puerto varas', 'frutillar', 'llanquihue', 'pucón', 'villarrica', 'panguipulli', 'valdivia', 'villa cerro castillo'],
    titulo: 'Arquitecto en Lago Ranco, Futrono y Puerto Varas',
    desc: 'Diseño y construcción de casas a medida en el sur de Chile: Lago Ranco, Futrono, Puerto Varas y los lagos. Constructoras de confianza que conocen la zona.',
    lema: 'Casas a medida en el sur de Chile.',
    extra: 'Trabajamos en Lago Ranco, Futrono, Puerto Varas y el resto de los lagos del sur.' }
];
const lugarDe = p => ((p.ubicacion || '').split(',')[0] || '').trim().toLowerCase();
const zonaDe = p => p.categoria === 'Casas' ? ZONAS.find(z => z.lugares.includes(lugarDe(p))) : undefined;

for (const p of proyectos) {
  const galeria = (p.galeria || []).filter(g => g && g.foto);
  if (!p.portada && !galeria.length) continue; // sin fotos: solo aparece en la grilla como "Foto pendiente"
  p.pagina = `${p.slug}.html`;
  const datos = [
    ['Ubicación', p.ubicacion], ['Año', p.anio], ['Superficie', p.superficie ? `${p.superficie} m²` : ''],
    ['Pisos', p.pisos], ['Materialidad', p.materialidad] // Estado y Categoría no se muestran en la ficha (siguen usándose en los filtros)
  ].filter(([, v]) => v !== undefined && v !== null && String(v).trim() !== '');
  const zp = zonaDe(p);
  const ficha = datos.map(([k, v]) => `<div class="dato"><dt>${k}</dt><dd>${k === 'Ubicación' && zp ? `<a href="${zp.pagina}" style="text-decoration:underline;text-underline-offset:3px">${esc(v)}</a>` : esc(v)}</dd></div>`).join('');
  const programa = (p.programa || []).filter(Boolean).map(r => `<li>${esc(r)}</li>`).join('');
  const nota = p.renders ? '<p class="nota">Imágenes: renders del proyecto.</p>' : '';
  const encargo = (p.encargo || '').trim()
    ? `<div class="encargo"><h2 class="label">Encargo</h2>${p.encargo.trim().split(/\n\s*\n/).map(t => `<p>${esc(t.trim())}</p>`).join('')}</div>`
    : '';
  const portSrc = p.portada || galeria[0]?.foto; // foto cuadrada que abre la ficha
  const { titulo: tituloSeo, desc, largo } = seoProyecto(p);
  let gal = '';
  for (const [i, g] of galeria.entries()) {
    if (g.foto === portSrc) continue; // ya se muestra arriba
    const f = await photo(g.foto); if (!f) continue;
    const forma = FORM[g.formato] || 'sq', pos = POS[g.encuadre] || POS['Centro'];
    const alt = esc(g.descripcion || `${largo}, ${p.renders ? 'render' : 'imagen'} ${i + 1}`);
    // el navegador elige la versión grande cuando la foto ocupa mucho ancho (pantallas grandes o de alta densidad)
    const sizes = (forma === 'wide' || forma === 'pano') ? '(min-width:1600px) 1520px, 94vw' : '(min-width:700px) 47vw, 94vw';
    const srcset = f.sm !== f.lg ? ` srcset="${f.sm} 900w, ${f.lg} 2000w" sizes="${sizes}"` : '';
    gal += `<li class="g-item g-${forma}"><button type="button" class="g-btn" data-i="${i}" aria-label="Ampliar imagen ${i + 1}: ${alt}"><img src="${f.sm}"${srcset} data-full="${f.lg}" alt="${alt}" loading="lazy" style="object-position:${pos}"></button></li>`;
  }
  const port = await photo(p.portada || galeria[0]?.foto);
  const sq = await crop(portSrc, [[800, 800], [1400, 1400]]);
  const fotoHtml = sq ? `<figure class="p-foto"><img src="${sq.src}"${sq.srcset} sizes="(min-width:900px) 50vw, 100vw" alt="${esc(largo)}" fetchpriority="high"></figure>` : '';
  const tplUse = programa ? tplP : tplP.replace(/\s*<h2 class="label">Programa<\/h2>\s*<ul class="recintos">%%PROGRAMA%%<\/ul>/, '');
  const html = tplUse.replaceAll('%%TITULO%%', esc(tituloSeo)).replaceAll('%%NOMBRE%%', esc(p.nombre)).replaceAll('%%DESC%%', esc(desc)).replace('%%OGIMG%%', port ? port.lg : 'img/portada.jpg')
    .replace('%%FOTO%%', fotoHtml).replace('%%FICHA%%', ficha).replace('%%PROGRAMA%%', programa).replace('%%NOTA%%', nota).replace('%%ENCARGO%%', encargo).replace('%%GALERIA%%', gal);
  fs.writeFileSync(path.join(OUT, p.pagina), html);
}

// 5) Grilla de proyectos
async function tarjeta(p) {
  const port = await photo(p.portada || (p.galeria || [])[0]?.foto);
  const meta = [p.ubicacion, p.anio, p.superficie ? `${p.superficie} m²` : ''].filter(Boolean).join(' · ');
  const badge = p.estado && p.estado !== 'Construido' ? `<span class="badge">${esc(p.estado)}</span>` : '';
  const th = await crop(p.portada || (p.galeria || [])[0]?.foto, [[640, 800], [1120, 1400]]);
  const media = th ? `<img src="${th.src}"${th.srcset} sizes="(min-width:1100px) 31vw, (min-width:620px) 47vw, 94vw" alt="${esc(seoProyecto(p).largo)}" loading="lazy">${badge}` : '<span class="soon">Foto pendiente</span>';
  const open = p.pagina ? `<a href="${p.pagina}">` : '<a>';
  return `        <li class="card" data-cat="${esc(p.categoria)}">
          ${open}
            <span class="card-ph">${media}</span>
            <span class="card-info">
              <span class="card-t">${esc(p.nombre)}</span>
              ${meta ? `<span class="card-m">${esc(meta)}</span>` : ''}
            </span>
          </a>
        </li>\n`;
}
let cards = '';
for (const p of proyectos) cards += await tarjeta(p);
const primera = proyectos.find(p => p.portada);
const og = primera ? (await photo(primera.portada)).lg : 'img/portada.jpg';
const tplIdx = fs.readFileSync('templates/proyectos.html', 'utf8');
const conCasas = ZONAS.map(z => ({ z, casas: proyectos.filter(p => zonaDe(p) === z) })).filter(x => x.casas.length);
const zonasNav = conCasas.length
  ? `<nav class="zonas" aria-label="Casas por zona"><span class="zonas-t">Casas por zona</span>${conCasas.map(({ z }) => `<a class="zchip" href="${z.pagina}">${esc(z.corto)}</a>`).join('')}</nav>`
  : '';
const idx = tplIdx
  .replace('%%CARDS%%', cards.trimEnd()).replace('%%COUNT%%', `${proyectos.length} ${proyectos.length === 1 ? 'proyecto seleccionado' : 'proyectos seleccionados'}`).replace('%%OGIMG%%', og)
  .replace('%%ZONAS%%', zonasNav);
fs.writeFileSync(path.join(OUT, 'proyectos.html'), idx);

// 5b) Páginas de zona (mismo diseño que /proyectos, sin filtros y con llamado a contacto)
const WA = 'https://wa.me/56992511880';
const flecha = '<svg class="arrow" viewBox="0 0 27 20" aria-hidden="true"><path d="M1 10h25M17 1l9 9-9 9"/></svg>';
for (const { z, casas } of conCasas) {
  const m2 = casas.map(p => Number(p.superficie)).filter(Boolean);
  const n = casas.length;
  const rango = m2.length > 1 ? `, de ${Math.min(...m2)} a ${Math.max(...m2)}\u00a0m²` : m2.length ? ` de ${m2[0]}\u00a0m²` : '';
  const intro = `${n === 1 ? 'Esta es la casa' : `Estas son las ${n} casas`} que hemos proyectado en ${z.donde}${rango}.${z.extra ? ' ' + z.extra : ''}`;
  let zc = '';
  for (const p of casas) zc += await tarjeta(p);
  const portZ = casas.find(p => p.portada);
  const ogZ = portZ ? (await photo(portZ.portada)).lg : og;
  const titulo = `${z.titulo} | Gonzalo Arteche Arquitecto`;
  const cta = `
  <section class="cta" aria-labelledby="t-cta">
    <div class="wrap">
      <h2 class="h2" id="t-cta">¿Tienes un terreno en ${esc(z.terreno || z.donde)}?</h2>
      <p class="body">Nos hacemos cargo del diseño, la documentación para construir y la coordinación de la ITO. La obra la ejecutan constructoras de nuestra confianza que conocen la zona, y tú tienes un solo responsable de principio a fin.</p>
      <p class="body">Cuéntanos qué casa necesitas y coordinamos una reunión, virtual o presencial. También diseñamos y construimos en el resto de Chile.</p>
      <div class="actions">
        <a class="pill" href="contacto.html">Hablemos de tu casa${flecha}</a>
        <a class="pill pill-line" href="${WA}" target="_blank" rel="noopener">Escríbenos por WhatsApp${flecha}</a>
      </div>
    </div>
  </section>
</main>`;
  const html = tplIdx
    .replace(/<title>[^<]*<\/title>/, `<title>${esc(titulo)}</title>`)
    .replace(/<meta name="description" content="[^"]*">/, `<meta name="description" content="${esc(z.desc)}">`)
    .replace(/<meta property="og:title" content="[^"]*">/, `<meta property="og:title" content="${esc(titulo)}">`)
    .replace(/<meta property="og:description" content="[^"]*">/, `<meta property="og:description" content="${esc(z.desc)}">`)
    .replace(/<h1 class="label page-label">[^<]*<\/h1>\s*<p class="page-title">[^<]*<\/p>\s*<p class="page-intro">[^<]*<\/p>/,
      `<a class="label page-label back" href="proyectos.html" aria-label="Volver a Proyectos"><svg class="back-ic" viewBox="0 0 24 24" aria-hidden="true"><path d="M20 12H4M10 6l-6 6 6 6"/></svg>Proyectos</a>\n    <h1 class="page-title">${esc(z.lema)}</h1>\n    <p class="page-intro">${esc(intro)}</p>`)
    .replace(/<div class="filters"[\s\S]*?<\/div>\s*/, '')
    .replace('%%ZONAS%%', '')
    .replace('%%COUNT%%', `${n} ${n === 1 ? 'casa' : 'casas'} en ${esc(z.donde)}`)
    .replace('%%CARDS%%', zc.trimEnd())
    .replace('%%OGIMG%%', ogZ)
    .replace(/\s*<\/main>/, cta);
  fs.writeFileSync(path.join(OUT, z.pagina), html);
}


// 5c) Redirecciones desde las direcciones antiguas de Wix
const redir = [
  ['/faq', '/metodologia'], ['/service-page/consultation-session', '/contacto'],
  ['/portfolio', '/proyectos'], ['/residenciales', '/proyectos'], ['/comerciales', '/proyectos'],
  ['/vertientes', '/casa-las-vertientes'], ['/casapolo', '/proyectos'], ['/oficinaschulze', '/proyectos'],
  ['/casanaltagua', '/proyectos'], ['/simpli', '/proyectos'],
  ['/portfolio-collections/my-portfolio/proyecto-sin-título-2efb57', '/casa-campo-viejo'],
  ['/portfolio-collections/my-portfolio/proyecto-sin-título', '/casa-el-arrayan'],
  ['/portfolio-collections/my-portfolio/modern-living-spaces', '/casa-las-vertientes'],
  // El blog no se migra: sus 7 entradas y la portada del blog se redirigen a Contacto
  ['/blog', '/contacto'],
  ['/post/todos-me-preguntan-cuánto-cuesta-construir-una-casa-en-chile-aquí-te-dejo-una-guía-breve-y-realis', '/contacto'],
  ['/post/todos-me-preguntan-cuánto-cuesta-construir-una-casa-en-chile-aquí-te-dejo-una-guáa-breve-y-realis', '/contacto'],
  ['/post/todos-me-preguntan-cuánto-cuesta-construir-una-casa-en-chile-aquí-te-dejo-una-guáia-breve-y-realis', '/contacto'],
  ['/post/qué-son-los-proyectos-de-especialidades', '/contacto'],
  ['/post/cómo-es-el-desarrollo-de-un-proyecto-de-arquitectura-aquí-te-detallo-nuestra-metodología', '/contacto'],
  ['/post/cómo-integrar-el-levantamiento-topográfico-en-tu-proyecto-arquitectónico', '/contacto'],
  ['/post/paneles-sip-y-fachadas-ventiladas-de-madera-una-combinación-sostenible-y-eficiente', '/contacto'],
  ['/post/dondeconstruirlacasasoñada', '/contacto'],
  ['/post/cómo-elegir-un-estudio-de-arquitectura-en-chile', '/contacto']
];
const lineas = [];
for (const [de, a] of redir) {
  lineas.push(`${encodeURI(de)} ${encodeURI(a)} 301`);
  if (encodeURI(de) !== de) lineas.push(`${de} ${encodeURI(a)} 301`);
}
lineas.push('/portfolio-collections/* /proyectos 301');
fs.writeFileSync(path.join(OUT, '_redirects'), lineas.join('\n') + '\n');

// 6) SEO: dirección canónica, vista previa al compartir, datos estructurados, sitemap y robots.
//    Mientras la web esté en la dirección de prueba, todas las páginas llevan "noindex" para que Google no las indexe.
//    Al migrar el dominio, en Cloudflare (Settings → Build → Variables) agrega INDEXAR = si.
const INDEXAR = String(process.env.INDEXAR || '').toLowerCase() === 'si';
const SITE = (process.env.SITE_URL || (INDEXAR ? 'https://www.artechearquitecto.com' : 'https://web-arteche.garteche.workers.dev')).replace(/\/$/, '');
const abs = u => /^https?:/.test(u) ? u : `${SITE}/${u.replace(/^\//, '')}`;
const urlDe = f => f === 'index.html' ? `${SITE}/` : `${SITE}/${encodeURI(f.replace(/\.html$/, ''))}`;
const ESTUDIO = {
  '@type': 'ProfessionalService', '@id': `${SITE}/#estudio`,
  name: 'Gonzalo Arteche Arquitecto', url: `${SITE}/`,
  description: 'Estudio de arquitectura en Lo Barnechea, Santiago. Diseño y construcción de casas a medida en todo Chile, con constructoras de confianza.',
  logo: abs('apple-touch-icon.png'), image: abs('img/portada.jpg'),
  telephone: '+56992511880', email: 'contacto@artechearquitecto.com', foundingDate: '2014',
  address: { '@type': 'PostalAddress', addressLocality: 'Lo Barnechea', addressRegion: 'Región Metropolitana', addressCountry: 'CL' },
  // Todo Chile, más las zonas donde el estudio tiene obra (costa de la V Región y litoral, y el sur)
  areaServed: [
    { '@type': 'Country', name: 'Chile' },
    ...['Región de Valparaíso', "Región del Libertador General Bernardo O'Higgins", 'Región de Los Ríos', 'Región de Los Lagos'].map(name => ({ '@type': 'AdministrativeArea', name })),
    ...['Maitencillo', 'Zapallar', 'Santo Domingo', 'Pichilemu', 'Lago Ranco', 'Futrono', 'Puerto Varas'].map(name => ({ '@type': 'Place', name }))
  ],
  founder: { '@id': `${SITE}/estudio#gonzalo` },
  sameAs: ['https://www.instagram.com/gonzalo_arteche_arquitecto/', 'https://www.linkedin.com/in/gonzalo-arteche-rautenberg-1939b4167/', 'https://www.facebook.com/profile.php?id=100065340315698']
};
const PERSONA = {
  '@type': 'Person', '@id': `${SITE}/estudio#gonzalo`, name: 'Gonzalo Arteche Rautenberg',
  jobTitle: 'Arquitecto fundador y director', image: abs('img/gonzalo-arteche.jpg'),
  alumniOf: { '@type': 'CollegeOrUniversity', name: 'Universidad del Desarrollo' },
  worksFor: { '@id': `${SITE}/#estudio` }
};
const miga = items => ({ '@type': 'BreadcrumbList', itemListElement: items.map(([n, u], i) => ({ '@type': 'ListItem', position: i + 1, name: n, item: u })) });
const hoy = new Date().toISOString().slice(0, 10);
const enSitemap = [];
for (const f of fs.readdirSync(OUT).filter(f => f.endsWith('.html'))) {
  let h = fs.readFileSync(path.join(OUT, f), 'utf8');
  const url = urlDe(f), es404 = f === '404.html';
  const titulo = (h.match(/<title>([^<]*)<\/title>/) || [])[1] || '';
  const grafo = [];
  if (f === 'index.html') grafo.push(ESTUDIO);
  else if (f === 'estudio.html') grafo.push(PERSONA, miga([['Inicio', `${SITE}/`], ['Estudio', url]]));
  else if (f === 'proyectos.html') grafo.push(miga([['Inicio', `${SITE}/`], ['Proyectos', url]]));
  else if (ZONAS.some(z => z.pagina === f)) grafo.push(miga([['Inicio', `${SITE}/`], ['Proyectos', `${SITE}/proyectos`], [ZONAS.find(z => z.pagina === f).corto, url]]));
  else if (!es404 && !['metodologia.html', 'contacto.html', 'asesoria.html'].includes(f)) {
    const nombre = (h.match(/<h1 class="page-title">([^<]*)<\/h1>/) || [])[1] || titulo.split(' | ')[0]; // nombre visible, no el título largo para Google
    grafo.push(miga([['Inicio', `${SITE}/`], ['Proyectos', `${SITE}/proyectos`], [nombre, url]]),
      { '@type': 'CreativeWork', name: nombre, url, creator: { '@id': `${SITE}/#estudio` }, image: abs((h.match(/property="og:image" content="([^"]+)"/) || [])[1] || 'img/portada.jpg') });
  } else if (!es404) grafo.push(miga([['Inicio', `${SITE}/`], [titulo.split(' | ')[0], url]]));
  const extra = [
    es404 || !INDEXAR ? '<meta name="robots" content="noindex, nofollow">' : '',
    es404 ? '' : `<link rel="canonical" href="${url}">`,
    es404 ? '' : `<meta property="og:url" content="${url}">`,
    '<meta property="og:site_name" content="Gonzalo Arteche Arquitecto">',
    '<meta property="og:locale" content="es_CL">',
    // verificaciones de Google Search Console y Bing que ya existen en la web de Wix (se conservan para no perder la propiedad)
    f === 'index.html' ? '<meta name="google-site-verification" content="GTVVJ7urzYtj6Cm124R0wgxU_8tfCx6vz02msXK0CrY">\n<meta name="msvalidate.01" content="1471E17AC517092A185DE774794541C9">' : '',
    grafo.length ? `<script type="application/ld+json">${JSON.stringify({ '@context': 'https://schema.org', '@graph': grafo })}</script>` : ''
  ].filter(Boolean).join('\n');
  h = h.replace(/<html lang="es">/, '<html lang="es-CL">')
       .replace(/(<meta property="og:image" content=")([^"]+)(")/, (m, a, u, b) => a + abs(u) + b)
       .replace('</head>', extra + '\n</head>');
  fs.writeFileSync(path.join(OUT, f), h);
  if (!es404) enSitemap.push(url);
}
const orden = u => u === `${SITE}/` ? 0 : /estudio|metodologia|proyectos$|contacto/.test(u) ? 1 : 2;
enSitemap.sort((a, b) => orden(a) - orden(b) || a.localeCompare(b));
fs.writeFileSync(path.join(OUT, 'sitemap.xml'), `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${enSitemap.map(u => `  <url><loc>${u}</loc><lastmod>${hoy}</lastmod></url>`).join('\n')}\n</urlset>\n`);
fs.writeFileSync(path.join(OUT, 'robots.txt'), INDEXAR ? `User-agent: *\nAllow: /\n\nSitemap: ${SITE}/sitemap.xml\n` : `User-agent: *\nAllow: /\n`);

// Cloudflare Web Analytics: mide visitas sin cookies. El token se agrega en Cloudflare
// (Settings → Build → Variables → CF_ANALYTICS_TOKEN); si no está, no se agrega nada.
const CF_TOKEN = process.env.CF_ANALYTICS_TOKEN;
if (CF_TOKEN) {
  const beacon = `<script defer src="https://static.cloudflareinsights.com/beacon.min.js" data-cf-beacon='{"token": "${CF_TOKEN}"}'></script>\n`;
  for (const f of fs.readdirSync(OUT).filter(f => f.endsWith('.html'))) {
    const p = path.join(OUT, f);
    fs.writeFileSync(p, fs.readFileSync(p, 'utf8').replace('</body>', beacon + '</body>'));
  }
  console.log('Cloudflare Web Analytics: activado.');
} else {
  console.log('Cloudflare Web Analytics: sin token todavía (agrega CF_ANALYTICS_TOKEN en Cloudflare cuando lo tengas).');
}
// Borrador automático en Gmail: URL de la app de Google Apps Script (Cloudflare → Build → Variables → GMAIL_BORRADOR_URL).
const BORRADOR_URL = ((process.env.GMAIL_BORRADOR_URL || '').match(/https:\/\/script\.google\.com\/macros\/s\/[\w-]+\/exec/) || [])[0];
{
  const p = path.join(OUT, 'contacto.html');
  if (BORRADOR_URL && fs.existsSync(p)) {
    fs.writeFileSync(p, fs.readFileSync(p, 'utf8').replace('</head>', `<script>window.BORRADOR_URL="${BORRADOR_URL}";</script>\n</head>`));
    console.log('Borrador Gmail: activado.');
  } else {
    console.log(process.env.GMAIL_BORRADOR_URL ? 'Borrador Gmail: la URL no tiene el formato esperado (https://script.google.com/macros/s/…/exec).' : 'Borrador Gmail: sin GMAIL_BORRADOR_URL todavía.');
  }
}

// Umami: cuenta personas distintas sin cookies (no requiere aviso de cookies). El ID del sitio se agrega
// en Cloudflare (Settings → Build → Variables → UMAMI_ID); si no está, no se agrega nada.
const UMAMI_RAW = (process.env.UMAMI_ID || '').trim();
// Acepta el ID solo o pegado con comillas, espacios o el script completo de Umami: se extrae el código.
const UMAMI_ID = (UMAMI_RAW.match(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i) || [])[0];
if (UMAMI_ID) {
  const tag = `<script defer src="https://cloud.umami.is/script.js" data-website-id="${UMAMI_ID}"></script>\n`;
  for (const f of fs.readdirSync(OUT).filter(f => f.endsWith('.html'))) {
    const p = path.join(OUT, f);
    fs.writeFileSync(p, fs.readFileSync(p, 'utf8').replace('</head>', tag + '</head>'));
  }
  console.log(`Umami: activado (ID ${UMAMI_ID}).`);
} else if (UMAMI_RAW) {
  console.log(`Umami: no encontré un Website ID válido en UMAMI_ID. Valor recibido (${UMAMI_RAW.length} caracteres): "${UMAMI_RAW.slice(0, 60)}"`);
} else {
  console.log('Umami: sin UMAMI_ID todavía.');
}
// Pixel de Meta (ID 1097398011179341): mide visitas desde los anuncios, clics en WhatsApp (Contact)
// y formularios enviados (Lead). Se agrega a todas las páginas.
const META_PIXEL_ID = '1097398011179341';
{
  const tag = `<script>
!function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){n.callMethod?n.callMethod.apply(n,arguments):n.queue.push(arguments)};if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';n.queue=[];t=b.createElement(e);t.async=!0;t.src=v;s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s)}(window,document,'script','https://connect.facebook.net/en_US/fbevents.js');
fbq('init','${META_PIXEL_ID}');fbq('track','PageView');
document.addEventListener('click',function(e){var a=e.target.closest&&e.target.closest('a[href*="wa.me"],a[href*="whatsapp"]');if(a)fbq('track','Contact');});
document.addEventListener('DOMContentLoaded',function(){var s=document.getElementById('sent');if(!s)return;new MutationObserver(function(m,o){if(!s.hidden){fbq('track','Lead');o.disconnect();}}).observe(s,{attributes:true,attributeFilter:['hidden']});});
</script>
<noscript><img height="1" width="1" style="display:none" src="https://www.facebook.com/tr?id=${META_PIXEL_ID}&ev=PageView&noscript=1"/></noscript>
`;
  for (const f of fs.readdirSync(OUT).filter(f => f.endsWith('.html'))) {
    const p = path.join(OUT, f);
    fs.writeFileSync(p, fs.readFileSync(p, 'utf8').replace('</head>', tag + '</head>'));
  }
  console.log(`Pixel de Meta: activado (ID ${META_PIXEL_ID}).`);
}
// Etiqueta de Google Ads (AW-11294839356): mide las conversiones de la campaña de búsqueda.
// "Web - Formulario enviado" cuando aparece el aviso de mensaje enviado (#sent) y
// "Web - Clic en WhatsApp" al hacer clic en un enlace de WhatsApp. Se agrega a todas las páginas.
const GADS_ID = 'AW-11294839356';
const GADS_FORMULARIO = `${GADS_ID}/3arVCOCxx8AdELyk5okq`;
const GADS_WHATSAPP = `${GADS_ID}/3Ui6COOxx8AdELyk5okq`;
{
  const tag = `<script async src="https://www.googletagmanager.com/gtag/js?id=${GADS_ID}"></script>
<script>
window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}
gtag('js',new Date());gtag('config','${GADS_ID}');
document.addEventListener('click',function(e){var a=e.target.closest&&e.target.closest('a[href*="wa.me"],a[href*="whatsapp"]');if(a)gtag('event','conversion',{send_to:'${GADS_WHATSAPP}'});});
document.addEventListener('DOMContentLoaded',function(){var s=document.getElementById('sent');if(!s)return;new MutationObserver(function(m,o){if(!s.hidden){gtag('event','conversion',{send_to:'${GADS_FORMULARIO}'});o.disconnect();}}).observe(s,{attributes:true,attributeFilter:['hidden']});});
</script>
`;
  for (const f of fs.readdirSync(OUT).filter(f => f.endsWith('.html'))) {
    const p = path.join(OUT, f);
    fs.writeFileSync(p, fs.readFileSync(p, 'utf8').replace('</head>', tag + '</head>'));
  }
  console.log(`Google Ads: etiqueta activada (${GADS_ID}).`);
}

console.log(INDEXAR ? `SEO: indexación activada para ${SITE}` : 'SEO: modo prueba (noindex en todas las páginas)');

console.log(`Listo: ${proyectos.length} proyectos en la grilla, ${proyectos.filter(p => p.pagina).length} con ficha propia.`);
