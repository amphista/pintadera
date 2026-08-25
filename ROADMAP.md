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
| 1.2 | **Skin-tone selector UI** — picker on emoji keys that support modifiers; respects dual-nature text/emoji setting | **Sonnet 5** |
| 1.3 | **Manual favorites** — star glyphs into a Favorites folder (localStorage, like Recent) | **Sonnet 5** |
| 1.4 | **Dim all-tofu folders** — folders whose glyphs all fail the render check get dimmed on home | **Haiku 4.5** |

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

Those 13 are the multi-person ones (couples, holding hands, handshake). The 5-tone picker
1.2 is scoped for covers the `s: 1` majority; a 25-combination UI for the `sv` glyphs is a
1.2 design call, and the data is there either way.

> Note: the six hand glyphs that appear in both an emoji folder and Dingbats (☝ ⛹ ✊ ✋ ✌ ✍) carry the
> same skin fields in both places, so the picker behaves consistently wherever it's opened.

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
