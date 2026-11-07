+++
title = "Site"
updated = 2026-11-06
+++

`apps/site` (`@cella/site`) is cella's landing site: an
[Astro](https://astro.build) site, built static, that wears the brand
from `@cella/brand` ([the brand](../../packages/brand/index.md)). It
stands outside the feat tree, as the brand does: it holds no feat,
writes no SQL and depends on no package of the repository but the
brand and its diagrams, `@cella/diagrams`
([diagrams](../../packages/diagrams/index.md)), which `cella check
feats` enforces.

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
section the site's components ([its figures](#its-figures)).

The layout imports the brand's `fonts.css` and `tokens.css` and reads
its roles alone: the ground with its paper, the text and its muted
shade, the display face for headings and the text face for the rest,
the scale `--t-*`. It names no colour or face of its own, so a change of
`house.json` restyles the site with `cella brand` and nothing else. The
favicon is the brand's `favicon.svg`. The theme follows the system's,
as the tokens do; an element may set `data-theme` to wear the other.

## Its figures

A section's body places a figure by its name, with the components the
renderer hands it:

- **`<Diagram name="…" />`** renders the diagram of that name from
  `@cella/diagrams` inside a `<figure>`, its `alt` its `meta`'s, and
  under it the mark every diagram wears: the `site` entry's diagram
  label, "AI-generated", in the muted text, which the wrapper always
  prints and no prop removes. A name the diagrams do not list fails the
  build, naming it.

## Whose words

The text is the operator's, written by hand; no agent writes it. Two
guards hold it, each routable around:

- **The settings.** `.claude/settings.json` denies `Edit`, `Write` and
  `NotebookEdit` on `apps/site/src/content/**` to every Claude session
  started in the repository, and its `PreToolUse` hook, a script under
  `tools/` with its own tests, refuses a shell command that writes,
  moves, removes or redirects into a file there, as it refuses an
  `Edit`, `Write` or `NotebookEdit` of one. Where no `node` is on the session's path, the hook refuses
  any call that names the path, a read among them. It reads the
  command as written, so one that builds the path as it runs goes
  past it. It reaches only a
  session started in `cella/`: the box's lanes start in the workshop's
  root and Sol's run pi, so for them the rule alone holds.
- **The rule.** [AGENTS.md](../../AGENTS.md) says it, and a change that
  needs a word of the text changed says so in its entry's Flag.

No gate refuses a version that touches the text, since the forge does
not yet record who pushed a version: what it keeps is the pushed
head's committer, which any agent sets.

## Running it

| Command | What |
|---|---|
| `cella site dev [--port PORT]` | Astro's dev server on `http://localhost:4321` by default, reloading on every change, the brand's files among them |
| `cella site build` | the static site into `apps/site/dist`, its pages, its styles and the brand's fonts and images, ready for any static host |
| `cella check site` | the copy check (`tools/site-copy.mjs`, each page, layout and component read by Astro's parser), the diagram registry and metadata check (`tools/site-diagrams.mjs`, also checking names used in MDX), `astro check`, the type check of its `.astro` files and scripts, then its build into a temporary directory; a part of `cella check` |

`dist/` and Astro's `.astro/` are ignored by git.
