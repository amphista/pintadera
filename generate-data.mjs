#!/usr/bin/env node
/**
 * generate-data.mjs
 * ------------------------------------------------------------------
 * Builds the symbol dataset for the Pintadera picker.
 *
 * Sources (all in ./data, fetched from unicode.org) + the
 * `emoji-datasource` npm package (names / keywords / CDN image keys).
 *
 * Output: ./symbols-data.js   ->  window.SD_DATA = {...}   (inline, works on file://)
 *         ./symbols-data.json  ->  same payload as JSON (for inspection / reuse)
 *
 * Scope: symbols, punctuation, technical/keyboard, math, currency,
 * arrows, shapes, dingbats, Greek, Latin-extended, fractions/number
 * forms, enclosed/circled, music, astro, cards, braille + full RGI
 * emoji. Excludes CJK, Hangul, Kana, and other non-Latin scripts.
 * ------------------------------------------------------------------
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const __dirname = dirname(fileURLToPath(import.meta.url));
const D = (f) => join(__dirname, 'data', f);

/* ---------------- parse Blocks.txt ---------------- */
// lines: "0000..007F; Basic Latin"
function parseBlocks() {
  const txt = readFileSync(D('Blocks.txt'), 'utf8');
  const blocks = [];
  for (const line of txt.split('\n')) {
    const m = line.match(/^([0-9A-Fa-f]+)\.\.([0-9A-Fa-f]+);\s*(.+?)\s*$/);
    if (!m) continue;
    blocks.push({ start: parseInt(m[1], 16), end: parseInt(m[2], 16), name: m[3] });
  }
  return blocks;
}
function blockOf(cp, blocks) {
  for (const b of blocks) if (cp >= b.start && cp <= b.end) return b.name;
  return null;
}

/* ---------------- parse UnicodeData.txt ---------------- */
// fields: cp;name;gc;...;;;;;;unicode1Name;...
function parseUnicodeData() {
  const txt = readFileSync(D('UnicodeData.txt'), 'utf8');
  const map = new Map(); // cp -> { name, gc }
  for (const line of txt.split('\n')) {
    if (!line) continue;
    const f = line.split(';');
    const cp = parseInt(f[0], 16);
    let name = f[1];
    const gc = f[2];
    const u1 = f[10];
    // <control> etc.: prefer the Unicode 1.0 alias if present
    if (name.startsWith('<')) {
      if (u1) name = u1;
      else continue; // range markers / unnamed
    }
    map.set(cp, { name, gc, u1 });
  }
  return map;
}

/* ---------------- parse emoji-data.txt ---------------- */
// blocks of "0023 ; Emoji # ..." or "231A..231B ; Emoji_Presentation # ..."
function parseEmojiProps() {
  const txt = readFileSync(D('emoji-data.txt'), 'utf8');
  const emoji = new Set();
  const presentation = new Set();
  for (const raw of txt.split('\n')) {
    const line = raw.split('#')[0].trim();
    if (!line) continue;
    const m = line.match(/^([0-9A-Fa-f]+)(?:\.\.([0-9A-Fa-f]+))?\s*;\s*(\w+)/);
    if (!m) continue;
    const a = parseInt(m[1], 16);
    const b = m[2] ? parseInt(m[2], 16) : a;
    const prop = m[3];
    for (let cp = a; cp <= b; cp++) {
      if (prop === 'Emoji') emoji.add(cp);
      else if (prop === 'Emoji_Presentation') presentation.add(cp);
    }
  }
  return { emoji, presentation };
}

/* ---------------- emoji-datasource ---------------- */
function loadEmojiDatasource() {
  const arr = require('emoji-datasource/emoji.json');
  // index by various codepoint keys so symbol-block chars can find an image
  const byKey = new Map();
  const list = [];
  for (const e of arr) {
    if (e.category === 'Component') continue; // skin tones / hair components
    const unified = e.unified.toLowerCase();
    const char = unifiedToChar(e.unified);
    const rec = {
      char,
      unified,
      name: (e.name || e.short_name || '').toLowerCase(),
      short: e.short_name,
      keywords: e.short_names || [],
      category: e.category,
      subcategory: e.subcategory,
      sort: e.sort_order,
      img: { apple: !!e.has_img_apple, google: !!e.has_img_google, twitter: !!e.has_img_twitter, facebook: !!e.has_img_facebook },
    };
    list.push(rec);
    byKey.set(unified, rec);
    if (e.non_qualified) byKey.set(e.non_qualified.toLowerCase(), rec);
    // also index single-codepoint base (strip trailing -fe0f) for symbol lookup
    const base = unified.replace(/-fe0f$/, '');
    if (!byKey.has(base)) byKey.set(base, rec);
  }
  return { list, byKey };
}
function unifiedToChar(unified) {
  return unified.split('-').map((h) => String.fromCodePoint(parseInt(h, 16))).join('');
}
function cpHex(cp) { return cp.toString(16).padStart(4, '0'); }

