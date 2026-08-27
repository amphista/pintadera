# Pintadera Roadmap

*Updated 2026-08-25. This file is the source of truth for what's next (tracking moved here from Notion). Each phase is broken into sessions sized to fit one focused Claude Code sitting, with a recommended model per session.*

**Model guide** (cheapest first):
- **Haiku 4.5** — small mechanical edits, data tweaks, one-file chores.
- **Sonnet 5** — everyday feature work, UI polish, QA passes with the browser.
- **Opus 5** — algorithm/data-pipeline work, tricky cross-cutting changes. `/fast` mode for long grinds.
- **Fable 5** — architecture & design sessions, anything where the shape of the solution is the hard part.

---

## Phase 0 — Ship the in-flight polish *(done — PR #5 merged 2026-08-25)*

Shipped from `mobile-ux`: "Show glyph names on keys" setting (caption shows descriptive name instead of U+ hex, always-visible clamped mode, native tooltip) + mobile chrome folding (crumbs hidden, single scrollable filter row with edge-fade).

| Session | Work | Model |
|---|---|---|
| 0.1 | ~~QA in browser, fix nits, commit, PR to main~~ — **done** | **Sonnet 5** |

## Phase 1 — Filtering completion & data

| Session | Work | Model |
|---|---|---|
| 1.1 | ~~**Skin-tone data rebuild**~~ — **done.** Encoding decided + `symbols-data.js` regenerated; see *Skin-tone encoding* below | **Opus 5** |
| 1.2 | ~~**Skin-tone selector UI**~~ — **done.** Global preview control (`previewRec`), not a per-key picker; see below | **Sonnet 5** |
| 1.3 | ~~**Manual favorites**~~ — **done.** `.favbtn` star + Favorites folder, mirrors Recent | **Sonnet 5** |
| 1.4 | ~~**Dim all-tofu folders**~~ — **done** (run on Sonnet 5 per session request, not Haiku) | ~~Haiku 4.5~~ |

### Skin-tone encoding (decided in 1.1 — read before starting 1.2)

Records gained two optional fields. Anything without skin variations is **byte-identical**
to before, so nothing else has to change.

| Field | On | Meaning |
|---|---|---|
| `s: 1` | 316 glyphs | Variants are **derivable** — compute them client-side |
| `sv: {key: unified}` | 13 glyphs | Variants are **listed explicitly** — 25 entries each |

**A record never has both**, so 1.2 needs no fallback chain:

```js
const variants = rec.sv                       // explicit table? use it
  ?? (rec.s ? Object.fromEntries(SD_DATA.meta.skinTones.map(t => [t, tone(rec.eu, t)])) : null);

// the whole derivation rule:
function tone(eu, t) {
  const cps = eu.split('-'), rest = cps.slice(1);
  if (rest[0] === 'fe0f') rest.shift();  // modifier replaces the presentation selector
  return [cps[0], t, ...rest].join('-');
}
```

The five tone codes are in `SD_DATA.meta.skinTones`. A variant's value is a `unified` string
that drops straight into the existing `emojiURL(eu, os)`, and `unified → char` is the usual
`split('-').map(h => String.fromCodePoint(parseInt(h,16))).join('')`.

**Why hybrid and not one or the other.** Measured against the 543.8 KB baseline:
derive-everything +1.6 KB, full explicit table +66.7 KB, hybrid **+20.3 KB (+3.7%)**.
Derive-everything is *not* safe: 310 emoji have one modifier base at codepoint index 0 and
derive perfectly (verified 1,550/1,550), but 13 multi-person emoji take per-person tones and
break the rule three different ways — e.g. 🤝 `1f91d` with tones `1f3fb-1f3fc` becomes
`1faf1-1f3fb-200d-1faf2-1f3fc` (🫱🏻‍🫲🏼), an entirely different codepoint sequence.
Deriving those would emit non-RGI sequences that render as tofu or as two glyphs. The full
table costs 4× the hybrid for no extra information. The generator **throws** if a
supposedly-derivable emoji ever stops deriving, so an `emoji-datasource` bump fails the
build loudly instead of shipping broken glyphs.

Those 13 are the multi-person ones (couples, holding hands, handshake). **Update after 1.2
shipped:** the control covers all 13, not just the `s:1` majority — see below for how.

> Note: the six hand glyphs that appear in both an emoji folder and Dingbats (☝ ⛹ ✊ ✋ ✌ ✍) carry the
> same skin fields in both places, so the preview behaves consistently wherever they're shown.

### The skin-tone UI, twice (1.2 shipped, then redesigned same session)

1.2 first shipped as a per-key affordance: a `.tonebtn` badge in each tone-capable key's
corner, opening a `.tonepop` popover that copied a variant immediately on click. The user
tried it and didn't like it — no way to preview a tone before it landed on the clipboard,
and a picker per key added a click just to browse. It was replaced same-session with a
**single global control** in the settings popover (`#settingsPop`, already in the page
header): pick a tone once, and every tone-capable glyph's face, hover tooltip, aria-label,
and click-to-copy value reflect it until you change it back. `state.skinTone` (persisted as
`LS.skinTone`, default `null`) drives one substitution point, `previewRec(rec)`:

```js
function previewRec(rec){
  if(!state.skinTone || !isAsEmoji(rec)) return rec;      // respects the dual-nature setting
  const variants = toneVariants(rec); if(!variants) return rec;
  const v = variants.find(v=>v.tone===state.skinTone); if(!v) return rec;
  return toneRec(rec, v);
}
```

