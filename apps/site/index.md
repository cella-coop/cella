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
  | `features` | its body as a lede, then its items as a list of cells |
  | `steps` | its body, then its items as steps |
  | `list` | its body, then its items as ruled rows |

Every section's `items` are one list (`List.astro`, each item an
`Item.astro`), under its body, laid out by its `arrange`, or by what its
kind implies (`arrange`, not `layout`, which MDX takes as a component to
wrap the file in):

| Layout | What |
|---|---|
| `column` | cells down the page, each beside its title and words; a section's default |
| `row` | cells side by side, each over its words, as many to a row as fit |
| `grid` | cells in two columns, each beside its words, one on a narrow screen |
| `ruled` | no cells: a title and its words in two columns every row shares, a rule under each; a `list`'s default |
| `steps` | no cells: a large thin numeral in the item's ink over its title and words, in two columns; a `steps`'s default |

The items take the five inks in turn however many there are, four on a
band, which leaves its own out. A cell is the brand's, seeded by the
item's place or its title, and holds the item's number where the list
is `numbered: true`, its Phosphor `icon` (the regular weight) in the
paper, or a person's portrait, `photo` ([the people](#the-people));
else it is bare. A body writes the same list inline, with words before
and after it: `<List layout="grid" numbered>` holding `<Item title="…"
icon="…" photo="…">`s, each its words as markdown.
  | `band` | a band of a strong ink, `ink` one of the five (`success` unset: deep sage; `error` the coral), its edges cut as a cell's, holding what any section may (eyebrow, heading, body, items, actions, a form) with its diagram beside them; with `quote: true` its body set large and its heading the attribution |
  | `quote` | a band that quotes, sage unless its `ink` says |
  | `cta` | a band, coral unless its `ink` says |

- **the footer**, on the page's own paper and its grid: the lockup
  and the site's closing line, the sitemap in columns, each a heading
  over its links, and under them the note that the site shows
  prototype work, not yet a product.

A band's edges are a rounded outline in its own box (`EDGES` in
`Section.astro`), a few long edges meeting at wide turns rounded by the
brand's own corner, its corners at the screen's sides standing past it.