/* ================================================================
 * FOLDER TAXONOMY
 * Each block name maps to a folder. Order in FOLDERS = display order.
 * A few blocks are split by codepoint via `refine()` below.
 * ================================================================ */
const BLOCK_FOLDER = {
  // arrows
  'Arrows': 'arrows',
  'Supplemental Arrows-A': 'arrows',
  'Supplemental Arrows-B': 'arrows',
  'Supplemental Arrows-C': 'arrows',
  'Miscellaneous Symbols and Arrows': 'arrows',
  // math
  'Mathematical Operators': 'math',
  'Supplemental Mathematical Operators': 'math',
  'Miscellaneous Mathematical Symbols-A': 'math',
  'Miscellaneous Mathematical Symbols-B': 'math',
  'Mathematical Alphanumeric Symbols': 'fancy',
  'Letterlike Symbols': 'marks',
  // currency
  'Currency Symbols': 'currency',
  // punctuation / typography
  'General Punctuation': 'punct',
  'Supplemental Punctuation': 'punct',
  'Latin-1 Supplement': 'latin',
  'Latin Extended-A': 'latin',
  'Latin Extended-B': 'latin',
  'Latin Extended Additional': 'latin',
  'IPA Extensions': 'latin',
  'Spacing Modifier Letters': 'latin',
  // shapes
  'Geometric Shapes': 'shapes',
  'Geometric Shapes Extended': 'shapes',
  // box / blocks / lines
  'Box Drawing': 'lines',
  'Block Elements': 'lines',
  'Symbols for Legacy Computing': 'lines',
  // technical / keyboard
  'Miscellaneous Technical': 'keyboard',
  'Control Pictures': 'keyboard',
  'Optical Character Recognition': 'keyboard',
  // dingbats / misc symbols
  'Dingbats': 'dingbats',
  'Miscellaneous Symbols': 'dingbats',
  'Ornamental Dingbats': 'dingbats',
  'Alchemical Symbols': 'dingbats',
  // greek
  'Greek and Coptic': 'greek',
  'Greek Extended': 'greek',
  // number forms / fractions / sub-super
  'Number Forms': 'numbers',
  'Superscripts and Subscripts': 'numbers',
  // enclosed
  'Enclosed Alphanumerics': 'enclosed',
  'Enclosed Alphanumeric Supplement': 'enclosed',
  // music
  'Musical Symbols': 'music',
  'Byzantine Musical Symbols': null,
  // cards / dice / games
  'Playing Cards': 'cards',
  'Domino Tiles': 'cards',
  'Mahjong Tiles': 'cards',
  // braille
  'Braille Patterns': 'braille',
  // emoji-bearing misc (handled mostly by emoji set, but text forms here)
  'Miscellaneous Symbols and Pictographs': 'emoji_only',
  'Supplemental Symbols and Pictographs': 'emoji_only',
  'Symbols and Pictographs Extended-A': 'emoji_only',
  'Emoticons': 'emoji_only',
  'Transport and Map Symbols': 'emoji_only',
};

// Folder display metadata + a representative glyph
const FOLDERS = [
  { id: 'useful',   label: 'Most Useful', glyph: '★' },
  { id: 'arrows',   label: 'Arrows',       glyph: '→' },
  { id: 'math',     label: 'Math + Logic', glyph: '∑' },
  { id: 'currency', label: 'Currency',     glyph: '€' },
  { id: 'punct',    label: 'Punctuation',  glyph: '¶' },
  { id: 'marks',    label: 'Marks + Signs',glyph: '™' },
  { id: 'shapes',   label: 'Shapes',       glyph: '◆' },
  { id: 'stars',    label: 'Stars',        glyph: '✦' },
  { id: 'status',   label: 'Status + Checks', glyph: '✓' },
  { id: 'bullets',  label: 'Bullets',      glyph: '•' },
  { id: 'lines',    label: 'Lines + Box',  glyph: '┼' },
  { id: 'keyboard', label: 'Keys + UI',    glyph: '⌘' },
  { id: 'brackets', label: 'Brackets',     glyph: '⟨ ⟩' },
  { id: 'greek',    label: 'Greek',        glyph: 'Ω' },
  { id: 'latin',    label: 'Latin + Accents', glyph: 'é' },
  { id: 'numbers',  label: 'Numbers + Fractions', glyph: '½' },
  { id: 'enclosed', label: 'Circled + Boxed', glyph: '①' },
  { id: 'fancy',    label: 'Fancy Letters', glyph: '𝔸' },
  { id: 'music',    label: 'Music',        glyph: '♫' },
  { id: 'astro',    label: 'Astro + Zodiac', glyph: '♅' },
  { id: 'cards',    label: 'Cards + Dice', glyph: '♠' },
  { id: 'braille',  label: 'Braille',      glyph: '⠿' },
  { id: 'dingbats', label: 'Dingbats',     glyph: '☯' },
];