Routed through `glyphNode()` (key face + toast + tray thumbnails), `copyValue()`/`copy()`
(what's copied and what Recent shows), and `ariaLabel()`/`titleName()` (screen readers hear
the tone that's about to be copied). **Deliberately not applied** to favoriting or folder
tagging — `toggleFavorite`/`renderCat`'s retag logic stay keyed to the base character, so
starring survives a later tone change. The multi-select/export tray is WYSIWYG: selection
itself stores base records (so toggling the tone after selecting still updates the tray),
but `selectedGrouped()` resolves through `previewRec()` at read time, so the tray preview,
"Copy all", and the Stream Deck JSON export all agree with what the key faces are currently
showing.

The `.tonebtn`/`.tonepop`/`.toneswatch` UI, `openTonePicker`/`closeTonePicker`/`copyTone`
and friends, and the `has-tone` per-key class are gone entirely — if you find a stale
reference to any of them, it's dead and should be deleted, not resurrected.

### `sv` uniform-tone lookup (a wrinkle found while building 1.2 — still load-bearing)

`previewRec()` needs a uniform tone for every tone-capable glyph, including all 13 `sv`
ones — but the lookup key shape differs depending on the base sequence, and using the wrong
one silently no-ops (returns the base glyph with no error, so it just looks like the tone
control did nothing for that one glyph):

- **6 glyphs** with a single-codepoint base (handshake, couplekiss, couple_with_heart, and
  the three holding-hands emoji) key the uniform tone as one 5-hex code: `sv["1f3fd"]`.
- **7 glyphs** whose base already has 2–3 modifier-base codepoints (people_holding_hands +
  the six heart/kiss couples) have *no* single-hex keys at all — their uniform tone is the
  joined same-tone key: `sv["1f3fd-1f3fd"]`.

`toneVariants()` already tries the single key first and falls back to the joined one — reuse
it, don't reimplement:
```js
const u = rec.sv[t] || rec.sv[t+'-'+t];
```
The 20 two-*different*-tone combinations per `sv` glyph (per-person asymmetric tones) are
out of scope for this control — deliberate cut, not a gap. A future session wanting that
would need a 2-axis UI, which the data already supports (`meta.skinTones` × itself, minus
the diagonal already covered above).

### Key-corner affordances (claimed real estate — read before adding another one)

Symbol keys carry small controls layered on the corners. Any future session adding a
per-key affordance should check before assuming a corner is free:

| Corner | Control | Shown when |
|---|---|---|
| top-left | `.selmark` (export selection checkmark) | `state.selMode` only |
| top-right | dual-nature dot (text/emoji legend) | glyph is `e:1` (dual-nature) |
| bottom-left | `.favbtn` (favorite star, 1.3) | always (visible even in selMode) |
| bottom-right | *unclaimed* | 1.2's `.tonebtn` used to live here; freed when the picker became a global control |

`setRoving()` carries `.favbtn`'s tabindex with the active key's roving focus. It
`stopPropagation()`s in `bindGrid()`'s delegated click handler so it never triggers
click-to-copy or selection toggling.

### Folder-card dimming cache (1.4)

`folderDimmed(f)` samples up to 24 items per folder (strided) and requires unanimous
`isRenderable()` failure before dimming — checking all 946 Fancy Letters glyphs every time
Home renders would be wasteful, and "all tofu except one straggler" is vanishingly rare in
practice. Results cache in `DIM_CACHE` by folder id since the render check depends only on
the device's fixed font stack, not the OS-preview dropdown — never recomputed on repeat
Home visits. Applies to `SYM_FOLDERS`/`EMO_FOLDERS` only; synthetic cards (All Glyphs, Most
Useful, Recent, Favorites, Emoji-the-category-of-categories) are excluded since a
near-empty Favorites/Recent could misleadingly sample as "all tofu."

## Phase 2 — Stream Deck page → real builder

The export page exists; make it an actual builder.

| Session | Work | Model |
|---|---|---|
| 2.1 | **Design session** — architecture for the export page: multiple export options with the Claude/Stream-Deck script demoted to one modal among several; how bimodal (symbol vs emoji) glyphs flow through each exporter | **Fable 5** |
| 2.2 | **Export modal restructure** — implement the option chooser + move the script flow into its modal | **Sonnet 5** |
| 2.3 | **PDF cheat-sheet export** — glyphs + U+ hex, generated client-side in the no-dependency single-file app (likely canvas/print-CSS; the constraint is the hard part) | **Opus 5** |
| 2.4 | **Deck-model picker + layout preview** — pick a Stream Deck model, preview the key layout before export | **Opus 5** |

## Phase 3 — Kaomoji / emoticon builder

| Session | Work | Model |
|---|---|---|
| 3.1 | **Design session** — UX for parts palette + presets + editing an existing kaomoji; what parts taxonomy looks like | **Fable 5** |
| 3.2 | **Data** — add the handful of kana needed as parts, *without* lifting the CJK exclusion in `generate-data.mjs` | **Haiku 4.5** |
| 3.3 | **Builder implementation** — palette, live preview, presets, copy | **Opus 5** |
| 3.4 | **Polish + mobile QA pass** | **Sonnet 5** |

## Icebox (unscheduled)

- Search improvements (synonyms, fuzzy matching on glyph names)
- PWA/offline install
- Shareable links to a folder or selection
