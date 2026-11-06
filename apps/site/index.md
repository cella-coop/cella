+++
title = "Site"
updated = 2026-11-07
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
naming an element that the collections label. An attribute whose value
the page renders as its content, `set:html` and `set:text`, is never
plumbing: its value is read as a text node is, a literal or the strings
of an expression, so `<p set:html="A sentence." />` fails as `<p>A
sentence.</p>` does, and markup the page takes inline, as the lockup,
comes from an import.

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
- **`<Photo name="…" alt="…" print="…" />`** renders the photo of that name
  from `src/photos/` through the brand's print at build time
  (`printFile`, [the print](../../packages/brand/index.md#the-print)):
  `print` names any of `PRINT_STYLES`, `house` the five-ink halftone
  unset, or `none` for the photo as it is. `alt` is the operator's
  description in the section's text, used by both the print and the
  unprinted image. Under it, the credit
  Unsplash asks for, the `site` entry's photo credit with the
  photographer's name linked to their profile and "Unsplash" to the
  photo's page. The credit is always printed; no prop removes it.
- **`<Icon name="…" role="…" />`** draws any of Phosphor's duotone
  icons by its name, from `@phosphor-icons/core`, inline at build
  time: its line in the role's text colour, `--<role>-text`, and its
  duotone layer in the role's soft colour, `--<role>-soft`, a role one
  of the status hues (`success`, `error`, `warning`, `info`, `help`)
  or `accent`, the text's own colour unset. The duotone layer retains
  its full shape in the soft colour, rather than multiplying the soft
  token's alpha by Phosphor's default 0.2. The icon is decorative and
  carries no client script. A name Phosphor has not fails the build,
  naming it.
- **`<Figure>`** composes them: a `<Photo>` with icons laid over it or
  beside it, `<Figure photo="…" alt="…" print="…" layout="over|beside">`
  with its `<Icon>`s as children, at the corners or the edge its layout
  places them, and the photo's credit once under the whole. `alt` is
  the operator's description in the section's text. A figure holds
  exactly one photo and any number of icons; it works in both themes.
  The build-only fixture under `test/` exercises both layouts in both
  themes and rejects an unknown icon; its four screenshots show the
  figure without adding any section text or publishing a fixture photo.

## Photos

A photo is vendored, never linked: `cella site photo add <unsplash
url> [--name NAME]` downloads it into `src/photos/<name>.jpg`, its
name the photo's slug unset, with a sidecar `src/photos/<name>.json`
holding what its credit needs: the photographer's name and their
profile's URL, the photo's page, its Unsplash id and the licence, the
[Unsplash License](https://unsplash.com/license), which lets the photo
be modified, as the print does. The two credit links carry
`utm_source=cella` and `utm_medium=referral`. With an Unsplash access key in
`UNSPLASH_ACCESS_KEY`, the task reads the photographer through
Unsplash's API and calls the photo's download endpoint, as the API's
guidelines ask; with none, it reads the page's public image and asks
for the name and the profile's URL on the terminal. A page that refuses
automated reads needs an access key. `cella check site` refuses a photo without its
sidecar, a sidecar missing any field, and a `<Photo name>` naming none.

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