/* refine(): codepoint-level reassignment that block alone can't express.
   NOTE: UnicodeData names are UPPERCASE — lowercase before matching. */
function refine(cp, folder, rec) {
  // astro & zodiac: precise codepoints (avoid grabbing telephone/ballot-box at 260E-2612)
  const isAstro =
    cp === 0x2609 ||                  // SUN
    (cp >= 0x263c && cp <= 0x2653) || // sun-with-rays, moons, Mercury..Pluto, Aries..Pisces
    (cp >= 0x26b3 && cp <= 0x26bc) || // Ceres, Pallas, Juno, Vesta, Chiron, Lilith…
    (cp >= 0x2bd0 && cp <= 0x2bd2);   // misc astrological in Misc Symbols and Arrows
  if (isAstro) return 'astro';

  const n = rec.name.toLowerCase();
  // stars / asterisks / sparkles from Dingbats, Misc Symbols, Shapes
  if (/\bstar\b|asterisk|sparkle|snowflake/.test(n) && (folder === 'dingbats' || folder === 'shapes')) return 'stars';
  // checks / crosses / ballots from Dingbats
  if (/check mark|ballot|cross mark|heavy check|multiplication x|\bsaltire\b|\bballot\b/.test(n) && folder === 'dingbats') return 'status';
  // bullets / middle dots
  if (/\bbullet\b|hyphen bullet|triangular bullet|\bone dot leader\b|\btwo dot leader\b/.test(n)) return 'bullets';
  // stray arrows living in Dingbats / Misc Technical / Shapes
  if (/\barrow\b/.test(n) && (folder === 'dingbats' || folder === 'keyboard' || folder === 'shapes')) return 'arrows';
  // brackets from math / punctuation / technical blocks
  if (/bracket|angle bracket|ceiling|floor|\bbrace\b|\bcorner\b/.test(n) && (folder === 'math' || folder === 'punct' || folder === 'keyboard')) return 'brackets';
  return folder;
}

/* gc allowlist per folder kind */
function gcAllowed(gc, folder) {
  // letters allowed in letter-bearing folders
  if (folder === 'greek' || folder === 'latin' || folder === 'fancy') {
    return /^(L[ultmo]|S[mko]|N[lo]|P[a-z])/.test(gc);
  }
  // braille = So
  if (folder === 'braille') return gc === 'So';
  // everything else: symbols, punctuation, number-symbols
  return /^(S[mkco]|P[cdsepifo]|N[lo])$/.test(gc);
}

/* ================================================================
 * BUILD
 * ================================================================ */
const blocks = parseBlocks();
const ucd = parseUnicodeData();
const { emoji: emojiSet, presentation } = parseEmojiProps();
const eds = loadEmojiDatasource();

const folderItems = Object.fromEntries(FOLDERS.map((f) => [f.id, []]));
const seen = new Set();

function emojiStatus(cp) {
  if (presentation.has(cp)) return 2; // default emoji presentation (color)
  if (emojiSet.has(cp)) return 1;     // emoji-capable, text default (often color in email/web)
  return 0;
}
function imageFor(cp) {
  const k1 = cpHex(cp);
  const rec = eds.byKey.get(k1) || eds.byKey.get(k1 + '-fe0f');
  if (!rec) return null;
  return { unified: rec.unified, img: rec.img };
}

let added = 0;
for (const [cp, info] of ucd) {
  const bname = blockOf(cp, blocks);
  if (!bname) continue;
  let folder = BLOCK_FOLDER[bname];
  if (!folder || folder === 'emoji_only') continue; // pictograph blocks come from the emoji set
  if (!gcAllowed(info.gc, folder)) continue;
  folder = refine(cp, folder, info);
  if (!folderItems[folder]) continue;

  const ch = String.fromCodePoint(cp);
  if (seen.has(ch)) continue;
  seen.add(ch);

  const e = emojiStatus(cp);
  const im = e ? imageFor(cp) : null;
  const item = { c: ch, n: info.name.toLowerCase(), u: cpHex(cp) };
  if (e) item.e = e;
  if (im) { item.eu = im.unified; } // emoji image key (unified)
  folderItems[folder].push(item);
  added++;
}

