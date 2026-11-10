+++
title = "Brand"
updated = 2026-11-10
+++

`@cella/brand` is cella's house style as one package: the tones and
roles, the type, the paper, the mark, the wordmark and the icons, in
files any frontend takes as they are. It holds no feat, writes no SQL and
imports no framework, so the shell, a docs shell and a landing site all
wear the same brand from it.

## The source

`house.json` is the source of every value. It began as the settings of
the brand explorer the cella-brand session made (sha256
`f21058c9…2b5263b2480`), kept as it was in `tools/_tests/brand/`, and is
read as the explorer reads them: its values laid over the explorer's
defaults (`src/house.ts`). It has since grown two settings of its own,
which the explorer's settings leave at their defaults:

- `nudge`, each status hue's turn off the even pentad, in degrees, the
  eye's correction: the five hues are `phase` plus `step` for each in
  turn, plus its nudge, error 30, warning 80 (a gold, not a green),
  success 159, info 237 and help 295;
- `inkC`, the five inks' chroma (0.13), the brand at full voice, above
  `statusC` (0.085), the states' tones, quieter since they colour text
  and tints.

A change of brand is a change of `house.json`, then `cella brand`.

The brand has no accent. The five status hues are the brand, the mark is
the five, and an action is plain ink: the accent tone is the paper's, a
cool graphite (chroma 0.004, hue 250), so `--accent-fill` is the text's
lightness in either theme and what sits on it is the panel's.

## What it holds

`src/` is the model, pure TypeScript touching no DOM and no file, ported
from the explorer:

- `color.ts`, OKLCH to sRGB, an out-of-gamut colour cut in chroma at its
  lightness and hue as a browser cuts it;
- `tones.ts`, the tone and shade model: a shade is a lightness around
  `mid` (0.61), mirrored by one sign, `--theme`, and spread by `contrast`
  (0.92), so the light theme's panel is an off-white (0.969), with
  `depth` (0.85) drawing the surfaces' rungs together; every shade,
  surfaces included, is the same distance from `mid` in either theme,
  since OKLCH's lightness is already even to the eye (`compress` off:
  the explorer's own dark ladder of surfaces stays in the model, unworn);
  each role is a shade of a tone;
- `paper.ts`, the newsprint: its grain and its fibres, each an SVG
  turbulence tile in the text's ink, worn on the ground, the panel and
  raised surfaces at their strengths and at half in dark;
- `mark.ts`, the mark: five Voronoi cells round a blank centre, shaped by
  seeds no one sees, each cut by the gutter and rounded, in the five inks
  at lightness 0.6 and chroma 0.13; a gutter never under 0.9 px at the
  size drawn, so a small mark keeps its cuts;
- `cluster.ts`, the cells beyond the mark: `cluster`, the cells a
  picture is cut into, a power diagram whose seeds' disks follow a
  power law, a few large in the middle and a long tail of small toward
  a lobed rim and a tail, each cell cut by one gutter, the same width
  between any two, held within a reach of its own seed, and
  dropped where it would be a spike; seeded, so a page's clusters are
  the same on every build; and `cell`, a lone cell for a marker.
  `cluster` takes, beside its pitch, gutter, rounding, seed, `drop` and
  `bleed`: `focus`, regions `{ x, y, r }` of its box, what its picture
  is of, each seeded first with a disk a gutter wider than it, grown
  toward the largest's size as its neighbours leave room, so its power
  cell holds it whole and centred and no gutter comes within its
  radius; two regions that fit one largest disk, or stand too close for
  the smallest cell and its gutters between them, which would split one
  subject, share one, the circle round both, at most half as large again
  as the largest; near an edge it does not bleed past, a disk moves in
  as far as its region stays inside, and its cell is always kept, cut
  by the box only where it must be; the outline closes round each, and the other cells shrink
  away from them as well as toward the rim, though never below the
  smallest, so the background still fills however far the focus
  stands; a focus pulls a bleeding cluster's middle toward the words,
  never past 0.55 of the box toward the edge it bleeds off;
  `silhouette`, the shape its cells fill, `'blob'` by default, an
  organic one by name or `{ kind, limbs }`, or `{ field, depth }`, any
  signed distance in the box's units, negative inside, its cells full
  grown `depth` in (two pitches unless given); and `loose`, how many of
  the stray cells past the rim it keeps against the default;
  and `avatar`, a picture's cells and, beside them in the same diagram,
  one large cell, its panel, for words: the panel's seed a disk three
  times the box's height, centred past its right edge, so the panel
  fills the right side whole, cut flat by the box and rounded as a cell
  is, its left side a shallow arc at `seam` of the width; it is cut
  only by the cells kept, so it reaches into a gap a dropped one leaves
  and meets each across one gutter; the cells fill the rest whole, full
  grown most of a pitch in from the box's edge, a focus kept clear of
  the panel. `avatarFrame` says where its picture and its words fall.
  The panel is always on the right: a page mirrors or turns the paths;
