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

## The pages

The site is home, vision, blog, about and contact: one page for each
entry of the `pages` collection, and one for each post of the blog.

| Route | File | What |
|---|---|---|
| `/` | `src/pages/index.astro` | the `home` page: its hero at full size, then its sections |
| `/<name>` | `src/pages/[page].astro` | every other page but `blog`: its hero, then its sections |
| `/blog/` | `src/pages/blog/index.astro` | the `blog` page's hero, then the posts newest first |
| `/blog/<name>/` | `src/pages/blog/[post].astro` | one post: its title, date and authors, its body |

Every page wears `src/layouts/Page.astro` over `src/layouts/Base.astro`:

- **the header**, sticky: the brand's lockup inline, linking home; the
  `site` entry's links, the current page's marked; the theme toggle; the
  site's action as a button. On a narrow screen the links fold into a
  menu under Phosphor's `list` icon, a `<details>` with no script.
- **the hero**: an eyebrow, the heading, a lede, two actions, and a
  print filling its far half or a figure beside the words, each but the
  heading optional. Home's is large; every other page's is small.
- **the sections**: the page's, from `sections/<page>/`, in their order,
  each laid out by its kind:

  | Kind | Layout |
  |---|---|
  | `prose` | its body in a readable column, the default |
  | `features` | its heading and body centred over a grid of cards, each an icon, a title and a line |
  | `steps` | the same over its items numbered in a row |
  | `split` | its body beside its print, filling the half `side` gives, or beside its figure |
  | `cta` | a band in the accent's ink: its body and its action |

- **the footer**: the mark, the site's closing line, its links and the
  theme toggle again.

The hero and each section are **bands**, each with one of the five tones
in turn, the hero the first (`toneOf` in `src/lib/content.ts`), so no
two bands in a row share one; its tone is its print's ink, so the colour
is the pictures'. A band stands on one of the design's surfaces, the
ground and the panel in turn (`surfaceOf`), each with its own grain, so
two bands in a row always differ, and a card in it stands one surface up,
a panel on the ground and raised on a panel. No line parts the sections,
nor them and the footer.