/* emoji folders from emoji-datasource */
const EMOJI_CAT_FOLDER = [
  { cat: 'Smileys & Emotion', id: 'e-smileys', label: 'Smileys', glyph: '😀' },
  { cat: 'People & Body',     id: 'e-people',  label: 'People + Hands', glyph: '👋' },
  { cat: 'Animals & Nature',  id: 'e-nature',  label: 'Nature', glyph: '🌿' },
  { cat: 'Food & Drink',      id: 'e-food',    label: 'Food', glyph: '🍎' },
  { cat: 'Travel & Places',   id: 'e-travel',  label: 'Travel', glyph: '✈️' },
  { cat: 'Activities',        id: 'e-fun',     label: 'Activities', glyph: '🎉' },
  { cat: 'Objects',           id: 'e-objects', label: 'Objects', glyph: '💡' },
  { cat: 'Symbols',           id: 'e-symbols', label: 'Emoji Symbols', glyph: '❤️' },
  { cat: 'Flags',             id: 'e-flags',   label: 'Flags', glyph: '🏳️' },
];
const emojiFolders = [];
const edsByCat = {};
for (const r of eds.list) (edsByCat[r.category] ||= []).push(r);
for (const cf of EMOJI_CAT_FOLDER) {
  const recs = (edsByCat[cf.cat] || []).sort((a, b) => a.sort - b.sort);
  const items = recs.map((r) => ({
    c: r.char, n: r.name, u: r.unified, e: 2, eu: r.unified,
    k: r.keywords.filter((k) => k !== r.short).slice(0, 6),
  }));
  emojiFolders.push({ id: cf.id, label: cf.label, glyph: cf.glyph, emoji: true, items });
}

/* ---------------- Most Useful (curated) ---------------- */
const USEFUL = ['→','←','↑','↓','↔','•','◦','…','–','—','·','“','”','‘','’','«','»','©','®','™','°','×','÷','±','≈','≠','≤','≥','✓','✗','★','☆','§','¶','†','‡','№','⌘','⌥','⇧','⌫','↩','⏎','€','£','¥','½','¼','¾','∞','√','∑','π','µ','✦','♥','→'];
const usefulSeen = new Set();
const usefulItems = [];
function findItem(ch) {
  for (const id in folderItems) { const it = folderItems[id].find((x) => x.c === ch); if (it) return it; }
  for (const f of emojiFolders) { const it = f.items.find((x) => x.c === ch); if (it) return it; }
  // fall back to UCD name
  const cp = ch.codePointAt(0);
  const info = ucd.get(cp);
  return info ? { c: ch, n: info.name.toLowerCase(), u: cpHex(cp) } : { c: ch, n: ch, u: cpHex(cp) };
}
for (const ch of USEFUL) { if (usefulSeen.has(ch)) continue; usefulSeen.add(ch); usefulItems.push(findItem(ch)); }

/* ---------------- assemble ---------------- */
const symbolFolders = FOLDERS.filter((f) => f.id !== 'useful').map((f) => ({
  id: f.id, label: f.label, glyph: f.glyph, items: folderItems[f.id],
})).filter((f) => f.items.length > 0);

const payload = {
  meta: {
    generated: 'build', // stamped by caller, not Date.now (kept deterministic)
    counts: {},
  },
  useful: { id: 'useful', label: 'Most Useful', glyph: '★', items: usefulItems },
  symbols: symbolFolders,
  emoji: emojiFolders,
};

let total = usefulItems.length;
const counts = { useful: usefulItems.length };
for (const f of symbolFolders) { counts[f.id] = f.items.length; total += f.items.length; }
let emojiTotal = 0;
for (const f of emojiFolders) { counts[f.id] = f.items.length; emojiTotal += f.items.length; }
payload.meta.counts = counts;
payload.meta.total = total + emojiTotal;
payload.meta.symbolTotal = total;
payload.meta.emojiTotal = emojiTotal;

const json = JSON.stringify(payload);
writeFileSync(join(__dirname, 'symbols-data.json'), json);
writeFileSync(join(__dirname, 'symbols-data.js'), 'window.SD_DATA=' + json + ';\n');

/* ---------------- report ---------------- */
console.log('=== DATASET BUILT ===');
console.log('symbol folders:', symbolFolders.length, '| emoji folders:', emojiFolders.length);
console.log('symbol glyphs :', total);
console.log('emoji glyphs  :', emojiTotal);
console.log('GRAND TOTAL   :', payload.meta.total);
console.log('json size     :', (json.length / 1024).toFixed(0), 'KB');
console.log('--- per folder ---');
for (const f of symbolFolders) console.log(String(f.items.length).padStart(5), f.id, '-', f.label);
console.log('--- emoji ---');
for (const f of emojiFolders) console.log(String(f.items.length).padStart(5), f.id, '-', f.label);
