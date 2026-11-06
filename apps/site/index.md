+++
title = "Site"
updated = 2026-11-06
+++

`apps/site` (`@cella/site`) is cella's landing site: an
[Astro](https://astro.build) site, built static, that wears the brand
from `@cella/brand` ([the brand](../../packages/brand/index.md)). It
stands outside the feat tree, as the brand does: it holds no feat,
writes no SQL and depends on no package of the repository but the
brand, which `cella check feats` enforces.

It is deployed nowhere. No domain serves it and no host builds it;
nothing of it goes public until the operator says so.

## The page

One page, `src/pages/index.astro`, in one layout,
`src/layouts/Base.astro`:

- **the hero**: the mark above the wordmark, the brand's stacked
  lockup taken inline so its name is in the text's colour, and one line
  under it;
- **the sections**: one for each entry of the `sections` collection,
  in the order its `order` gives, each its heading and its body.

## The text

Every word the site shows lives in its content collections, under
`src/content/`, declared with their schemas in `src/content.config.ts`:

| Collection | What it holds |
|---|---|
| `site` | one entry, `site.yaml`: the page's title and description, the hero's line, and the labels the site's components print, the mark a diagram wears and the credit under a photo among them |
| `sections` | one MDX file a section, `<id>.mdx`: its `heading` and its `order` in the frontmatter, its body below |

A page or a layout holds structure and no prose: it reads the
collections and lays them out. `cella check site` refuses a page,
layout or component of the site that holds a word of copy, a string
literal or a text node outside the collections, beyond what is
plumbing: an `id`, a class, a path, a `lang`, an `aria-*` attribute
naming an element that the collections label.

A section's body is MDX, so the text places the site's figures where
it reads, by name and without an import: the renderer hands every
section the site's components.

The layout imports the brand's `fonts.css` and `tokens.css` and reads
its roles alone: the ground with its paper, the text and its muted
shade, the display face for headings and the text face for the rest,
the scale `--t-*`. It names no colour or face of its own, so a change of
`house.json` restyles the site with `cella brand` and nothing else. The
favicon is the brand's `favicon.svg`. The theme follows the system's,
as the tokens do; an element may set `data-theme` to wear the other.

## Running it

| Command | What |
|---|---|
| `cella site dev [--port PORT]` | Astro's dev server on `http://localhost:4321` by default, reloading on every change, the brand's files among them |
| `cella site build` | the static site into `apps/site/dist`, its pages, its styles and the brand's fonts and images, ready for any static host |
| `cella check site` | the copy check (`tools/site-copy.mjs`, each page, layout and component read by Astro's parser), `astro check`, the type check of its `.astro` files and scripts, then its build into a temporary directory; a part of `cella check` |

`dist/` and Astro's `.astro/` are ignored by git.
