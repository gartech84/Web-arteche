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
for (const p of proyectos) {
  const galeria = (p.galeria || []).filter(g => g && g.foto);
  if (!p.portada && !galeria.length) continue; // sin fotos: solo aparece en la grilla como "Foto pendiente"
  p.pagina = `${p.slug}.html`;
  const datos = [
    ['Ubicación', p.ubicacion], ['Año', p.anio], ['Superficie', p.superficie ? `${p.superficie} m²` : ''],
    ['Pisos', p.pisos], ['Estado', p.estado], ['Categoría', CAT1[p.categoria] || p.categoria], ['Materialidad', p.materialidad]
  ].filter(([, v]) => v !== undefined && v !== null && String(v).trim() !== '');
  const ficha = datos.map(([k, v]) => `<div class="dato"><dt>${k}</dt><dd>${esc(v)}</dd></div>`).join('');
  const programa = (p.programa || []).filter(Boolean).map(r => `<li>${esc(r)}</li>`).join('');
  const nota = p.renders ? '<p class="nota">Imágenes: renders del proyecto.</p>' : '';
  let gal = '';
  for (const [i, g] of galeria.entries()) {
    const f = await photo(g.foto); if (!f) continue;
    const forma = FORM[g.formato] || 'sq', pos = POS[g.encuadre] || POS['Centro'];
    const alt = esc(g.descripcion || `${p.nombre}, imagen ${i + 1}`);
    // el navegador elige la versión grande cuando la foto ocupa mucho ancho (pantallas grandes o de alta densidad)
    const sizes = (forma === 'wide' || forma === 'pano') ? '(min-width:1600px) 1520px, 94vw' : '(min-width:700px) 47vw, 94vw';
    const srcset = f.sm !== f.lg ? ` srcset="${f.sm} 900w, ${f.lg} 2000w" sizes="${sizes}"` : '';
    gal += `<li class="g-item g-${forma}"><button type="button" class="g-btn" data-i="${i}" aria-label="Ampliar imagen ${i + 1}: ${alt}"><img src="${f.sm}"${srcset} data-full="${f.lg}" alt="${alt}" loading="lazy" style="object-position:${pos}"></button></li>`;
  }
  const port = await photo(p.portada || galeria[0]?.foto);
  const desc = [p.nombre, [CAT1[p.categoria] ? CAT1[p.categoria].toLowerCase() : '', p.ubicacion ? `en ${p.ubicacion}` : ''].filter(Boolean).join(' '), p.superficie ? `${p.superficie} m²` : ''].filter(Boolean).join(', ') + '. Proyecto de Gonzalo Arteche Arquitecto.';
  const html = tplP.replaceAll('%%NOMBRE%%', esc(p.nombre)).replaceAll('%%DESC%%', esc(desc)).replace('%%OGIMG%%', port ? port.lg : 'img/portada.jpg')
    .replace('%%FICHA%%', ficha).replace('%%PROGRAMA%%', programa).replace('%%NOTA%%', nota).replace('%%GALERIA%%', gal);
  fs.writeFileSync(path.join(OUT, p.pagina), html);
}

// 5) Grilla de proyectos
let cards = '';
for (const p of proyectos) {
  const port = await photo(p.portada || (p.galeria || [])[0]?.foto);
  const meta = [p.ubicacion, p.anio, p.superficie ? `${p.superficie} m²` : ''].filter(Boolean).join(' · ');
  const badge = p.estado && p.estado !== 'Construido' ? `<span class="badge">${esc(p.estado)}</span>` : '';
  const media = port ? `<img src="${port.sm}"${port.sm !== port.lg ? ` srcset="${port.sm} 900w, ${port.lg} 2000w" sizes="(min-width:1100px) 31vw, (min-width:620px) 47vw, 94vw"` : ''} alt="${esc(p.nombre)}" loading="lazy">${badge}` : '<span class="soon">Foto pendiente</span>';
  const open = p.pagina ? `<a href="${p.pagina}">` : '<a>';
  cards += `        <li class="card" data-cat="${esc(p.categoria)}">
          ${open}
            <span class="card-ph">${media}</span>
            <span class="card-info">
              <span class="card-t">${esc(p.nombre)}</span>
              ${meta ? `<span class="card-m">${esc(meta)}</span>` : ''}
            </span>
          </a>
        </li>\n`;
}
const primera = proyectos.find(p => p.portada);
const og = primera ? (await photo(primera.portada)).lg : 'img/portada.jpg';
const idx = fs.readFileSync('templates/proyectos.html', 'utf8')
  .replace('%%CARDS%%', cards.trimEnd()).replace('%%COUNT%%', `${proyectos.length} proyectos`).replace('%%OGIMG%%', og);
fs.writeFileSync(path.join(OUT, 'proyectos.html'), idx);

console.log(`Listo: ${proyectos.length} proyectos en la grilla, ${proyectos.filter(p => p.pagina).length} con ficha propia.`);
