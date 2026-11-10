+++
title = "Site"
updated = 2026-11-10
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

The site is home, blog, about and contact: one page for each file
under `pages/` in the text, and one for each post of the blog.

| Route | File | What |
|---|---|---|
| `/` | `src/pages/index.astro` | the `home` page: whatever its file places |
| `/<name>` | `src/pages/[page].astro` | every other page but `blog`: whatever its file places |
| `/blog/` | `src/pages/blog/index.astro` | what the `blog` page's file places, then the posts newest first, each a card with no frame, two to a row and one on a narrow screen, the whole card its link: its cover where it names one, its photo engraved small (`/cover/<name>-600.png`, its lines drawn for a card's size, as a portrait's are, so they never beat into moiré) and cut into the brand's cells round its focus, in a box three wide to two tall so a row's words start level, and tight under it, at its left edge, its date, title and summary, so cover and words read as one. A post's ink is its own `ink`, or else its place in the order the posts were published, oldest first, in the five inks' turn (`postInk` in `src/lib/place.ts`), so it never changes as posts follow it, no two posts in a row share one, and the post's own page wears the same |
| `/blog/<name>/` | `src/pages/blog/[post].astro` | one post: its title as the hero, its date over it and its summary under it, its authors, its body |

Every page wears `src/layouts/Page.astro` over `src/layouts/Base.astro`:

- **the header**, sticky, on a pane of glass with the paper's grain in
  it, near white in the light theme and near black in the dark, seen
  through and borderless: the brand's lockup linking home, the `site`
  entry's links, the current page's marked, and the theme toggle, an
  icon alone in the bar's far corner. On a narrow screen the links fold
  into a menu under Phosphor's `list` icon, a `<details>`, which opens
  and closes with no script; a small one closes it too on a press
  outside it or Escape.
