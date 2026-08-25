# Pintadera Roadmap

*Updated 2026-08-25. This file is the source of truth for what's next (tracking moved here from Notion). Each phase is broken into sessions sized to fit one focused Claude Code sitting, with a recommended model per session.*

**Model guide** (cheapest first):
- **Haiku 4.5** — small mechanical edits, data tweaks, one-file chores.
- **Sonnet 5** — everyday feature work, UI polish, QA passes with the browser.
- **Opus 5** — algorithm/data-pipeline work, tricky cross-cutting changes. `/fast` mode for long grinds.
- **Fable 5** — architecture & design sessions, anything where the shape of the solution is the hard part.

---

## Phase 0 — Ship the in-flight polish *(in progress)*

Uncommitted on `mobile-ux`: "Show glyph names on keys" setting (caption shows descriptive name instead of U+ hex, always-visible clamped mode, native tooltip) + mobile chrome folding (crumbs hidden, single scrollable filter row with edge-fade).

| Session | Work | Model |
|---|---|---|
| 0.1 | QA in browser (esp. name captions on small screens, filter-row scroll), fix nits, commit, PR to main | **Sonnet 5** |

## Phase 1 — Filtering completion & data

| Session | Work | Model |
|---|---|---|
| 1.1 | **Skin-tone data rebuild** — extend `generate-data.mjs` to emit skin-tone variant data into the record shape (`{c,n,u,e?,eu?,k?}` has none today); decide encoding, regenerate `symbols-data.js`, verify size impact | **Opus 5** |
| 1.2 | **Skin-tone selector UI** — picker on emoji keys that support modifiers; respects dual-nature text/emoji setting | **Sonnet 5** |
| 1.3 | **Manual favorites** — star glyphs into a Favorites folder (localStorage, like Recent) | **Sonnet 5** |
| 1.4 | **Dim all-tofu folders** — folders whose glyphs all fail the render check get dimmed on home | **Haiku 4.5** |

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