The layout sets the theme the visitor chose before the first paint,
from `localStorage`; with none it follows the system's, as the tokens
do. The toggle shows a moon in the light theme and a sun in the dark,
both Phosphor duotone; a press wears the other theme and remembers it,
and a press back to the system's theme forgets the choice. Every icon
the site shows is a Phosphor duotone, through `iconMarkup`
([its figures](#its-figures)).

## The assets

`/assets`, `src/pages/assets/[...path].astro`, is the asset library,
in the dev server alone: its `getStaticPaths` gives no path in a build,
so no build has it, and no page of the site links to it. It wears the
site's header, its links the library's parts and its lockup leading to
the library's index, and the site's footer (`src/layouts/Assets.astro`).
Its index leads to its parts, `src/lib/assets.ts`'s `PARTS`, each a page
of its own, its body in `src/components/assets/`:

| Page | What it shows |
|---|---|
| `/assets/photos` | every vendored photo as the site prints it ([prints](#prints)), the five inks in turn, so no two in a row share one; hovering one shows a toolbar of the five inks, and a press wears that ink, a change of colour alone since a print's dots are the same in any ink; a press on a photo opens it large in its ink, printed at 1200 CSS pixels, a mask the dev server alone makes |
| `/assets/diagrams` | every diagram, as a section's figure shows it |
| `/assets/icons` | every icon the site draws, the cards', the toggle's, the menu's and the library's own, in every role |
| `/assets/components` | the site's components, each by its name |

Its only words are the assets' names, identifiers the copy check
passes, so it holds no copy.

## The text

Every word the site shows lives in its content collections, under
`src/content/`, declared with their schemas in `src/content.config.ts`:

| Collection | What it holds |
|---|---|
| `site` | one entry, `site.yaml`: what every page shares, the site's title, description and tab title, the header's links, the menu's label and the action, the theme toggle's label, the footer, the blog's labels, and the labels the site's components print, the mark a diagram wears and the credit under a photo among them |
| `pages` | one YAML file a page, `<name>.yaml`: its title, its description and its hero; `home` is `/` and `blog` heads the blog |
| `sections` | one MDX file a section, `<page>/<id>.mdx`: its `heading`, `order` and `kind` in the frontmatter, with its eyebrow, items, figure, side and action as its kind uses them, its body below |
| `blog` | one MDX file a post, `<name>.mdx`: its title, summary, date, authors and whether it is a draft, which shows in the dev server and is left out of the build |

A hero or a split section may name a **backdrop**: a vendored photo
(`src/photos/`, [photos](#photos)) in the house's print, `backdrop:
<name>`. The print, in its band's tone, fills three fifths of the band,
top to foot, the far side in a hero and the side `side` names in a
split, and the words stand on the band in the other; on a narrow screen
it stands above them. The print is cut on its near side along an edge
drawn as a cell's, the band's surface showing past it ([the cut](#the-cut)). A hero or a split
naming both a print and a figure shows the print alone; one with a
figure and no print shows the figure on a card beside its words.

### The cut

`src/lib/cut.ts` draws the edge where a print meets its band as an edge
of the mark's cells is drawn: two straight runs and one turn, the turn
standing out past both ends so the band's side is convex as a cell,
bulging into the picture, the turn rounded. Its ends and turn stand
between a tenth and two fifths into the print. The cut clips the print,
so the band's own surface and grain show past it, and is a clip path in
the print's own units: `Art.astro` holds one for a wide screen, on the
print's near edge, mirrored for a print on the left, and one for a
narrow, on its foot, each seeded by the
placement and the photo, so every cut is its own and the same on every
build. The print's credit sits in a corner clear of the cut, plain
small text in the print's muted ink, which its light paper carries in
either theme.

### The plate

A large hero with a print is laid as a **plate**, after a neo-Swiss
specimen plate (`Plate.astro`): the band's paper; over it a technical
drawing, `src/lib/plate.ts`, an axis with its scale, dashed orbits,
construction hairlines, registration marks, numbered points and a node,
in hairlines of the text's ink that stay a hair at any size, and one
line and the node's ring in the band's hue at twice its chroma, the
colour the plate wears; and on the far side the photo in one ink,
greyscale and levelled, laid into the paper by multiplying it, so the
paper's grain shows through, its near edge cut as a cell's. The words
stand left of the axis; on a narrow screen the photo stands above them.
The drawing is laid on a 1440 by 900 field the band slices to its own
size; its only marks are numbers and the letters a figure wears. The
photo in one ink is its own file, `/mono/<photo>-<width>.jpg`, made by
the static endpoint `src/pages/mono/[key].jpg.ts` at 1200 and 600 CSS
pixels and kept as a mask is.

## Prints

A print is shown as the brand explorer shows one: a picture on the
print's light paper, `--print-paper`, in a real ink, `--print-<status>-deep`,
the same in either theme, with the panel's grain multiplied over it, a
bounded thing and never a background a text lies on. On the site its
ink is its band's tone; in the asset library, the five in turn.

Its mask is printed once, at build, by the brand's `printFile`
(`src/lib/print.ts`), from the photo levelled, its darkest and lightest
hundredth taken to black and white so a high-key photo is no bare paper
and a low-key one no slab, at the width the print is shown, 1200 CSS
pixels for a hero's half, 600 for a phone's hero, and 360 for a tile, at
1.5 device pixels to one, so its dots are the house's 2.5 CSS pixel cell
where it is shown, in a sixteen-level palette, half the bytes of a full
alpha, a hero's about half a megabyte. Each
mask is its own file, `/print/<photo>-<width>.png`, made by the static
endpoint `src/pages/print/[key].png.ts` for every photo at each width
and cached by the browser as any image; a page holds none inline. A
mask is made once a photo, width and print settings, kept in the site's
ignored `.astro/print/` by the photo's modification time and a version
`print.ts` bumps when it changes how a mask is made, so the dev server,
a restart and a build each reuse it. A
mask is the same in any ink, so `Backdrop.astro` colours it in CSS, and
a change of ink is a change of colour alone. It is decorative,
`aria-hidden`, and its Unsplash credit sits in its corner. A print inks
the tones under its edge, so a bright, high-key photo prints best.

A hero or a section names its figure in its frontmatter, `{ diagram:
<name> }` or `{ photo: <name>, alt: …, print: … }`, and a card its
icon by Phosphor's name and a role, as `<Icon>` takes them.

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
  themes: `cella check site` builds it, and fails where it does not
  build or where it builds with an icon name Phosphor lacks, so every
  gate rejects an unknown icon; `cella site screenshots` takes its four
  screenshots, over and beside, light and dark, which show the figure
  without adding any section text or publishing a fixture photo.

## Photos

A photo is vendored, never linked: `cella site photo add <unsplash
url>... [--name NAME]` downloads each into `src/photos/<name>.jpg`, its
name the first three words of the page's slug unset, numbered where one
is taken, `--name` naming a single one, with a sidecar `src/photos/<name>.json`
holding what its credit needs: the photographer's name and their
profile's URL, the photo's page, its Unsplash id and the licence, the
[Unsplash License](https://unsplash.com/license), which lets the photo
be modified, as the print does. The photos are picked on Unsplash's own
site, which spends nothing of the API, and vendored in one run: a page
a sidecar already credits is skipped before Unsplash is asked anything,
and each new one costs two requests, its credit and the download its
guidelines ask to be told of. The two credit links carry
`utm_source=cella` and `utm_medium=referral`. With an Unsplash access key in
`UNSPLASH_ACCESS_KEY` or, unset, the development secrets'
`unsplash_access_key` ([secrets](../org/rs/index.md#secrets)), the task reads the photographer through
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
  `Edit`, `Write` or `NotebookEdit` of one. It refuses a write and
  nothing else: a call that names the path without writing there
  passes, a search, a read, a commit message or a message sent through
  corpus among them. Where no `node` is on the session's path, the
  hook looks for one where NixOS keeps it, without starting nix;
  finding none, it refuses only an `Edit`, `Write` or `NotebookEdit`
  of a file there and passes every shell command, the rule holding
  those. It reads the command as written, so one that builds the path
  as it runs goes past it. The workshop's settings run the same hook,
  so it reaches a Claude session started in `cella/` or in the
  workshop's root; Sol's lanes run pi, so for them the rule alone
  holds.
- **The rule.** [AGENTS.md](../../AGENTS.md) says it, and a change that
  needs a word of the text changed says so in its entry's Flag.

Both guards act on an agent's calls alone. No git hook, check or gate
refuses a commit that changes the text, so the operator writes it in
their own editor and commits it by hand, as any commit.

No gate refuses a version that touches the text, since the forge does
not yet record who pushed a version: what it keeps is the pushed
head's committer, which any agent sets.

## Running it

| Command | What |
|---|---|
| `cella site dev [--port PORT]` | Astro's dev server on `http://localhost:4321` by default, reloading on every change, the brand's files among them |
| `cella site build` | the static site into `apps/site/dist`, its pages, its styles and the brand's fonts and images, ready for any static host |
| `cella check site` | the copy check (`tools/site-copy.mjs`, each page, layout and component read by Astro's parser), the diagram registry and metadata check (`tools/site-diagrams.mjs`, also checking every diagram the text names, a `<Diagram name>` in an MDX body or a figure's `diagram:` in a page or a section's frontmatter), `astro check`, the type check of its `.astro` files and scripts, then its build into a temporary directory; a part of `cella check` |

`dist/` and Astro's `.astro/` are ignored by git.
