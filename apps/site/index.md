+++
title = "Site"
updated = 2026-11-08
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

The site is home, concept, blog, about and contact: one page for each
folder under `pages/` in the text, and one for each post of the blog.

| Route | File | What |
|---|---|---|
| `/` | `src/pages/index.astro` | the `home` page: its hero, then its sections |
| `/<name>` | `src/pages/[page].astro` | every other page but `blog`: its hero, then its sections |
| `/blog/` | `src/pages/blog/index.astro` | the `blog` page's hero, then the posts newest first |
| `/blog/<name>/` | `src/pages/blog/[post].astro` | one post: its title, date, summary and authors, its body |

Every page wears `src/layouts/Page.astro` over `src/layouts/Base.astro`:

- **the header**, sticky, on a pane of glass with the paper's grain in
  it, near white in the light theme and near black in the dark, seen
  through and borderless: the brand's lockup linking home, the `site`
  entry's links, the current page's marked, and the theme toggle, an
  icon alone in the bar's far corner. On a narrow screen the links fold
  into a menu under Phosphor's `list` icon, a `<details>` with no script.
- **the sections**, the hero first, each laid out by its kind
  (`src/components/Section.astro`):

  | Kind | Layout |
  |---|---|
  | `hero` | the page's top: an eyebrow, the heading large, the body as a lede, two actions; its figure overhangs the section after it |
  | `prose` | its body in a readable column, the default |
  | `features` | its body as a lede, then its items, each a cell of the brand in one of the five inks, a title and a line |
  | `steps` | its body, then its items numbered in two columns |
  | `list` | its body, then its items as ruled rows, a title and a muted line |
  | `quote` | a band of sage, its edges cut as a cell's: its body set large, its heading the attribution |
  | `cta` | a band of coral, its edges cut as a cell's: its eyebrow, heading, body and action |

- **the footer**, on the page's own paper under a hairline: the lockup
  and the site's closing line, the sitemap in columns, each a heading
  over its links, and under them the note that the site shows
  prototype work, not yet a product.

A band's edges are a rounded outline in its own box (`EDGES` in
`Section.astro`), a few long edges meeting at wide turns rounded by the
brand's own corner, its corners at the screen's sides standing past it.

A section with a figure sets it beside its words; down the page the
figures trade sides, the hero's on the right, and take the five inks in
turn, the hero's the coral (`Page.astro`). A figure bleeds past the
column to the screen's edge on its outer side, its caption kept to the
column. A plain section, `prose`, `features`, `steps` or `list`, is
numbered, 01 on, in the display face's thinnest weight. A heading may
mark its closing part with stars, `*like this*`, set thin.

The page is the panel, an off-white in the light theme, under a wide
grid of the text's ink at a breath of strength, 15rem squares (9rem on
a phone) with a short plus where its lines cross, and the panel's grain. Every value is the brand's: its
roles, its five inks `--p0` to `--p4`, mixed for the grid, the glass and
the bands, so a change of `house.json` restyles the site with `cella
brand` and nothing else. Headings are the display face, Urbanist; the
rest is the text face, Inter. The favicon is the brand's.

The layout sets the theme the visitor chose before the first paint,
from `localStorage`; with none it follows the system's, as the tokens
do. The toggle shows a moon in the light theme and a sun in the dark,
both Phosphor duotone; a press wears the other theme and remembers it,
and a press back to the system's theme forgets the choice.

## Figures

