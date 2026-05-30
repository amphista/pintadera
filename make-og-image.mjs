/**
 * make-og-image.mjs — generates og-image.png (1200×630) for Pintadera.
 *
 * The social card is authored as an SVG (fully editable below) and rasterised
 * to PNG with sharp, so it runs anywhere `npm install` works — no headless
 * browser / Chromium download required. Re-run after changing the copy:
 *
 *     npm run og
 *
 * Note on fonts: this uses system serif/mono fonts (Liberation Serif / DejaVu
 * Sans Mono) so it's reproducible in CI. For a pixel-faithful match to the live
 * site's Fraunces + JetBrains Mono, install those font files locally before
 * running, or swap the font-family names below.
 */
import sharp from 'sharp';
import { writeFileSync } from 'node:fs';

const W = 1200, H = 630;

// palette — mirrors the :root tokens in index.html
const C = {
  bg: '#0c0d10', glow1: '#1d1f27', glow2: '#181a22',
  keyTop: '#2b2d36', keyBot: '#191b21', keyEdge: '#3a3d48',
  ink: '#f2efe6', inkDim: '#9a9ba6', inkFaint: '#5d5f6b',
  amber: '#e9b04a', amberSoft: '#caa15a', line: '#26282f',
};

// decorative glyph grid (right side) — glyphs chosen to render in DejaVu Sans
const GLYPHS = ['★','→','❤','§','∞','♪','µ','¶','÷','№','☼','±','≈','♫','☆','✓','π','∑','♯','€'];
const cols = 5, rows = 4, cell = 96, pad = 14;
const gridW = cols * cell, gridH = rows * cell;
const gx = W - gridW - 64, gy = (H - gridH) / 2 - 8;

let keys = '';
for (let r = 0; r < rows; r++) {
  for (let c = 0; c < cols; c++) {
    const i = r * cols + c;
    const x = gx + c * cell, y = gy + r * cell;
    const g = GLYPHS[i % GLYPHS.length];
    const accent = (i === 6); // one amber "hero" key
    keys += `
    <g opacity="${accent ? 1 : 0.5}">
      <rect x="${x + pad}" y="${y + pad}" width="${cell - pad * 2}" height="${cell - pad * 2}"
            rx="14" fill="url(#key)" stroke="${accent ? C.amber : C.keyEdge}" stroke-width="${accent ? 1.5 : 1}"/>
      <text x="${x + cell / 2}" y="${y + cell / 2}" font-family="DejaVu Sans, sans-serif" font-size="34"
            fill="${accent ? C.amber : C.inkDim}" text-anchor="middle" dominant-baseline="central">${g}</text>
    </g>`;
  }
}

const svg = `<svg width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <radialGradient id="g1" cx="72%" cy="-12%" r="62%">
      <stop offset="0" stop-color="${C.glow1}"/>
      <stop offset="0.62" stop-color="${C.bg}" stop-opacity="0"/>
    </radialGradient>
    <radialGradient id="g2" cx="-6%" cy="112%" r="58%">
      <stop offset="0" stop-color="${C.glow2}"/>
      <stop offset="0.56" stop-color="${C.bg}" stop-opacity="0"/>
    </radialGradient>
    <linearGradient id="key" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="${C.keyTop}"/>
      <stop offset="1" stop-color="${C.keyBot}"/>
    </linearGradient>
  </defs>

  <rect width="${W}" height="${H}" fill="${C.bg}"/>
  <rect width="${W}" height="${H}" fill="url(#g1)"/>
  <rect width="${W}" height="${H}" fill="url(#g2)"/>

  <!-- decorative key grid -->
  ${keys}
  <rect width="${W}" height="${H}" fill="${C.bg}" opacity="0.34"/>

  <!-- logo key (echoes the favicon) -->
  <g>
    <rect x="80" y="150" width="84" height="84" rx="18" fill="url(#key)" stroke="${C.keyEdge}"/>
    <text x="122" y="196" font-family="DejaVu Sans, sans-serif" font-size="46" fill="${C.amber}"
          text-anchor="middle" dominant-baseline="central">★</text>
  </g>

  <!-- wordmark: "Pintad" + italic amber "era" -->
  <text x="78" y="320" font-family="Liberation Serif, Georgia, serif" font-weight="bold"
        font-size="118" letter-spacing="-1">
    <tspan fill="${C.ink}">Pintad</tspan><tspan fill="${C.amber}" font-style="italic">era</tspan>
  </text>

  <!-- tagline -->
  <text x="82" y="392" font-family="DejaVu Sans Mono, monospace" font-size="30" fill="${C.ink}">
    Click-to-copy Unicode symbols, glyphs &amp; emoji.
  </text>
  <text x="82" y="438" font-family="DejaVu Sans Mono, monospace" font-size="22" fill="${C.inkDim}">
    8,000+ glyphs · real per-OS preview · search by name or code point
  </text>

  <!-- credit -->
  <text x="82" y="540" font-family="DejaVu Sans Mono, monospace" font-size="20" fill="${C.amberSoft}">
    A Two Actual Eyes tool
    <tspan fill="${C.inkFaint}">  ·  no ads, no tracking</tspan>
  </text>

  <!-- inner frame -->
  <rect x="2" y="2" width="${W - 4}" height="${H - 4}" rx="0" fill="none" stroke="${C.line}" stroke-width="2"/>
</svg>`;

writeFileSync('og-image.svg', svg);
await sharp(Buffer.from(svg)).png().toFile('og-image.png');
console.log('Wrote og-image.svg and og-image.png (1200×630).');