- `silhouette.ts`, the shapes a cluster fills, pure and seeded:
  `organic(kind, seed, limbs?)` for `ORGANIC`'s `amoeba`, a wobbling
  body putting out pseudopods, `branch`, a core whose limbs fork once,
  `bubbles`, a main mass and bubbles standing off it, and `colony`,
  lobes budding one off another, each a signed distance of circles and
  tapering limbs melted together and fitted to the box; `maskField`, a
  mask's signed distance from a grid of coverage laid at a place, by
  an 8SSEDT sweep, so a page may hand it a rasterised icon; and
  `sample`, a grid read between its cells at a point of the box;
- `wordmark.ts`, CELLA in Urbanist at weight 690, tracked -0.02em, from glyph
  outlines, and its lockups with the mark at 1.1 times its height, 0.16
  of it apart, beside it or above it;
- `print.ts`, the print's core ([the print](#the-print));
- `css.ts`, the files below written from the model.

From them `cella brand` writes, at the package's root, and commits:

| File | What |
|---|---|
| `tokens.css` | the tones, the shades and the roles, composed as the explorer's `:root` rules compose them, with `--theme` set by `prefers-color-scheme` and overridden by `data-theme="light"` or `"dark"` on any element; the five inks `--p0` to `--p4`, at `inkC`; the paper as `--grain-ground`, `--grain-panel` and `--grain-raised`; the type: `--font-display` Urbanist 700, `--font-text` Inter 420, `--font-mono` Geist Mono 400, their weights `--fw-*`, the scale `--t-xs` to `--t-4xl` from 15px by 1.2, `--leading` 1.55 and `--track-display` -0.03em |
| `tokens.json` | the same values for code: each shade and each role in both themes, as OKLCH and as hex, the hues, the type and the mark |
| `fonts.css` | the three faces, Fontsource's variable builds, self-hosted: a bundler resolves each from the package's dependencies |
| `starlight.css` | the roles mapped onto Starlight's `--sl-*`, so a docs shell needs no theme of its own |
| `print.css` | the print's paper and inks, `--print-*`, and the rule that lays a print's masks ([the print](#the-print)) |
| `mark.svg`, `favicon.svg` | the mark, drawn at 240 and at 16 |
| `wordmark.svg`, `lockup.svg`, `lockup-stack.svg` | the name in outlines, and with the mark beside it and above it, the name in `currentColor` |
| `icons/<name>.svg` | the icons `icons.json` lists, Phosphor's duotone (its carets bold), 256 square in `currentColor` |

`cella check brand`, a part of `cella check`, regenerates them in memory
and fails on every file that differs from what is committed, or that is
missing or left over, saying to run `cella brand`. The wordmark's
outlines come from the Urbanist the package depends on, so a new Fontsource
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

## The print

A picture wears the house's print, the five-ink halftone: the
photograph as one to three ink separations, each covering the tones
darker than its edge through a screen, laid on the paper. Its dot
follows each pixel's lightness, so it is no CSS filter: the package
computes it, and CSS colours it.

`src/print.ts` is the core, ported from the explorer's `printInto()`,
pure and touching no DOM, so it runs alike in node and the browser. It
takes a picture's RGBA pixels at the size it is shown and a print style,
and gives one alpha mask per ink, its coverage at each pixel, with the
ink's name. The styles are the explorer's presets, `PRINT_STYLES`;
`house` is house.json's `print`, the five-ink halftone: one ink, the
tones under 0.5, an angled dot of cell 2.5 px at 23°, soft 1, multiplied
on the paper, its ink turning through the five, `<status>-deep`, one
status to a picture. The tone the explorer gives a picture first,
contrast 0.15 on its luma, is house.json's `dither`, as `PRINT_TONE`.

A print is a physical thing: its paper, the light panel, and its inks,
each a shade of a tone, are the light theme's in either theme, as the
explorer prints. `print.css`, written by `cella brand`, holds them as
`--print-paper` and `--print-<ink>`, and the rule that wears a print: a
`.cella-print`, or a `<cella-print>`, is the paper, and each mask a
layer in its ink's colour, `mask-image` the mask and `mix-blend-mode`
multiply, or normal for an opaque style. Multiplying the paper by each
ink where it covers is the explorer's own sum, so a print the browser
lays is the one the explorer paints. `printMarkup()` writes those
layers.

It is worn two ways:

- **at build time, for a site**: `@cella/brand/print-file`'s
  `printFile(src, { width, ink, style })` reads a picture with sharp at
  the width it is shown, runs the core and gives each mask as a PNG.
  The page holds the masks as files or `data:` URLs, and
  `printMarkup()` the layers over them, so no script ships and the
  colours stay CSS;
- **at run time, for the app** (avatars, members' pictures, uploads):
  importing `@cella/brand/print-element` defines `<cella-print src
  print ink alt>`, framework-free, which draws its picture on a canvas
  at its width and at most 1.5 device pixels, runs the same core and
  lays the same masks. `print` names a style, `house` unset; `ink` a
  status, the first ink's turn; `alt` its text, the element a `role=img`.
  It prints at the width it is shown: it observes its own size and
  prints again when its width changes, so its dots stay the cell's size
  at every width, and one laid out at zero width prints once it has a
  width, never at its picture's. It shows nothing it no longer names:
  when its `src` changes its layers go at once, and when the `src` goes,
  or fails to load or decode, its layers, its aspect ratio and its
  `data-over` are cleared, its `alt` kept as its label. A draw a later
  one has overtaken is dropped.

## The test

`tools/_tests/brand.test.mjs` holds the port to the explorer: the mark
drawn for the explorer's own settings, `tools/_tests/brand/explorer-house.json`,
at 240 and at 16 is the SVG the explorer's `markSvg()` draws for them,
captured from its `src.html` (sha256 `7fc005c3…98498e1cf8`) in
`tools/_tests/brand/`, and the hues, the shades and the generated files
are checked against the values the explorer computes. The house's own
settings past the explorer's, its nudges and its ink chroma, are checked
on `house.json` itself.

The print is held to the explorer the same way: one fixture picture,
`explorer-print.json`, and what the explorer's `printInto()` paints of
it for the house's halftone in three of its inks, at one and at 1.5
device pixels, and for five other presets, their flat, grain and opaque
screens, misregistration, tooth and smoothing among them. The core's
masks, laid on the paper in their inks by the explorer's sum, are that
paint to within one level in 255 at every pixel, so the port cannot
drift.

`tools/_tests/print-browser.test.mjs` lays it in Chromium, Firefox and
WebKit: a `<cella-print>` of the fixture and two `.cella-print`s over
`printFile()`'s PNGs, the poster's three multiplied inks and the screen
print's opaque two, laid in the inks of a `print.css` it makes for the
explorer's own settings, `explorer-house.json`, as the port's test holds
them, since the house's inks have grown past the explorer's; each within
three levels in 255 of what the explorer paints at every pixel and
under one on the mean, since a browser blends each layer in eight
bits. In each it widens a `<cella-print>` printed narrower, and one
laid out at zero width, which has no layers until it
has a width; each then has masks at its new width and paints the
explorer's print within the same bounds. It swaps a third's `src` for a
missing file, which leaves it with no layers.