A section's figure is a vendored photo ([photos](#photos)) as a **line
engraving** in one of the five inks, cut into a **cluster** of the
brand's cells (`src/components/Engraving.astro`): `figure: { photo,
caption, alt, ink }` in its frontmatter, the ink the page's turn unset.

The engraving (`src/lib/engrave.ts`) is rippled horizontal lines that
swell with the tone, a hairline even in the lights, as a burin leaves,
and a crossing hatch in the deepest shadows, cut at 1600 pixels at a
pitch that makes them fine on a wide screen. It is cut once, at build,
into a mask whose alpha is the ink's coverage, an eight-level palette
PNG of a few hundred kilobytes, its own file
`/engraving/<photo>-1600.png` made by the static endpoint
`src/pages/engraving/[key].png.ts` and cached by the browser as any
image; kept in the site's ignored `.astro/engraving/` by the photo's
modification time and a version `engrave.ts` bumps when it changes how
one is cut, so the dev server, a restart and a build each reuse it. The
page lays the mask over the print's paper, `--print-paper`, washed with
a sixth of the ink, and colours it `--print-<status>-deep`, so a change
of ink is CSS, the same in either theme, as a print is a physical thing.

The cluster is the brand's (`cluster` in
[the brand](../../packages/brand/index.md)): a power diagram whose cells
follow a power law, a few large in the middle and a long tail of small
toward the rim and a tail that points back to the words, its edge a
lobed blob, never the box. The figure's SVG clips the print by it. Each
section's cluster is seeded by its page's and its own name, so it is
the same on every build. Under the figure, its caption and the credit
Unsplash asks for: the `site` entry's photo credit, the photographer's
name linked to their profile and "Unsplash" to the photo's page.

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
| `/assets/photos` | every vendored photo as the site engraves it, the five inks in turn, so no two in a row share one; hovering one shows a toolbar of the five inks, and a press wears that ink, a change of colour alone since an engraving's lines are the same in any ink; a press on a photo opens it large in its ink |
| `/assets/diagrams` | every diagram, as a post's figure shows it |
| `/assets/icons` | every icon the site draws, the toggle's, the menu's and the library's own, in every role |
| `/assets/components` | the site's components, each by its name |

Its only words are the assets' names, identifiers the copy check
passes, so it holds no copy.

## The text

Every word the site shows lives in its text, in two places laid out
alike: the operator's, `src/content/`, and an agent's **drafts**,
`src/drafts/`. The site reads each entry as the operator's file with its
draft laid under it, field by field (`src/lib/text.ts`): a field the
operator wrote wins whole, an object merges key by key, and a field
they left out, or a body they left empty, is the draft's. The operator
takes a draft over by writing that field, or the whole file, in
`src/content/`; the draft then shows nowhere and can go.

| Collection | Where | What it holds |
|---|---|---|
| `site`, `siteDrafts` | `site.yaml` | what every page shares: the site's title, description and tab title, the header's links, the menu's label, the theme toggle's label, the footer's line, sitemap and disclaimer, the blog's labels, the mark a diagram wears and the credit under a photo |
| `pages`, `pageDrafts` | `pages/<page>/<section>.mdx` | a page is a folder of sections, its hero `hero.mdx`, with the page's `title` and `description`; each section's `kind`, `order`, `eyebrow`, `heading`, `items`, `figure` and actions in its frontmatter, its body below; `home` is `/` and `blog` heads the blog |
| `blog` | `blog/<name>.mdx` | one post a file, the operator's alone: its title, summary, date, authors and whether it is a draft post, which shows in the dev server and is left out of the build |

Both places load loose, since either may hold part of an entry; the
merged entry is held to its schema (`src/schemas.ts`), and one missing
a field in both fails the build, naming the file, the field, and where
to write it.

**Drafted text is marked.** In the dev server every element whose text a
draft supplied is underlined dotted in the info ink, so the operator
sees on the page what is not yet theirs. `cella site build --release`
refuses an entry that still shows a draft's text, naming it and its
drafted fields, so a release is every word the operator's; a plain
build, as `cella check site` makes, shows drafts and marks nothing.

A page or a layout holds structure and no prose: it reads the text and
lays it out. `cella check site` refuses a page, layout or component of
the site that holds a word of copy, a string literal or a text node
outside the text, beyond what is plumbing: an `id`, a class, a path, a
`lang`, an `aria-*` attribute naming an element that the text labels,
or a string of numbers and spaces, as a viewBox's. An attribute whose
value the page renders as its content, `set:html` and `set:text`, is
never plumbing: its value is read as a text node is, a literal or the
strings of an expression, so `<p set:html="A sentence." />` fails as
`<p>A sentence.</p>` does, and markup the page takes inline, as the
lockup, comes from an import.

A post's body is MDX, so the text places the site's figures where it
reads, by name and without an import: the renderer hands every post the
site's components ([its figures](#its-figures)).

## Its figures

A post's body places a figure by its name, with the components the
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
  description in the post's text, used by both the print and the
  unprinted image. Under it, the credit Unsplash asks for. The credit is
  always printed; no prop removes it.
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
  places them, and the photo's credit once under the whole. A figure
  holds exactly one photo and any number of icons; it works in both
  themes. The build-only fixture under `test/` exercises both layouts
  in both themes: `cella check site` builds it, and fails where it does
  not build or where it builds with an icon name Phosphor lacks, so
  every gate rejects an unknown icon; `cella site screenshots` takes its
  four screenshots, over and beside, light and dark, which show the
  figure without adding any text or publishing a fixture photo.

## Photos

A photo is vendored, never linked: `cella site photo add <unsplash
url>... [--name NAME]` downloads each into `src/photos/<name>.jpg`, its
name the first three words of the page's slug unset, numbered where one
is taken, `--name` naming a single one, with a sidecar `src/photos/<name>.json`
holding what its credit needs: the photographer's name and their
profile's URL, the photo's page, its Unsplash id and the licence, the
[Unsplash License](https://unsplash.com/license), which lets the photo
be modified, as the engraving does. The photos are picked on Unsplash's
own site, which spends nothing of the API, and vendored in one run: a
page a sidecar already credits is skipped before Unsplash is asked
anything, and each new one costs two requests, its credit and the
download its guidelines ask to be told of. The two credit links carry
`utm_source=cella` and `utm_medium=referral`. With an Unsplash access key in
`UNSPLASH_ACCESS_KEY` or, unset, the development secrets'
`unsplash_access_key` ([secrets](../org/rs/index.md#secrets)), the task reads the photographer through
Unsplash's API and calls the photo's download endpoint, as the API's
guidelines ask; with none, it reads the page's public image and asks
for the name and the profile's URL on the terminal. A page that refuses
automated reads needs an access key. `cella check site` refuses a photo without its
sidecar, a sidecar missing any field, and a `<Photo name>` naming none.

## Whose words

The text is the operator's, written by hand; an agent writes
`src/content/` never, and drafts only in `src/drafts/`, which the site
marks as drafted until the operator writes over it ([the text](#the-text)).
Two guards hold `src/content/`, each routable around:

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
  needs a word of the text changed drafts it, or says so in its entry's
  Flag.

Both guards act on an agent's calls alone. No git hook, check or gate
refuses a commit that changes the text, so the operator writes it in
their own editor and commits it by hand, as any commit; a release
refuses only what is still drafted.

No gate refuses a version that touches the text, since the forge does
not yet record who pushed a version: what it keeps is the pushed
head's committer, which any agent sets.

## Running it

| Command | What |
|---|---|
| `cella site dev [--port PORT]` | Astro's dev server on `http://localhost:4321` by default, reloading on every change, the brand's files among them; drafted text underlined |
| `cella site build [--release]` | the static site into `apps/site/dist`, its pages, its styles, its engravings and the brand's fonts and images, ready for any static host; `--release` refuses any text a draft still supplies |
| `cella check site` | the copy check (`tools/site-copy.mjs`, each page, layout and component read by Astro's parser), the diagram registry and metadata check (`tools/site-diagrams.mjs`, also checking every diagram the text names), `astro check`, the type check of its `.astro` files and scripts, then its build into a temporary directory; a part of `cella check` |

`dist/` and Astro's `.astro/` are ignored by git.