A band is a strong ink, its words and its diagram light on it: the
sage a deep shade of the success ink's hue, `--band-a`, and the coral
the error's, `--band-b`, each with its light ink, `--band-a-ink` and
`--band-b-ink`, mixed from the brand's inks in `Base.astro` and deep
enough for light text in either theme. A band holds no photo: it draws
the diagram its section's `diagram` names, from `@cella/diagrams`
([its language](../../packages/diagrams/index.md#the-language)), light
on its colour, its glyphs' rings and its labels' halos the band's own,
under it the mark every diagram wears; or, in the diagram's place, the
Phosphor icon its `icon` names, one large glyph in the band's light
ink. A band that names neither, or both, fails the build, naming its
file and the field; a `figure` on a band is dropped (`src/schemas.ts`).

A section's actions, its `primary`, `action` and `secondary` links, are
a row of cells (`Actions.astro`): side by side, their tops and feet
aligned, each pair sharing a slanted edge cut by one gutter and the
row's two ends bulging, the first solid in the section's ink and the
rest a wash of it; on a band, the band's light ink and a veil of it. A small script draws the cells once the row is laid out and again
when it changes size, the cut seeded by the section; before it, and
with no script, each link is a plain rounded fill. A hovered or focused
cell swells a little.

A section with a figure sets it beside its words; down the page every
section trades sides, the hero's figure on the right and the first
section's on the left, words alone keeping to their column on their
side, a band's diagram and a quote's as a figure; the figures take the
five inks in
turn, home's hero the coral and every other page starting a step on for
each place it holds in the header's links, so no two pages open alike,
a post as its blog (`Page.astro`). A figure bleeds past the
column to the screen's edge on its outer side, its caption at that
edge. A section that asks for it, `ghost: true`, is numbered among
those that do, 01 on, as a ghost numeral: the display face's thinnest
weight, huge and faint behind the section's words, out at the
screen's edge on their outer side, a gutter in from it. A heading may
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
and never quite meet in the shadows, cut at 1600 pixels. The browser
shrinks a mask by sampling it, so a pattern near its pixel pitch beats
into moiré: the lines keep a pitch of 8 pixels, over four on a desktop
figure; a line covers at most 0.86 of it, so a gap survives the shrink;
and its edge is soft over 0.3 of it, a profile with little above its
own frequency to alias. No crossing hatch, which wove a lattice with
the lines. It is cut once, at build,
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
follow a power law, a few large and a long tail of small toward the rim
and a tail that points back to the words, its edge a lobed blob, never
the box. Its largest cells hold the photo's **focus**
(`src/lib/focus.ts`), what the photo is of: each region whole and
centred in one, the cells shrinking away from it. The focus is the
sidecar's where it names one ([photos](#photos)); otherwise it is found
at build: the faces in the photo, then the people no face was found on,
by the detectors of Human (`@vladmandic/human`), their weights shipped
in its package and run on TensorFlow's WASM backend, offline and with
no native build; and where neither is found, the peaks of its
**interest** (`src/lib/interest.ts`), a 64-cell-wide grid, 0 to 1, of
the energy of its edges, its local contrast and how like skin its
colour is, weighed toward its middle, blurred broad and normalised.
What is found is kept in the ignored `.astro/focus/` and `.astro/interest/`
by the photo's modification time and a version, as the engravings are,
then laid over the figure's box as the photo covers it; a region whose
middle the box cuts off is left out. So a face is never cut by a gutter,
and the plain background breaks small. The figure's SVG
(`src/components/Cut.astro`) clips the print by the cluster. Each
section's cluster is seeded by its page's and its own name, so it is
the same on every build. Under the figure, at the screen's edge on the
side it bleeds to and quiet, its caption in the display face over the
credit Unsplash asks for, a small spaced label: the `site` entry's photo
credit, the photographer's name linked to their profile and "Unsplash"
to the photo's page.

## The forms

A section may hold a form under its words, `form: signup` or `form:
contact`, its words the `site` entry's `signup` and `contact`:

- **the sign-up** (`Signup.astro`), compact, as the home page's Join
  band holds it: the email field and the button as one row of cells,
  the field plain ink and the button the section's, and a box a coop
  that might pilot ticks, sent as `pilot`, in line with the field's
  words. It posts to the list's endpoint, `PUBLIC_SIGNUP_URL`, the list
  sending a confirmation before anyone is on it (double opt-in).
- **the contact form** (`ContactForm.astro`), as the contact page holds
  it: a name and an email side by side, a note, a box for the
  newsletter, ticked at first, and one for the pilot, sent as `list` and
  `pilot`, and the button, one cell in the section's ink. Its fields are
  plain rounded fills of the text's ink over the paper. It posts to
  `PUBLIC_CONTACT_URL`.

A tick box is `Check.astro`: a rounded square outlined in ink, filled
with the button's ink and ticked once checked. On a band, cells, fields
and ticks take the band's light ink. Each form posts itself in the page
(`src/lib/send.ts`), so the page stays put: once sent it clears and
says what came of it, failed it says so; with no endpoint set, as in
the dev server, it sends nothing and only shows what it would say. The
list behind them is to be a self-hosted Listmonk, moving into a running
Cella scope later; neither is wired yet.

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
| `/assets/interest` | each photo a figure wears, `diverse-group-of`, `unknown-persons-using`, `people-working-on`, `group-of-people`, `person-holding-pencil` and `people-raising-their`: the photo with every region found in it drawn over it, a face's, a person's and its detail's each in its own ink and the focus its figures hold solid, named by kind, place, radius and score, and `sidecar` or `found` by where its focus comes from; beside it the figure as the site cuts it, at the hero's aspect, 1.3, and a section's, 1.2, bleeding right, its focus outlined over its cells |
| `/assets/clusters` | the clusters a figure may be cut into, on two photos, for the operator to choose from: the blob the pages wear, the brand's organic silhouettes `amoeba`, `branch`, `bubbles` and `colony`, and the filled Phosphor icons `users-three`, `house`, `hand-heart`, `tree` and `chat-circle` (`src/lib/silhouette.ts` rasterises one at build and the brand turns it into a signed distance), each sized by the cluster's middle and, beside it, `+focus`, placed on the photo's focus; an icon's cells at half the pitch, so its outline reads |
| `/assets/diagrams` | every diagram, on the paper as a post's figure shows it and on each band, light on its colour |
| `/assets/icons` | every icon the site draws, the toggle's, the menu's and the library's own, in every role |
| `/assets/components` | the site's components, each by its name |

Its only words are the assets' names, identifiers the copy check
passes, so it holds no copy.

## The text

Every word the site shows lives in its text, in two places laid out
alike: the operator's, `src/content/`, and an agent's **drafts**,
`src/drafts/`. A page's section is the operator's file whole once it
exists, and its draft, whole, only where they have written none; a
draft is a complete section, and goes once the operator writes theirs,
so deleting their file deletes the section rather than bringing a draft
back. The site's shared text, `site.yaml`, is read as the operator's
file with its draft laid under it, field by field (`src/lib/text.ts`):
a field the operator wrote wins whole, an object merges key by key, and
a field they left out is the draft's.

| Collection | Where | What it holds |
|---|---|---|
| `site`, `siteDrafts` | `site.yaml` | what every page shares: the site's title, description and tab title, the header's links, the menu's label, the theme toggle's label, the footer's line, sitemap and disclaimer, the blog's labels, the mark a diagram wears and the credit under a photo |
| `pages`, `pageDrafts` | `pages/<page>/<section>.mdx` | a page is a folder of sections, its hero `hero.mdx`, with the page's `title` and `description`; each section's `kind`, `order`, `eyebrow`, `heading`, `items`, `figure` and actions in its frontmatter, its body below; `home` is `/` and `blog` heads the blog |
| `blog` | `blog/<name>.mdx` | one post a file, the operator's alone: its title, summary, date, authors and whether it is a draft post, which shows in the dev server and is left out of the build |

Both places load loose, since either may hold part of an entry; the
merged entry is held to its schema (`src/schemas.ts`), and one missing
a field in both fails the build, naming the file, the field, and where
to write it.

An item's title and line, which the frontmatter holds as plain strings,
read inline markdown (`src/lib/inline.ts`, `marked`): **bold**,
*italic*, [links](…) and `code`, no blocks. A heading keeps its own
convention, its stars setting a part thin.

**Drafted text is marked.** In the dev server, Alt+Shift+D underlines
dotted, in the info ink, every element whose text a draft supplied, so
the operator sees on the page what is not yet theirs, and hides it
again; hidden at first, the choice kept in the browser. `cella site build --release`
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
  label, "AI-generated", in the muted text with Phosphor's sparkle, run
  out to the screen's edge on the diagram's outer side, `edge` (`r`
  unset), the sparkle outermost, which the wrapper always prints and no
  prop removes. On the paper its particles take the
  status tones; a band's, `band`, are its light ink alone. A name the
  diagrams do not list fails the build, naming it.
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

## The people

A person's picture is `src/people/<name>.jpg`, their own, so it carries
no credit sidecar. An item of a list of cells names it, `photo: <name>`,
and its cell becomes the portrait: the picture cut square round its
most telling part, engraved as a figure is but coarser for its small
size, at 480 pixels, in a deep shade of the item's ink on the print's
paper washed with it, and clipped to the cell, larger than an icon's.
Each portrait is its own file, `/portrait/<name>-480.png`, made by the
static endpoint `src/pages/portrait/[key].png.ts` and cached as an
engraving is.

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
automated reads needs an access key. A sidecar may also name the
photo's **focus**, `"focus": [{ "x": 0.5, "y": 0.4, "r": 0.08 }]`, the
regions its figures' largest cells hold, each its centre in fractions
of the photo's width and height and its radius in fractions of its
width, which replaces what is found in it ([figures](#figures)); it is
the operator's to set where what is found is wrong, and
`/assets/interest` shows both. `cella check site` refuses a photo without its
sidecar, a sidecar missing any field or with a focus not a list of such
regions, and a `<Photo name>` naming none.

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
| `cella site dev [--port PORT]` | Astro's dev server on `http://localhost:4321` by default, reloading on every change to the site and to the brand's generated files; a change to the brand's model, `packages/brand/src/`, as its clusters, takes a restart, since Vite keeps the package's modules it loaded |
| `cella site build [--release]` | the static site into `apps/site/dist`, its pages, its styles, its engravings and the brand's fonts and images, ready for any static host; `--release` refuses any text a draft still supplies |
| `cella check site` | the copy check (`tools/site-copy.mjs`, each page, layout and component read by Astro's parser), the diagram registry and metadata check (`tools/site-diagrams.mjs`, also checking every diagram the text or its drafts name, and the diagrams' vendored glyphs against Phosphor's), `astro check`, the type check of its `.astro` files and scripts, then its build into a temporary directory; a part of `cella check` |

`dist/` and Astro's `.astro/` are ignored by git.
