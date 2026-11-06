+++
title = "Brand"
updated = 2026-11-06
+++

`@cella/brand` is cella's house style as one package: the tones and
roles, the type, the paper, the mark, the wordmark and the icons, in
files any frontend takes as they are. It holds no feat, writes no SQL and
imports no framework, so the shell, a docs shell and a landing site all
wear the same brand from it.

## The source

`house.json` is the source of every value, copied verbatim from the brand
explorer the cella-brand session made (sha256 `f21058c9…2b5263b2480`). It
is the explorer's settings, read as the explorer reads them: its values
laid over the explorer's defaults (`src/house.ts`), and the five status
hues derived from them, `phase` plus `step` for each in turn, error 23,
warning 91, success 159, info 227 and help 295. A change of brand is a
change of `house.json`, then `cella brand`.

The brand has no accent. The five status hues are the brand, the mark is
the five, and an action is plain ink: the accent tone is the paper's,
graphite at chroma 0, so `--accent-fill` is the text's lightness in
either theme and what sits on it is the panel's.

## What it holds

`src/` is the model, pure TypeScript touching no DOM and no file, ported
from the explorer:

- `color.ts`, OKLCH to sRGB, an out-of-gamut colour cut in chroma at its
  lightness and hue as a browser cuts it;
- `tones.ts`, the tone and shade model: a shade is a lightness around
  `mid` (0.57), mirrored by one sign, `--theme`, and spread by `contrast`
  (0.83), with `depth` (0.85) drawing the surfaces' rungs together, and
  dark compressing them; each role is a shade of a tone;
- `paper.ts`, the newsprint: its grain and its fibres, each an SVG
  turbulence tile in the text's ink, worn on the ground, the panel and
  raised surfaces at their strengths and at half in dark;
- `mark.ts`, the mark: five Voronoi cells round a blank centre, shaped by
  seeds no one sees, each cut by the gutter and rounded, in the five inks
  at lightness 0.55 and chroma 0.095; a gutter never under 0.9 px at the
  size drawn, so a small mark keeps its cuts;
- `wordmark.ts`, CELLA in Sen at weight 690, tracked -0.02em, from glyph
  outlines, and its lockups with the mark at 1.1 times its height, 0.16
  of it apart, beside it or above it;
- `css.ts`, the files below written from the model.

From them `cella brand` writes, at the package's root, and commits:

| File | What |
|---|---|
| `tokens.css` | the tones, the shades and the roles, composed as the explorer's `:root` rules compose them, with `--theme` set by `prefers-color-scheme` and overridden by `data-theme="light"` or `"dark"` on any element; the five inks `--p0` to `--p4`; the paper as `--grain-ground`, `--grain-panel` and `--grain-raised`; the type: `--font-display` Sen 700, `--font-text` Inter 420, `--font-mono` Geist Mono 400, their weights `--fw-*`, the scale `--t-xs` to `--t-4xl` from 15px by 1.2, `--leading` 1.55 and `--track-display` -0.03em |
| `tokens.json` | the same values for code: each shade and each role in both themes, as OKLCH and as hex, the hues, the type and the mark |
| `fonts.css` | the three faces, Fontsource's variable builds, self-hosted: a bundler resolves each from the package's dependencies |
| `starlight.css` | the roles mapped onto Starlight's `--sl-*`, so a docs shell needs no theme of its own |
| `mark.svg`, `favicon.svg` | the mark, drawn at 240 and at 16 |
| `wordmark.svg`, `lockup.svg`, `lockup-stack.svg` | the name in outlines, and with the mark beside it and above it, the name in `currentColor` |
| `icons/<name>.svg` | the icons `icons.json` lists, Phosphor's duotone (its carets bold), 256 square in `currentColor` |

`cella check brand`, a part of `cella check`, regenerates them in memory
and fails on every file that differs from what is committed, or that is
missing or left over, saying to run `cella brand`. The wordmark's
outlines come from the Sen the package depends on, so a new Fontsource
release that moves them fails the check until it is regenerated.

## Wearing it

A consumer takes the files by their exports, never by path:

- the shell, `@cella/org-ui`, imports `fonts.css` and `tokens.css`, and
  reads the roles alone (core/ui's [tokens](../../apps/org/core/ui/index.md#tokens));
- a docs shell on Starlight lists `@cella/brand/fonts.css`,
  `@cella/brand/tokens.css` and `@cella/brand/starlight.css` in its
  `customCss`, its theme switch writing the `data-theme` the tokens read;
- an Astro site imports `fonts.css` and `tokens.css` in its layout and
  takes the mark and lockups as images, or inline for `currentColor`;
- code that needs a value, an Open Graph image or an email, reads
  `tokens.json`, or the model from `@cella/brand`.

Every role is declared on `:root` and on each `[data-theme]`, so a region
can wear the other theme. A state is never told by colour alone: it keeps
its icon and its word.

## The test

`tools/_tests/brand.test.mjs` holds the port to the explorer: the mark
drawn for `house.json` at 240 and at 16 is the SVG the explorer's own
`markSvg()` draws for it, captured from its `src.html` (sha256
`7fc005c3…98498e1cf8`) in `tools/_tests/brand/`, and the hues, the shades
and the generated files are checked against the values the explorer
computes.