- **the page's body**, whatever its file places, in the order it places
  them ([the layout](#the-layout)); words it writes outside a section,
  as a post's prose, keep to a readable column at the sections' left
  edge.
- **the footer**, on the page's own paper and its grid: the lockup
  and the site's closing line, the header's links in a row, the home
  page's first, and under them the note that the site shows prototype
  work, not yet a product.

## The layout

A page is one MDX file, and its body places the site's components by
name, with no import, the prose between them markdown (`src/components/figures.ts`):

```mdx
+++
title = "About"
+++

<Hero eyebrow="Project status" heading="An early-stage project" photo="white-red-and">

Cella is currently in an early prototyping phase.

<Actions>
  <Action href="/contact" primary>Get in touch</Action>
</Actions>

</Hero>

<Section heading="Team" photo="aerial-shot-of" caption="Many trees, one canopy" ghost>

Cella is made by …

</Section>

<Band ink="help" icon="heart" eyebrow="We want you" heading="*Looking for*\ncofounders">

A one-member cooperative is sad! …

<Signup />

</Band>
```

| Component | What |
|---|---|
| `Hero` | the page's top: its `eyebrow`, its `heading`, the page's one `h1`, its body as a lede, and its `photo`, engraved in the page's first ink, overhanging the section after it |
| `Section` | a section: its `eyebrow`, `heading` and body, a lede unless `prose` sets it as reading text, beside its `photo`, engraved in the page's next ink, with its `caption` and its `alt`; `ink` sets the photo's ink where the turn should not |
| `Band` | a band of a strong ink, `ink` one of the five (`success` unset: deep sage; `error` the coral), its edges cut as a cell's, holding what a section may beside the diagram its `diagram` names, or over the engraved Phosphor icon its `icon` names, never a photo; with `quote` its body set large and its heading the attribution |
| `List`, `Item` | a list, laid out by its `layout` and counted where `numbered` ([the lists](#the-lists)) |
| `Actions`, `Action` | a row of links as a row of cells, `primary` the solid one |
| `Signup`, `ContactForm` | the compact sign-up and the contact form ([the forms](#the-forms)), their words the site's |
| `Diagram`, `Photo`, `Icon`, `Figure` | a figure in the prose ([its figures](#its-figures)) |

A `Section` and a `Band` are told where they stand at build, before the
file is compiled (`src/lib/sections.ts`, a Vite transform of the
source, never the file): the page's top-level `Hero`, `Section` and
`Band`, each written at the start of a line, learn their page, and each
`Section` and `Band` its place among them, the ink of its photo's turn,
and, where it asks with `ghost`, its numeral. So a page lays itself out
by the order it is written in: down the page the sections trade sides,
the hero's figure on the right and the first section's on the left,
words alone keeping to their column on their side, a band's diagram and
its icon as a figure; the photos take the five inks in turn, home's hero
the coral and every other page starting a step on for each place it
holds in the header's links, so no two pages open alike, a post as its
blog (`src/lib/place.ts`). A figure bleeds past the column to the
screen's edge on its outer side, its caption toward that edge, a gutter
in from it and at most 5rem past the column. A section
that asks with `ghost` is numbered among those that do, 01 on, as a
ghost numeral: the display face's thinnest weight, huge and faint behind
the section's words, out toward the screen's edge on their outer side, a
gutter in from it and at most 6rem past the column. A heading may mark its closing part with stars,
`*like this*`, set thin, and break its line where it writes `\n`.

Under 56rem a section stacks, whatever it holds: its words over its
figure, a band's words over its diagram or its icon, the icon smaller.
A section's words are a container (`container-type: inline-size`), so
what they hold lays itself out by their column's width, not the
screen's: a list's two columns fold to one, a ruled list sets each
title over its words, the contact form's name over its email, and a
portrait keeps a third of the column. Everything a finger presses, a
link of the header, the menu, the footer or a credit, a cell, a tick,
is at least 44px tall.

A section's ink is set on it, so what its body places, its actions, its
forms and its ticks, takes it, and a band hands its lists the four other
inks. Its anchor is its heading's words, lowercased and joined by dashes,
or its `id`. A component placed wrongly fails the build, saying what is
wrong, where, and what would fix it (`src/lib/refuse.ts`): a band with
neither a diagram nor an icon, or both, or a photo; a section with a
diagram or an icon; a diagram or a photo the site does not have.

A component reads the same however its source is laid out: an
`Action`'s label written on its own line, which MDX makes a paragraph,
is unwrapped, and an `Item`'s words set alike either way, so a
formatter may lay the file out as it likes ([formatting](#formatting)).

## The lists

A `List` holds `Item`s (`List.astro`, `Item.astro`), each its `title`
and its words as markdown, laid out by its `layout`:

| Layout | What |
|---|---|
| `column` | cells down the page, each beside its title and words; the default |
| `row` | cells side by side, each over its words, as many to a row as fit |
| `grid` | cells in two columns, each beside its words, one in a narrow column |
| `ruled` | no cells: a title and its words in two columns every row shares, a rule under each; in a narrow column the title over its words |
| `steps` | no cells: a large thin numeral in the item's ink over its title and words, in two columns, one in a narrow column |

The items take the five inks in turn however many there are, four on a
band, which leaves its own out. Each list's turn starts where and runs
in the order its own seed draws (`shuffled` in `src/lib/place.ts`): its
`seed`, or, unset, one from its items' words, never their tags, so the
dev server and a build agree; a list that wants another order is given
a `seed`. A cell is the brand's, seeded by the
item's place or its title, and holds the item's number where the list
is `numbered`, its Phosphor `icon` (the regular weight) in the paper,
or a person's portrait, `photo` ([the people](#the-people)); else it is
bare. On a wide screen, a section whose list stands side by side,
`row`, `grid` or `steps`, or that holds a form, gives its words half
the width beside its figure.

## Bands and actions

A band's edges are a rounded outline in its own box (`src/lib/edge.ts`,
which `Block.astro`, the layout every section shares, clips the band
by), a few long edges meeting at wide turns rounded by the brand's own
corner, its corners at the screen's sides standing past it. Each band's
bends are its own, drawn from its seed by the brand's seeded `rng` and
the same on every build: its top rises to a crest and its foot dips to
a trough, each somewhere along the width and well apart from the other,
so no two bands lean alike. The outline is a CSS `shape()` whose top
edge is measured down from the band's top and its foot's up from its
foot, each as deep as the band's height makes it but never deeper than
`--reach`: past any wide band's height, so a wide band is cut as its
outline stretched over it, and 28rem under 56rem, where a band stacks
and grows tall, so its edges never sink into its words. A browser with
no `shape()` clips the band by the same outline as an SVG clip path,
which stretches with it.

A band is a strong ink, its words and its diagram light on it: the
sage a deep shade of the success ink's hue, `--band-a`, and the coral
the error's, `--band-b`, each with its light ink, `--band-a-ink` and
`--band-b-ink`, mixed from the brand's inks in `Base.astro` and deep
enough for light text in either theme. It draws the diagram its
`diagram` names, from `@cella/diagrams`
([its language](../../packages/diagrams/index.md#the-language)), light
on its colour, its glyphs' rings and its labels' halos the band's own,
under it the mark every diagram wears, on the band's outer side. Its
diagram keeps 22rem beside its words on a wide screen, and a diagram
drawn under 440px wide sets its labels larger in its own units, so they
still read.

A band may hold, instead, the Phosphor icon its `icon` names
(`BandGlyph.astro`, `src/lib/glyph.ts`): the filled glyph engraved as a
photo is, cut from rippled lines that swell and thin down it, their
phase the band's own by its seed; large and faint in the band's light
ink, behind its words, which then take their column as a section's
alone would; running off the band's far side and turned away in
perspective, the turn mirrored as the bands trade sides; on a narrow
screen, fainter still, at the band's foot.

A row of `Action`s is a row of cells (`Actions.astro`): side by side,
their tops and feet aligned, each pair sharing a slanted edge cut by one
gutter and the row's two ends bulging, the `primary` one solid in the
section's ink and the rest a wash of it; on a band, the band's light ink
and a veil of it. A small script draws the cells once the row is laid
out and again when it changes size; before it, and with no script, each
link is a plain rounded fill. A hovered or focused cell swells a little.

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
brand's cells (`src/components/Engraving.astro`): a `Hero`'s or a
`Section`'s `photo`, `caption`, `alt` and `ink`, the ink the page's turn
unset.

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
at build, in tiers, by the detectors of Human (`@vladmandic/human`),
their weights shipped in its package and run on TensorFlow's WASM
backend, offline and with no native build: the faces in the photo with
the people no face was found on, then its hands at work, then its
people alone, and last the peaks of its **interest**
(`src/lib/interest.ts`), a 64-cell-wide grid, 0 to 1, of the energy of
its edges, its local contrast, how like skin its colour is and how far
its colour stands from the photo's own, weighed toward its middle,
blurred broad and normalised, a peak that would overlap a stronger one
left out. A face the detector is unsure of counts only on skin and held
by a person found round it, so a cup, a watch or a map is no face; a
person whose box runs off the photo's top has no head in it. What is
found is kept in the ignored `.astro/focus/` and `.astro/interest/` by
the photo's modification time and a version, as the engravings are,
then laid over the figure's box as the photo covers it. A figure holds
the best tier its box shows one of the leads of, a face, a hand, a
person or a peak: a region shows when its middle lies inside the box by
a quarter of its radius, and one a third the size of the largest shown
is left to the small cells, as a crowd behind the subject is. So a cut
that loses a photo's faces to its edges holds its hands, a face is
never cut by a gutter, and the plain background breaks small. The figure's SVG
(`src/components/Cut.astro`) clips the print by the cluster and shows
the box only from its highest cell to its lowest, so no bare paper
stands between the cells and the caption. Each
section's cluster is seeded by its page's and its own name, so it is
the same on every build. A figure that bleeds left is cut twice, the
second cut bleeding right: stacked under its words under 56rem, it has
no words beside it to point its tail to, so it wears the second cut and
bleeds right, as the hero does. Under the figure, toward the screen's
edge on the side it bleeds to, at most 5rem past the column, and quiet,
its caption in the display face over the
credit Unsplash asks for, a small spaced label: the `site` entry's photo
credit, the photographer's name linked to their profile and "Unsplash"
to the photo's page.

## The forms

A section's body places a form by its name, `<Signup />` or
`<ContactForm />`, its words the `site` entry's `[signup]` and
`[contact]`:

- **the sign-up** (`Signup.astro`), compact, as the home page's Join
  band holds it: the email field and the button as one row of cells,
  the field plain ink and the button the section's, and a box a coop
  that might pilot ticks, in line with the field's words. It posts to
  Listmonk's public form on the site's own domain,
  `PUBLIC_SIGNUP_URL` (`/subscription/form`), naming the lists by
  their ids: the newsletter always, `PUBLIC_SIGNUP_LIST`, and the
  pilot's where its box is ticked, `PUBLIC_PILOT_LIST`. Listmonk sends a
  confirmation before anyone is on a list (double opt-in). The lists,
  their ids and Listmonk live on the production host
  (`hosts/prod/production/` in the workshop).
- **the contact form** (`ContactForm.astro`), as the contact page holds
  it: a name and an email side by side, one over the other in a narrow
  column, a note, a box for the
  newsletter, ticked at first, and one for the pilot, sent as `list` and
  `pilot`, and the button, one cell in the section's ink. Its fields are
  plain rounded fills of the text's ink over the paper. It posts to
  `PUBLIC_CONTACT_URL` (`/message`), the production host's contact
  endpoint, which keeps the message, mails it to the inbox and
  subscribes its sender to the lists its boxes tick. A form sends its
  fields URL-encoded, as an HTML form does.

A tick box is `Check.astro`: a rounded square outlined in ink, filled
with the button's ink and ticked once checked. On a band, cells, fields
and ticks take the band's light ink. Each form posts itself in the page
(`src/lib/send.ts`), so the page stays put: once sent it clears and
says what came of it, failed it says so; with no endpoint set, as in
the dev server, it sends nothing and only shows what it would say. So
a release refuses a form that posts nowhere, naming what to set or
telling the page to drop it, rather than tell a visitor it sent.

## The address

The site's email address, `email` in `site.toml`, shows in the footer
under the site's line and wherever a page places `<Email />`
(`Email.astro`, `src/lib/email.ts`). People see it whole and can copy
it; the page's source never holds it whole: a few digits the page hides
stand between its parts, so a harvester reading the source takes a
broken address, and its `mailto:` link is written from the address
encoded once the page runs. A page that places `<Email />` with no
address in `site.toml` fails the build.

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
| `/assets/cutouts` | every photo of the library cut as the site cuts it (`Engraving.astro`), its cells placed round its focus, in the five inks in turn, each photo's seed its name's; two buttons that follow the page choose its cut, as a section beside its words wears it, 1.2 wide to 1 tall, or as a stacked figure on a narrow screen, 1.9 to 1, and its side, bleeding off the screen's right edge or its left, as a page's figure does; the choice is kept in the browser |
| `/assets/diagrams` | every diagram, on the paper as a post's figure shows it and on each band, light on its colour |
| `/assets/icons` | every icon the site draws, the toggle's, the menu's and the library's own, in every role |
| `/assets/components` | the site's components, each by its name |

Its only words are the assets' names, identifiers the copy check
passes, so it holds no copy.

## The text

Every word the site shows lives in its text, in two places laid out
alike: the operator's, `src/content/`, and an agent's **drafts**,
`src/drafts/`. A page is the operator's file whole once it exists, and
its draft, whole, only where they have written none; a draft is a
complete page and goes once the operator writes theirs, so deleting
their file deletes the page rather than bringing a draft back. The
site's shared text, `site.toml`, is read as the operator's file with its
draft laid under it, field by field (`src/lib/text.ts`): a field the
operator wrote wins whole, a table merges key by key, and a field
they left out is the draft's. The text is TOML throughout, as every doc
in the repository is: `site.toml`, and each page's and post's
frontmatter between `+++` lines.

| Collection | Where | What it holds |
|---|---|---|
| `site`, `siteDrafts` | `site.toml` | what every page shares: the site's title, description and tab title, the header's links, the menu's label, the theme toggle's label, the footer's line, home link and disclaimer, the blog's labels, the forms' words, the mark a diagram wears and the credit under a photo |
| `pages`, `pageDrafts` | `pages/<name>.mdx` | a page a file: its `title`, its `description` and whether it is `unlisted` in its frontmatter, and in its body the components it places ([the layout](#the-layout)); `home` is `/` and `blog` heads the blog |
| `blog` | `blog/<name>.mdx` | one post a file, the operator's alone: its title, summary, date, authors, its cover (`photo`, with `caption`, `alt` and `ink`, engraved beside its title as a page's hero's) and whether it is a draft post, which shows in the dev server and is left out of the build; its body places what a page's may |

A page's frontmatter and a merged `site.toml` are held to their schemas
(`src/schemas.ts`), and one missing a field fails the build, naming the
file, the field, and where to write it.

**An unlisted page** (`unlisted: true`), such as a pitch sent by its
address alone, is kept from search engines (`noindex, nofollow`), and
the build fails while the header's links, and so the footer's, link it.

An item's title reads inline markdown (`src/lib/inline.ts`, `marked`):
**bold**, *italic*, [links](…) and `code`, no blocks; its words are
markdown. A heading keeps its own convention, its stars setting a part
thin.

## Formatting

`cella site fmt` formats the text and the drafts with Prettier, by the
site's `.prettierrc.json`, which an editor formatting on save reads too;
`--check` names what it would change. The operator runs it on their own
text. A component reads the same however its source is laid out
([the layout](#the-layout)), so formatting changes no word on a page.

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
  out toward the screen's edge on the diagram's outer side, `edge` (`r`
  unset), a gutter in from it and at most 5rem past the column, the
  sparkle outermost, which the wrapper always prints and no
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
paper washed with it, and clipped to the cell, larger than an icon's:
a third of the column it stands in, 5.5rem to 12rem.
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
  `Edit`, `Write` or `NotebookEdit` of one. It refuses the same done
  to a directory that holds the text: an `rm -r`, `mv`, `find -delete`
  or `rsync --delete` of the text's directory or of any directory
  above it, the repository's root among them, git's `rm -r` and `mv`
  too, and an `mv` or `cp` that lands on one; a `git restore`,
  `checkout` or `clean` whose pathspec holds the text, or a `git clean`
  with none run from such a directory; and a `git reset --hard`, a
  `git stash`, and a `git checkout` or `git switch` forced by `-f`,
  `--force` or `--discard-changes`, while the text has changes git has
  not committed. It reads every pathspec of a `git rm`, before `--` and
  after it, by the same rule. A branch checked out or switched to
  unforced, a git command in another repository, and every
  such command on a directory beside the text, pass. It refuses a
  write and nothing else: a call that names the path without writing there
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
