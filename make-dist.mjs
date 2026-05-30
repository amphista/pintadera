/**
 * make-dist.mjs — assembles the deployable static site into dist/.
 *
 * The Cloudflare build runs `npm run build` (generate-data + this), then
 * `wrangler deploy` publishes ./dist. Keeping the deployed files in their own
 * folder means node_modules/ (at the repo root) is never uploaded as an asset.
 */
import { rmSync, mkdirSync, copyFileSync, existsSync } from 'node:fs';

const OUT = 'dist';
const FILES = [
  'index.html',
  'symbols-data.js',
  'symbols-data.json',
  'og-image.png',
  'pintadera-reference.html',
];

rmSync(OUT, { recursive: true, force: true });
mkdirSync(OUT, { recursive: true });

let n = 0;
for (const f of FILES) {
  if (existsSync(f)) { copyFileSync(f, `${OUT}/${f}`); n++; }
  else console.warn(`  (skipped missing ${f})`);
}
console.log(`Assembled ${OUT}/ with ${n} file(s).`);
