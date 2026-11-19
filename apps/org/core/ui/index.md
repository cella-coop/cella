+++
title = "UI"
updated = 2026-11-19
+++

The shell's design system (`@cella/org-ui`): the tokens, the one shell,
page frame, collection component, detail view and drawer, and the
primitives a slice's blocks compose. It is the only package that holds
CSS; `cella check feats` refuses a `<style>` or a `style` attribute in any
other `.svelte` file, so no page or block styles itself.

## Tokens

The shell wears `@cella/brand` ([brand](../../../../packages/brand/index.md)):
`styles/tokens.css` imports the brand's `fonts.css` and `tokens.css` and
lays over them only what is the shell's own. The tones, the shades, the
roles, the theme and the type are the brand's, so a change of brand is a
change of its `house.json` and never of this package. Colours are
parametric OKLCH: a tone is a chroma and a hue (`--tone-base`, graphite
paper; the five states, error, warning, success, info and help), a shade
is a lightness mirrored around a midpoint by one sign, `--theme`, so dark
mode is that variable alone, every shade mirrored. The brand has
no accent: the five status hues are the brand, and an action is plain
ink. Components read roles, never shades:

- surfaces: `--ground` under the sidebar, `--panel` under the content
  and its drawer alike, `--raised` for cards and stats on the panel,
  `--float` for floating things, `--sunk` for fields and a segmented
  control's well, `--selected` for its chosen segment, lighter than the
  well in both themes, `--hover`;
- layering: a surface declares the solid colour it is as `--surface`
  and paints that, the page's own the ground, the content the panel
  (`Shell`), a card, a board's tile, a panel, a thread and a group's bar the
  raised step, a board's column the panel a breath toward the text, a
  popover, a select's list and a dialog the float, and a list's, a
  table's or a menu's row under the pointer or the keyboard the hover
  laid solid on the panel (`--hovered`); what sits on it reads it, so a
  `Chip` fills one step from it toward the text (`--lift`, darker in
  light and lighter in dark) and an avatar's ring cuts out in its
  colour, whatever it sits on, and a `Stat`'s tile fills the same way at
  a lighter step, so it stands out on a panel;
- text: `--text`, `--text-muted`, `--text-subtle`; the shell sets
  `--text-subtle` to the muted step, since the brand's subtle step reads
  under 4.5:1 on the ground and the wells and its quiet text is small;
- ink, the roles still named accent: `--accent-fill`, the text's
  lightness in either theme, so a primary button is plain ink with the
  panel's `--on-accent` on it, and `--accent-border`, `--accent-text`,
  `--accent-soft`;
- type: the brand's, Urbanist for the shell's display and headings, its
  buttons and the mark (`--font-display`), Inter for everything read or
  measured (`--font-text`, which the shell reads as `--font-ui`), the
  coop's own writing whole, a document's headings and `Prose` included,
  Geist Mono for code (`--font-mono`), self-hosted
  from Fontsource through the brand's `fonts.css`; headings take the
  brand's weight and tracking, the body its weight and leading. The
  shell keeps its own denser scale, `--text-2xs` to `--text-2xl` around
  15px, beside the brand's `--t-*`. There is one heading (`Heading`),
  a panel's, a section's, a card's, the drawer's sections' and the
  record page's Related and Activity: Urbanist at 650, a tenth over the
  small size, a tad below muted (the operator, 19 Nov), in sentence
  case, its icon before it and its count muted beside it; a table's
  columns' labels and a stat's label are quiet sentence case, and
  nothing is set in small capitals. The page's content sets one inline
  padding (`--inset`), a record's column a step more, that its notes,
  forms, properties and figures share with its titles and its tables'
  first column, so a block never sits left of its heading; a panel's
  and a card's own padding is their inset;
- states: a state has one look everywhere, a table's cell, a list's
  line, a card, the drawer, a panel's header: a soft pill with a dot and
  its word (`Badge`, which `Value` draws for a `badge`), the dot in its
  tone or, where the tone has no colour of its own, in an ink seeded by
  its word. A badge's tone is its state's class, alike in both themes:
  neutral at rest (a draft, closed, voided), accent under way (open,
  unpaid, submitted, approved and not yet paid), drawn as an ink ring
  with no fill so it never reads as an alarm, positive settled, warning
  wanting attention (overdue, suspended), negative refused or failed;
  positive and negative are the brand's success and error
  (`--positive-*` reads `--success-*`, `--negative-*` reads `--error-*`),
  and info and help wait for a state that needs them. The soft fills are
  tints (`--soft`, the brand's `--soft-a`), lighter in dark, so a tone
  shows in its text and never saturates; a state is never told by colour
  alone, keeping its word; a tone's text is never dimmed, since it
  clears 4.5:1 on its tint only at full strength: a calendar entry's
  time wears it as its title does;
- locale: the app's, `locale` in `models/format.ts` (en-GB), writes
  every day (16 Oct 2026) and is how a date field reads and types one
  (16/10/2026), whatever the browser's language; amounts read as euros
  the French way;
- shape: the brand's 12px radius on floating things and panels
  (`--radius`), 6px on controls; soft shadows on floating things only
  (`--shadow-float`);
- focus: one ring, `--focus`, on whatever the keyboard reaches, a field
  as much as a button; a focused field keeps the ring with its accent
  border, a table's cell drawing it as an outline (`--focus-outline`),
  where a shadow would be clipped; and nothing sets `outline: none`
  without drawing the ring.


The theme is light, dark or the system's, a cookie the server writes into
`<html data-theme>` before any script runs.

The dev server alone serves a specimen of the shell in the brand's inks,
`/specimens/ink`, a page of no slice that reads nothing, drawn by
`Inks`, where the operator approved landing the site's five pentad
inks (`--p0` to `--p4`) in the working tool (09:50, 14 Nov). Ink marks
identity and the one primary action, and never fills a surface: the
primary button solid in its ink (`styles/base.css`'s `--primary-fill`,
`Button`'s alone, so a secondary action, a checkbox and a date field's
selection stay as they were); a feature's run of collections in its
own ink, in the sidebar's turn (`Shell`); a record chip's icon or dot
in its own, even drawn as a badge (`Chip`, `Badge`); a closed set's
group header bar, a state's (`Group`); and a circle's or a person's avatar seeded by
its name (`Avatar`), as the site seeds its lists — every one landed,
across the app. A secondary action as a wash of the lead ink, the
selected navigation row and the focus ring stay candidates, laid over
the specimen alone until they land too. What stays neutral: tables,
body text, forms and panels. The semantic tones keep their
meanings, so no ink is a state's. The page shows both themes side by
side, and each text on ink states its contrast, every one at least WCAG
AA's 4.5:1 (3:1 for an icon or a ring). The inks are handed out in the
site's turn started at the blue, so the first area's primary action never
reads as a refusal, and one table, `models/ink.ts`, both draws each
role and measures it, so the contrast the page states is the one it
draws.

## Components

- `Shell`: the grid, sidebar · content. The sidebar shows the circle
  the member is in. Its top and foot stay put and only its middle
  scrolls. Its top is the coop selector, the coop's mark and name,
  followed by the circle's name where the member is in one but the
  assembly, "Lanterne / Web", so a lens is never hidden. Its menu lists
  the scopes the shell serves (one today) with their legal names; the
  coop row, whose root is the assembly, is checked where the member has
  no lens and clears it, and below it come the circles the member sits
  in, with the lens's own where they do not; nothing lists all circles
  at once, and a rule sets Settings apart below them. A circle chosen
  there is the circle the member is in, their **lens**, which every
  collection reads through
  ([architecture](../../../../_corpus/doc/architecture.md#the-lens)):
  a cookie of the scope's, written by `/lens` as `/theme` writes the
  theme, so the server renders the lensed page and nothing of it enters
  the log; a lens naming a circle the member no longer reads, or the
  assembly, is none, and with none the member is in the assembly, which
  reads whole. A sign-in clears it, so it lands in the assembly. Then,
  always shown, the Inbox, whole whatever the lens, since it is what
  waits on the member, where `/` and the sign-in land, and Activity,
  the log read as a list of who did what; then Pinned, the one place
  the same in every circle: the views the member pinned, a collection's
  preset or one of their own, each its icon and its name, opening its
  view at its own address, in the circle the member is in unless the
  view reads across circles. A pin is a preference, never a record,
  kept in the browser beside the viewer's own views (`PinnedState`,
  `Saved`'s `pins`), and follows the view it pins: renamed or changed,
  so is the pin, and deleted, it goes. With none pinned, Pinned says
  where a view is pinned from. The middle holds the features
  the circle the member is in enabled, in its order
  ([features](../circle/index.md#features)), each drawn as its
  collections: those its feat owns that the sidebar lists, outside
  Settings, so a feature that owns none, as membership, which adds to
  the people, or one whose only collection is Settings' or unlisted, as
  imports and files, shows nothing of its own. A run of features under
  an accordion the circle named sits under it, as Linear's teams, its
  name and a caret, flat, never nested, a dot on a shut one whose
  collections hold rows waiting on the acting member, whole whatever
  the lens as the Inbox is; open, its collections hang from a guide
  line, each collection's icon in the run's own ink, the turn's, as the
  ink specimen's nav proposes (`nth`). The features under none are
  listed flat in their place, in the turn too. Nothing
  the circle has not enabled is shown, nor a count of what another
  circle holds; the command menu still reaches every collection. Last
  in the middle, More…, quiet and right-aligned with a + before it,
  opens the circle's features page in Settings
  ([the circle's shell](../circle/index.md#shell)). A collection the
  view declares `counted` shows how many rows it holds for the acting
  member, in the lensed circle where there is a lens, the count its
  page heads with, in a small quiet pill. Several accordions may be
  open at once: one the viewer never touched is open while it holds the
  page, and one they opened or shut stays so across page loads, a cookie
  keeping it as it keeps the drawer, so the server renders the
  accordions as they left them. The foot is the command menu,
  then the account menu, the signed-in member, whose menu holds their
  address, Settings and Sign out, beside one icon button for the theme,
  which cycles system, light and dark and shows the current one. Settings is its own
  sidebar, one for the member and the coop as Linear's, in place of
  the top and the features while one of its pages is open: Back to app,
  which returns to the last page left, then Settings' own heading, the
  sidebar's title, above the `platform` collections in two groups, each
  under a small, dim label naming its `subgroup`: Personal, the
  member's own (Devices), then Organization, the coop's (Imports,
  and Features, the circle the member is in, the same page More…
  opens). The account menu's Settings opens
  it at Personal's first page, the coop menu's at Organization's. In
  dev mode a faint upright "prototype" with a test tube sits at the
  content's bottom right. A demo build's banner (`DemoBanner`) is one
  fixed strip along the viewport's foot, on every page, never dismissed,
  which pads the page it sits on by its own height so it hides nothing: a
  flask, "Prototype · mock coop", its tooltip the operator's notice and,
  on a visitor's copy, that Lanterne is a mock and the copy the
  visitor's own; a timer and the time left, shown once there is one to
  watch, the room's lifetime once its first member has signed in, else
  the idle reset's own last two minutes, a warning; Reset, a quiet
  button posting to the demo's front; and, in a room, Copy invite, the
  filled primary button, which copies the room's link and confirms
  Copied, or opens it where the clipboard refuses. The last write's
  outcome floats above.
- `Logo`: the coop's mark in its square, `md` in the selector, the
  sign-in card and the gate, `sm` in the selector's menu: the logo its
  particulars mark, an SVG drawn as an image from a `data:` URL and
  never inlined, so no script in it runs and nothing outside it loads
  ([the coop's particulars](../circle/index.md#the-coops-particulars));
  with none, its name's initial on the accent fill.
- `Gate`: what a person reaches before signing in, alone on the page,
  the coop's mark and name above one panel, in a demo build the same
  banner at the viewport's foot; `SignIn` in it, a button for
  each device this browser keeps for the scope, which signs the server's
  challenge, the fixture members on the dev server, a demo's leading the
  panel under one demo tag on their heading; and `Join`, an
  invitation's link opened, whose one button makes the invitee's first
  device in this browser and takes the invitation up with it, then
  loads the invitee's own page afresh, reading nothing again first. A
  browser holding no device of its own reads why, collapsed, below the
  members; a key made here for its person to enrol from a device they
  hold sits under its own disclosure too. Until the
  browser runs the page's script, their buttons read as busy, since a
  click before it would do nothing.
- `Popover`: the one popover and menu, opened from its trigger in the
  top layer (native `popover`), so nothing clips it: Escape and a click
  outside close it and focus returns to the trigger; anchored by CSS
  anchor positioning and flipped to stay in the viewport, placed by
  `models/place.ts` where a browser lacks it; as a menu it focuses its
  checked or first item and moves with the arrows, Home and End. Its
  trigger is named by what it shows, so a voice naming it reaches it,
  and its `label`, which names the popover, describes the trigger. Its
  trigger fills its row, as in the sidebar, or reads as a quiet button
  (`button`) or a chip (`chip`), as a condition on a collection's rows;
  `open` opens it once drawn, as a condition just added opens to pick
  its values. The ui
  check refuses a layer floated by hand (`position: absolute` with a
  `z-index`) anywhere else.
- `Dialog`: the one modal, a native `dialog` in the top layer, what
  lies behind it dimmed: its title naming it, what it says above its
  form, the form's fields, why the last submit was refused, and two
  buttons, Cancel and the one that confirms. A modal is no page: it
  confirms what it holds. Cancel, Escape and a click outside it cancel
  it alike; whoever opens it holds the element and decides what a
  cancel takes back. It holds forms of their own where its opener hands
  it no submit, as New does a collection's create forms, each ending in
  its own confirming button and Cancel.
- `Diff`: a change shown in its own terms, never a programmer's text
  diff (`models/diff.ts`), the one view of a change wherever it is
  shown, a motion's dialog and its page alike, one shape a kind of
  change. An arrangement, as a circle's features, is drawn as its tree
  once changed: each choice marked added, moved from the accordion or
  the top level it left, or reordered within its own, the fewest marked
  as reordered that keep the rest in order; an accordion new to it
  marked; and those it no longer shows listed under it, struck through.
  A plain value is the one in force struck through, an arrow and the
  new one. Each mark is a word as well as a colour. Where what it
  replaces is not known, the new value stands alone, unmarked. A policy's
  text, compared as rich text, is the next shape.
- `Who`: who changes a setting, one quiet icon beside its label
  ([settings](#settings)), its tooltip in the top layer.
- New: every collection's create, the header's New and its `c`, opens
  the one `Dialog` titled for the collection ("New in Tasks"), holding
  the create form the collection or its extensions declare, each under
  its title where there are several, mounted only while it is open, so
  each New starts empty (`CreateState`, `useCreate`). A `Form` under it
  is a create form: its fields and its write are its slice's, and it
  ends in Cancel and its confirming button (Create task, Propose). A
  write that settles closes the dialog, the rows read again with the new
  one among them; a refusal keeps it open with what was typed and the
  guard's reason inside it, above its buttons; Cancel, Escape or a click
  outside closes it with nothing written. While it is open the rows
  behind it take no key. **A modal is not a page**: it holds one task
  and ends in the buttons that confirm it (create, save, propose) and
  one that cancels; **a page holds no create form**. The ui check
  refuses a component that imports a create form a slice's app declares,
  and the UI core drawing a collection's creates outside its Dialog
  ([enforcement](../../../../_corpus/doc/enforcement.md)); a block
  drawing a form that creates a record of another kind on its own page
  no tool sees, and review holds it. **No page draws a Save button**
  either: a document's New version and a dashboard widget's Add or
  Save confirm in the one `Dialog`, never an inline form. The ui check
  refuses a `Form` drawn on a page, outside a `Dialog` or
  `ProposeInstead`, whose submit starts with Save
  ([enforcement](../../../../_corpus/doc/enforcement.md)).
- `Frame` (`PageFrame.svelte`): the one page frame, its header one
  compact row as Linear's, spanning the content and the drawer: on an
  item, a breadcrumb as Linear's, its collection's icon and name as the
  sidebar shows them, muted, a link back to the collection, a small
  caret, then the item's title in the text's colour, which alone gives
  way to a narrow row, cut short by an ellipsis (the circle is left out,
  since the coop menu names it); on a collection its icon and its name;
  the page's caption as the name's tooltip, with its count and status
  badges; the
  page's tabs right after, a collection's views, scrolling in their own
  strip; then the page's writes and one quiet icon group, the drawer's
  panel tabs beside its toggle, which stays there when the drawer is
  shut. A write in the header keeps the row one line: its fields'
  labels are read by assistive technology and not seen, and a choice is
  at most 16rem wide. A form a header's popover opens is no part of
  the row: its fields show their labels and its choices take its width.
  Under it, the content and the drawer, which
  scrolls down and never across. Where the window cannot hold the
  sidebar, the content at its least width and the drawer side by side,
  the drawer lies over the content's right edge at its own width,
  raised as a floating thing is, and its toggle, `]` or Escape shuts
  it; nothing wraps under the content, and the header stays its one
  row, its tabs scrolling in their strip. The toggle, or `]` anywhere, shows and
  hides the drawer on every page at once; a cookie keeps the viewer's
  choice, so the server renders it. One tab per panel, the open one
  marked even when alone: a collection's View, an item's Details.
  While a navigation runs (SvelteKit's `navigating`), its content stays,
  dimmed and `aria-busy`, until the next page's queries answer. A
  navigation a component starts, the collection's, the detail's Escape
  and the command menu's, lets go where it starts of one the next
  navigation abandons, overtaken or unloaded under, and raises any other
  failure (`models/navigation.ts`), so leaving a page mid-navigation
  raises no page error in any browser.
- `Skeleton` and `Failed`: what a page's boundary draws while its
  queries load the first time, its frame named by what the shell knows
  without them and quiet lines where its content goes, static and
  holding no component with state; and when a query throws, not found
  or broken, with the error's status and message, inside the shell.
- `Collection`: the one collection component, the same header, filter
  bar, view bar and rows for every collection, and a drawer holding one
  panel, View (`Viewing`), of one shape for every collection, as
  Linear's display menu, display only: layout, grouping, sort and
  fields. At its top the layout, a segmented control of icons (list ·
  table · gallery · board · calendar, those the
  collection's fields allow; a dashboard is no choice here, though a view
  already laid out as one keeps showing it and rendering as it does), then the same rows in the same order
  everywhere, each a label and a dropdown, ending on one right edge:
  Group by (any enumeration, person or circle field, a record link, a
  boolean, a text field holding few distinct values, at most 20 across
  the rows, a date by its
  month, or None: a board's columns, never a month, and in a list, a
  table and a gallery a header over each group's rows, naming its
  value, a date's month in full, and its count as a board's column
  does, the field leaving the rows, as its header names it; a
  calendar's date, and month or week, and a value that colours
  each card, a legend over the calendar naming each value with its
  colour and count) and Order by (the direction's toggle, ascending or
  descending, before it, and the field alone, any of the collection's;
  the order the view opened with, else the field its read leads with,
  else As listed, is marked quietly in the options as the default,
  never named in the panel); then Display, a
  row that opens a popover of what is shown (in a list, the fields under
  and after each row's title, in a table, its columns, in
  a gallery or on a board, its cards' fields, in a calendar, its cards'
  fields, in a dashboard, its widgets); then Circles, what the view
  reads: This circle, the lens's, or Every circle, which drops the
  lens's condition and reads every circle's rows the reader may read,
  so a view across circles is a person's own and no feature holds a
  read of its own for it
  ([the lens](../../../../_corpus/doc/architecture.md#the-lens)),
  disabled with no lens or where the lens leaves the collection whole;
  and last, on a view of the viewer's own, its name over its Delete. The
  panel's pin is an icon alone, quiet, in its top-right corner on the
  title's line (a filled pin once pinned, "Pin this view" or "Unpin this
  view"), which pins the open view under Pinned in the sidebar. A row the layout has no use for is shown disabled, never
  dropped, so the rows never move; a control that offers no choice
  reads as its value, not as a control: a disabled field is muted, and
  a disabled select drops its field and chevron. What a collection offers lives only
  inside the dropdowns and popovers: its fields are a dropdown's
  options. A column says what it holds by its kind, and a
  `person` or a `circle` column is a field of its own type, never text:
  it groups and filters by who or which circle, as an enumeration does
  by its value.
- `FilterBar`: the filter bar, always on its own line under the
  collection's header and above its rows, at one height whether empty,
  holding chips or searching, so nothing below it moves: chips on the
  left, Search and + Filter on the right, a quiet empty line while no chip
  holds. + Filter (key `F`) offers a
  field to add a condition on: a date, or any field with a handful of
  values, at most `limits.values`, an enumeration's across every row and
  any other's across the rows the view would keep without it, a
  person's and a circle's among them; choosing one opens its chip's
  popover at once, a date keeping the current month, any other the
  values it offers to pick among, a person's and a circle's by name.
  Search (key `/`) is the Filter menu's first item, ruled off from the
  fields below it, each marked by its kind's icon; it opens an input, filtering
  live as the typing pauses, in place on the bar's line (into the
  address, as the view's text filter always did; the editor follows the
  address, so back and forward, a view and Reset change what it holds)
  and, on a blur, folding back to a chip, `Search contains "…"`, which
  a click reopens to edit; Escape folds it back with its text kept, the
  focus on its chip or + Filter. A chip reads its field, an operator and
  its values: `is` for one value, `is any of` for several, `in` for a
  date's month or year, `contains` for the search; the query model has no
  other operators, so there is no operator step in adding one, and a
  date's popover chooses between this month and this year. Every chip's
  own × removes it at once, the focus going to + Filter; two conditions
  keeping the same values are alike whatever order they were picked in;
  a chip the open view's own saved form already held draws plain, one
  this page added or changed since carries a small dot. While the view
  differs from what it opened as, a small Save and Reset show at the
  bar's end: Save goes through the same save the View panel's own always
  did, a viewer's own view updated at once or a preset named as a new
  one in the drawer; Reset returns to the view's own saved form, in the
  address and in the search still being typed. Ad hoc filters live
  wholly in the address (`where`, `q`), so they are shareable and
  survive a reload; on a phone the chips scroll sideways, under the same
  bar, and nothing wraps the page wider. Every collection's fields end
  with the four the core
  read gives its rows from the log, which no slice declares (`logged`):
  Created and Updated, dates, and Created by and Updated by, people
  ([db](../db/index.md)), but where the collection has a field of the
  same key, as tasks' Created is their own (`logging`). They are fields
  as any: Order by orders by them either way, + Filter adds a condition on
  them, Group by groups by Created by and Updated by, and Display
  chooses them; a table shows them once a view does, as the shell's
  look of every collection hides them (`hide`), and a list, a gallery,
  a board and a calendar as a view's fields. So every collection holds
  a date and a person, and offers a calendar. Its rows
  are the server's, kept, filtered, ordered and paged in SQL, and only
  the lensed circle's where the member has a lens, but in a view across
  circles: a collection whose
  rows name no owning circle says under its header that the lens
  leaves it whole
  ([reading at scale](../../../../_corpus/doc/architecture.md#reading-at-scale),
  [the lens](../../../../_corpus/doc/architecture.md#the-lens)):
  a list, a table and a gallery draw a hundred rows at a time
  (`PAGE`), with a button under them that asks the address for the
  next hundred (`n`) and how many of the rows are drawn; the keyboard
  moving past the last drawn row asks for the next page, and the search
  goes into the address once the typing pauses, which draws the
  first page again. A grouped list, table or gallery reads its
  rows group by group, the groups in the order a board's columns take
  (`lanes`), any other value after them, months among them, the way the
  view's sort runs, a row with no value for the field in a last group,
  None, and the view's order within each; so a page of a hundred continues
  the group the last one ended in, under its header again, and each
  header's count is the group's whole, read with the page. A group's
  header is a bar across the row's width, as Linear's, coloured only
  where the field's values are a closed set the code declares, a
  handful (`closed` in `models/view.ts`: a state, a priority, a
  boolean): a state's bar is a subtle gradient in its tone, or, where
  the tone has no colour of its own, in an ink seeded by its value. An
  open set's, whose values the data holds (a circle, a person, a record,
  even drawn as a badge, any other), is a plain grey bar, the raised
  step, its value its `Chip`, a circle's icon in its ink inside it, a
  person's avatar; a date's month and None are the grey bar and their
  words (the operator, 19 Nov). Decided by the field's kind, never by
  counting its values; a chevron
  collapses its own rows alone, the other groups' kept as they are;
  and, where the collection offers New, a + ("Create in …", never
  named New, so the two are never confused by a voice or a test) opens
  the same dialog (`Group`, `models/query.ts`'s `groupTint`). A
  board and a calendar place every row the view keeps. `Gallery`
  lays the items out as cards (`Tile`, drawn as Linear's: a muted reference and a person's avatar on top, the title in two lines at most, the other fields as quiet unlabelled chips (a hairline outline with an icon or a tone's dot, a record its filled `Chip`, none drawn for an empty field) and a muted created or updated line at the foot); `Board` puts them in a column
  per value of an enumeration, a person or a circle, each with its
  count, the board offered only where a field is one of them; `Calendar` puts them on the days of a
  month, in whole weeks from Monday, or of a week, by a date field, in
  the order of their time where the date holds one
  (`YYYY-MM-DDTHH:MM`), or in the view's order where it sorts them,
  each tinted by the value of the field it is grouped by, the values
  handed the brand's five pentad inks (`--p0` to `--p4`) in the site's
  turn, as the inks are handed out to areas, and again from the first
  past five, and a legend above the days names each value with its colour and how many
  of the rows it shows hold it, so a value is never told by colour
  alone; grouped by nothing, each tinted by the first of its cards'
  fields that has a tone, a week showing the fields under each title; the
  calendar is offered only where a field is a date, as every
  collection's Created is. It places the rows by the view's date,
  chosen under Group by, else its look's (`on`), the collection's own
  meaningful date, as a meeting's start or an invoice's due day, else
  its first date, its own before the logged ones, so a collection with
  no date of its own places them by Created. Which month or week
  it shows is where the viewer is, not part of the view: `at` in the
  address, today when absent, which its arrows and Today link to and
  a change to the view keeps
  (`models/calendar.ts`). It draws that month or week, its header and
  arrows with it, even where no row falls in it; only a view that keeps
  no row at all says it is empty. A view, its extensions overriding it part by
  part, declares its `look`: its default layout, the field every layout
  groups by (`by`: a board's columns, a calendar's colours, a list's,
  a table's and a gallery's headers), the order it sorts by
  (`sort`) and the tiebreak after any sort (`then`, as the inbox's
  since, so an ask with no due date follows those with one, the
  longest waiting first), its groups' and columns' order (`lanes`), its
  cards' fields, its calendar's date (`on`) and span, and the columns a
  table hides until a view shows them (`hide`, every slice's together);
  a view changes each, and its address says so. A state a board's moves
  write is a board (tasks, expenses, motions); a state with no moves is
  a list grouped by it (invoices, bills, periods; timesheets as a
  table, the approval queue); a circle's records group by circle
  (projects, documents, mandates by their issuer), and history by its
  month (transactions, payslips); the log opens as a list, circles as a
  gallery, accounts and timesheets as tables, where figures line up,
  meetings as a calendar of months tinted by circle. In a list, a
  row's trailing date takes the width of the widest date, in tabular
  figures, an empty one its dim dash in the same box, so what comes
  before it lines up down the list. A board move is
  a write only where a slice declares it (`shifts`: the field, the
  columns it leaves and enters, the write): the `transfer` attachment
  lets a card drop only there, and the drop posts that write to the
  item's page as its button does, with the column entered as `to`, so
  one write takes a card into any of several, as a task's move does,
  signed as the acting member, its outcome shown as any write's and the
  rows read
  again, so a refused move leaves the card where it was. The view
  bar's tabs are pills (`Pill`, the open one filled and set in a heavier weight): All first, what a bare address shows,
  then any preset the collection or an extension declares as a plain
  object (`views`), then the viewer's own. A preset earns its tab only
  by showing what the default layout and its filters do not already
  give; none does today, so every collection has All and the viewer's
  views. Each tab's tooltip names it with
  its count, the server's for a preset and, for a viewer's own, asked
  of the collection as JSON once the page is in the browser
  (`ViewsState.tallies`), and its last button saves a new view. The active view (`v`)
  and what is changed from it (`view`, `where`, `q`, `hide`, `order`,
  `sort`, `by`, `cards`, `on`, `span`, `w`, `across`) live
  in the URL, so a view is a link and the server renders it, checking
  every part against the fields. A viewer's own views are a preference,
  never a record: `ViewsState` keeps them in the browser's storage as a
  versioned object (`Saved`), ready to move into a member's preferences,
  and renames, updates and deletes them; presets are not editable. The
  ui check keeps browser storage to a hook's state class. Writes stay in
  the header, with the
  count and any status badge the view and its extensions declare over
  the collection's `about` (the log verifies), since the page holds
  only a page of rows; a collection page renders nothing else, which the ui
  check enforces on the shell's `[collection]` page. Keyboard
  first: `j`/`k` move, Enter opens, `/` opens the filter bar's Search, `F`
  its + Filter, `c` opens New's dialog. The row `j`/`k` moves to takes the focus, one row in the
  tab order at a time (a roving `tabindex`, the row's link out of it),
  so a screen reader reads it and the ring shows where the keyboard is;
  Tab leaves the rows from it and comes back to it, moving past the last
  drawn row focuses the next page's first once it is drawn, and coming
  back from the item it opened focuses it again: the page, which mounts
  with its route, keeps the row by a navigation `snapshot` in a
  `RowState` (`useRow`), which the Collection, mounting once its query
  answers, follows and takes the row from. A table's column the rows
  are ordered by says so by `aria-sort` on its header, ascending or
  descending, and the others carry none: the field the view orders by
  (`sort`, in the address as `sort=<key>` or `sort=-<key>` for
  descending), or where it orders by none, the field the collection's
  read orders by first (`ordered`), where one select reads its rows and
  its order leads with a field by name. Clicking a table's header orders
  by its field, and again turns the direction. The view's order is
  every layout's: a list's, a table's and a gallery's rows, a
  board's cards in each column and a calendar's in each day, each read
  in that order by the one statement, so the next hundred continue it.
- `Detail`: the one record page, the same for every collection, as
  Linear's issue page. The content is the record's, one column centred
  in it: its title, large, then its words where it holds them as text, a
  circle's purpose or a report's caption (`summary`, in the text face as
  `Prose`), then its overview as its record page layout lays it out
  (`layout`, below), its body and its panels, and under a hairline its
  Activity, what happened to it in
  order, with its comments and the box that adds one where its kind
  takes comments (`comment`). Each slice gives its events newest first
  (`activity`), a comment's words as its `body`; the page merges every
  slice's and shows them oldest first, the box last. The drawer's
  Details panel holds its properties, in sections as Linear's drawer
  has them, nothing boxed and no form in it, each under the one heading,
  a small gap under it: Properties, its state first, then who and
  where, then its phrases; and Dates, its days, the record's Created
  and Updated last. A slice names another section by a property's
  `group`, drawn between them; otherwise its kind places it
  (`models/drawer.ts`). A computed figure, a sum or a count, is no
  property: it is a `Stat` of the overview's Figures panel (`figures`),
  which the ui check holds. Every row is a bare `Field`, one height, a
  step in from its heading, a record's chip within it: an icon and its
  value, no name shown, its name its tooltip and its accessible name.
  The icon says what the field is: the value's own lead where it has
  one, a state's pill, a priority's bars, a person's avatar, a circle's
  or a record's chip; else the field's glyph, its slice's (`glyph`, as
  an envelope before an email, a fingerprint before a digest, a scale
  before a procedure) or its kind's (`glyphs.ts`), a day's telling when
  it began, falls due, was carried through, ended or last changed by its
  lead word or its name. Where the value alone would not say what it
  is, a quiet lead word or two stands before it in the same row, muted
  (`lead` on its `Prop`, as "closes 31 Oct 2026", "due 19 Nov", "since 1
  Sept 2025", "quorum half the seats", "minutes bind as written",
  "answers to" a circle's chip): a day always has one, its name
  lowercased where its slice gives none, so two days never read alike,
  and the Created and Updated stamps lead with theirs. A slice prefers
  a kind the kit draws over words where it is clear (a state's pill, a
  record's chip, a person), and a day a panel's header already shows,
  as a motion's deadline in its Vote panel's, is not repeated in the
  drawer. Two rows naming the same record, as a motion's circle that
  also put it, are one, naming both fields, and keep a lead word only
  where both share it; a phrase that only repeats what a record's chip
  in another row names, as an invoice's billed name beside its client's
  chip, is not drawn, the chip kept. A property with no value is not
  listed; Add property, at the end of Properties, offers the empty ones
  that can be set. An editable row is `live`: it fills on hover, and a
  press anywhere on it, or Enter on it, opens its popover, never a
  pencil; a record's chip in it stays its link. A press on a
  property that can be changed (`edit` on its `Prop`) opens the popover
  that changes it, through the write the property names, as a form
  posts it: `Pick` for a choice among options, one or many, with a
  search, each option with its icon, its tone's dot or its avatar and a
  check on the chosen; the curated icon grid for a record's icon; a
  calendar for a day; an input for text or a number; or, from a slice
  that needs more (a project's lead and members), a block of its own
  (`Editor`) drawn in the popover. A slice sets a property of a kind of
  record from its `properties`, never a block in the Details. A
  record's people are one property of avatars (`people`). The moment a
  change is accepted, before the signed write it makes is known to have
  reached the server, this browser keeps it in `localStorage`, by who is
  signed in and, on a demo, the copy's own join code, the page and the
  field it changes, with the value it replaces; `Properties` posts it
  again as the drawer mounts, so a change accepted and the page left at
  once, by a reload before that write survives it, still reaches the
  server, but only where the field still reads the value the draft
  replaces, so it never overwrites one moved since by another write or
  another editor, which it drops instead, a quiet notice saying so. It
  is dropped too once the write it carries lands, or is refused outright
  (never retried with the same stale value), or once a day has passed
  unreplayed; and all of it, a body's draft and a property's alike, is
  dropped at once whenever who is signed in changes, on sign-out, on a
  demo's Reset now and otherwise, and on another tab of this browser
  reconciling to a different one, since an earlier session's name, or
  an earlier copy's, answers to neither browser nor record again. The
  check against the value a draft replaces is this browser's own
  alone, not the server's; a server-side conditional write for it
  waits until after the demo. Last, under
  Related, one quiet line of the record's Created and Updated and by
  whom as the log has them (`stamps`), the dates and actors of its
  first and latest entries, which the item's read gives beside its
  data, but those its slices' properties already name, as a task's
  Created. Related, a section of its own, has each line one row of the
  Properties' height, its collection's icon (read from its link where
  it names none), its title ending in an ellipsis, and at its end, quiet,
  how many rows a jump holds or what a record is to this one; a list
  longer than seven shows its first five and Show N more. Related lists first its
  jumps: each other collection whose rows name the record, by the
  collection's icon and name and how many of its rows the reader sees
  that name it, through their lens, counted in the core read's one
  statement as any other count is; the line opens that collection
  filtered to the record, the condition in the address (`?where=`) and
  the filter bar showing it as a chip. A row names a person by a person
  column's address, a circle by a circle column's id, and any other
  record by a column that says it is `of` that record's collection, as
  a task's hidden project id is a project's; never by who created or
  last updated it, nor in a collection of home or Settings, and a
  collection holding none of its rows is no jump, and a jump to a
  collection a tab of the record lists opens that tab. Then the records its
  slices link to (`related`), but those a property's chip already links,
  as an invoice's client or a motion's circle, which the drawer never
  names twice. The first tab is the overview, laid out
  by the page's record page layout (`layout`,
  [architecture](../../../../_corpus/doc/architecture.md#record-page-layout)):
  `body`, the record's body (`body`, the block editor or the text it is
  written in) and then its panels, as a motion's proposal and its Vote;
  or `panels`, unset, the slice's panels stacked and then the body in
  a Notes panel (`Notes`, which, while the body holds nothing, as the
  body's `canon` says, is no panel and no heading but only a quiet "Add
  a note", a subtle button at the column's inset, and is the editor in
  its panel once someone writes or presses it), as an invoice's Lines,
  Payments and Project, then its Notes; then the Activity. **A heading
  heads content** (the operator, 19 Nov): the Activity's shows only
  over an event or a thread, the comment box standing alone where there
  is neither; Related, a drawer's section and the Figures panel draw
  nothing when empty; a `Panel` given no body and no footer is not
  drawn; and a `Section` counting nothing whose title only repeats the
  open tab's name, as an empty Postings in the Postings tab, shows what
  it holds without its heading. The title, the body and the panels are
  one column, 48rem at
  most, centred in the content, the title's text, the body's and every
  panel's content starting at one edge, the column's inset, a body's
  grip hanging before it; a tab listing a collection takes the
  content's width. The slices' figures are one panel, Figures, after the
  body in `body` and first in `panels`. Every block on the overview but
  the body is a `Panel` ([panels](#panels)), which the ui check's
  `layouts` refuses otherwise. A panel
  summarises; a tab lists, or holds what is too big to summarise
  (`tabs`): a collection scoped to the record (`scoped`), as a
  project's Tasks and a contact's Projects and Invoices, drawn by
  `Collection` under the record's header (`tab`: no frame, views or
  View panel of its own, its filters and paging kept in the address with
  the tab, nothing saved, no New and no card moved), or more of the
  same feat's, as a motion's Stances and Effects, a meeting's Agenda, a
  circle's Roles, Policies and Settings, a document's Versions, an
  invoice's Postings, an account's Ledger, a period's Entries, a
  project's Milestones and Budget, a person's Membership, Work and
  Authority. The header's breadcrumb leads from the
  record's collection to its title, and Escape, as the collection's
  segment, goes back to the collection; its reference (`subtitle`, its
  id or address) is a quiet line under the title, never a sentence
  about it, which its properties and content say. Tabs show as
  pills in the header when there are two or more, the open one in the
  URL (`?tab=`). **A page shows at most four tabs, and the slice that
  owns the record's collection chooses them and their order**: only the
  owner's page declares `tabs`, and an extension's blocks, a core
  feat's, a feat's or a graft's alike, sit in a tab the owner names
  (`{ tab, block }`), a bare one in the first; a tab past the first
  that holds no block and lists no collection, as one whose filler is
  pruned, is not shown. An
  extender the owner gives no tab is a jump in Related, as a person's
  tasks and expenses are. A tab earns its place only as a genuinely
  different view of the record, as a project's tasks are. The tabs
  check (`tools/tabs.mjs`, run by `cella check feats`) refuses a page
  declaring a fifth tab, an extension declaring a tab, and a block in a
  tab its owner does not name, each by the slice, the record and what
  would fix it. Every collection's item page is drawn by `Detail`
  alone, and the ui check refuses an item page that frames itself. Esc
  goes back to the collection.
- `Card` (a borderless card raised on the panel, in the drawer, as the
  View panel and a calendar's Legend), `Section` (a titled block in a
  tab or a page), both headed by the one `Heading`, as a `Panel` is
  ([panels](#panels)),
  `Properties`, `Related`, `Activity`, `Table` (with `dense` and
  `totals`, [panels](#panels)), `Sheet` (a financial statement alone:
  headings, lines and ruled-off totals with a figure per named column,
  a line opening on its accounts, each linking to its ledger; a list of
  totals is a table's), `Cell`, `Stats` and `Stat`, `Empty` and `Meta`
  ([panels](#panels)), `Explained` (settings said in full: each its
  label and what bounds it, its value now and the one proposed as
  read-only `Field`s, a badge saying how it bears, over a sentence
  saying what it means, which wraps and is never cut off), `Badge` (a
  state's pill: its tone's soft fill, a dot and its word), `Chip` (a record named compactly, as
  below), `Person` (a person wherever one appears:
  their name, their address on hover; a column, property or event of the
  `person` kind is an address drawn so, from the names of the people the
  coop knows, which the shell reads once for its pages; a column of the
  `circle` kind is a circle's id drawn as its name, as the circles a
  mandate names are), `Grid` (figures to type into, a row per
  thing and a column per day, each cell showing what it holds and taking
  what is added, with the totals; the arrows move between open cells;
  `pick` gives each row a choice in a column after its label, the
  first of its options chosen, as the circle a row's time is worked
  for),
  `Button` (a tone, `primary`, `info`, `danger`, `positive` (an
  affirmative choice, as a vote's Consent, in the positive ink, filled as
  `danger` is), `quiet` or `subtle`, an icon before its words (`lead`),
  or its `icon` alone, small and square; a link with `href`; the submit
  of a form drawn elsewhere by its id (`form`); `busy`
  keeps its focus and reads as unavailable; a filled tone, `primary`,
  `info`, `danger` or `positive`, is one of the brand's cells, as the site's row of
  actions is, from the same geometry (`@cella/brand`'s `actions.ts`):
  flat along its top and foot, its ends pointed past its words, and the
  buttons beside it on its line, siblings a small gap apart, or the
  buttons of forms that are their button (`Form`'s `button`, passed
  through by `data-through`), drawn with
  it as one row, each pair sharing a slanted edge parted by one gutter,
  so a quiet Cancel beside it takes the shape too, while a run of quiet
  buttons or an icon stays a plain rounded fill; the cell is an svg
  under its words, first in its flow and a pixel wide, drawn once the
  row is laid out and again as it changes, mirrored right to left, so
  before it, and with no script or forced colours, it is the plain fill
  at the same padding; its focus ring follows the cell 2px outside it,
  and its whole box takes the pointer (`attachments/cell.ts`)),
  `Form` (a write, posting to the route's `write` form for a
  named write, files and all, through `post`, its fields bound to it;
  `button` makes it its one button, its children the hidden values it
  posts, drawn in the run of buttons beside it, as a vote's stances;
  `bare` with an `id` draws its fields alone, its submit a `Button`
  naming it by `form`, as a panel's footer holds it; `lead` puts an
  icon before its button's words; `ready` false keeps its button disabled while
  there is nothing to post; the fields a refused write names as `spent`,
  written before it stopped, are emptied; its button floats right, an
  inline form's at the end of its line (the operator, 19 Nov); in New's
  dialog it ends in Cancel, closes the dialog once settled and says a
  refusal's reason itself),
  `Hidden` (a value a form posts that no one types, named through the
  form it is in),
  `Field` (text, a number, a date, a time, an address, an email or a
  file, or a choice among `options`, drawn by `Select`, in one of its
  modes ([fields](#fields)); its label names
  it by its id and never wraps it; a date is typed in the app's locale
  and posts as an ISO day, its own calendar a button beside it
  (`DateField`): a month of days in the top layer, anchored to the
  field and flipped to stay in the viewport, opening on the field's day
  or today, today ringed and the day chosen filled with ink, a grid the
  arrows move a day or a week in, Home and End to the week's ends, Page
  Up and Down a month, with Shift a year, Enter or a press picking and
  Escape closing it, the focus back on its button; a day typed
  that names none keeps the form from posting and says how to write
  one, until a valid day is typed or one is picked from the calendar,
  which replaces what is typed and drops the complaint; a time is typed
  on the 24-hour clock, as Lanterne writes it, 9:30, 930 and 9h30 all
  reading as one, and posts as `HH:MM`, its own list a button beside it
  (`TimeField`): a time every quarter of an hour in the top layer,
  anchored and flipped as the calendar is, opening on the field's time,
  else the one before it, else 09:00, the focus on the list, naming the
  time the keyboard is on as its active descendant; the arrows move a
  quarter, Page Up and Down an hour, Home and End to the day's ends,
  figures typed reach the time they start (14 reaches 14:00, 9 09:00),
  Enter, Space or a press picks and Escape closes it, the focus back on
  its button; a time typed that names none keeps the form from posting
  and says how to write one; a file is chosen with a button, Choose
  file, that opens the browser's dialog (`FilePicker`), and the file
  chosen shows beside it by its name and size, read aloud as it is
  chosen, with a quiet button that clears it; the whole is a place a
  file may be dropped on, and the file input it keeps hidden inside is
  what the form posts; `accept` narrows the dialog to the media types it
  offers and refuses a dropped file it does not take, saying what it
  does, and a `required` one empty holds the form back, says Choose a
  file and sends the focus to its button; a
  select with a `placeholder` shows it, muted, until a choice is made,
  never a blank; a text area wears no grip of the browser's, growing
  with what is written from its rows to most of the window where the
  browser sizes a field by its content, and scrolling past its rows
  where it does not), `Ordered` (a list a slice's writes reorder, as an
  agenda: each row numbered, with its grip and its columns, what the
  slice puts at its end and a quiet removal when the slice offers one;
  `fixed` drops both once the list may not change), `Prose`, `Note` (a line that says something, a state or a reason; where nothing is shown, `Empty` says so), `Row` (items side by side, wrapping; `spaced` sets read-only fields apart), the comment parts
  ([comments](#comments)): `Conversation`, `Message`, `Reactions`,
  `AddReaction`, `Remark`, `Rich` and `RichField`,
  `Mention` (a member or a document named inside a
  text, a quiet chip linking to it), `Icon`
  (Phosphor, duotone), `Outcome` (the last write's outcome, floating
  until dismissed: each write with its verdict and reason; a write of
  several stopped part-way says that those it wrote first stand and only
  the rest is left to send; and a post with no answer reads as unknown,
  since it may have been written), `Command` (Cmd/Ctrl-K, its items
  read on its first open by the `source` the shell hands it, the shell's
  query of every collection's index).
- `Floating`: what floats at a point rather than from a trigger, a menu at
  the caret or a toolbar over a selection: in the top layer, opened
  manually, kept in the viewport by its own measured size, and drawn above
  the point it is given (`above`) where below it would pass the window's
  bottom; a press on its buttons never takes the focus, so the caret
  stays.
- `Blocks`: a document of blocks, the block editor's surface and its
  read-only reader's, and the look of every kind of block (headings, list
  items with their markers, to-dos, quotes, code, dividers, embeds' cards,
  a block chosen whole, where a dragged block lands), every kind set in
  the body font, Inter (`--font-ui`), headings and all, wherever the
  editor or its reader stands. Core body's components name its classes
  and draw nothing of their own.
- `Select`: the one select, a combobox and its listbox as WAI-ARIA's
  select-only combobox. The button keeps the focus throughout, naming
  the option the keyboard is on as its active descendant, and shows the
  chosen option's icon and label, or its placeholder, muted, while none
  is chosen; its list opens in the top layer, as wide as the button at
  least, anchored to it and flipped to stay in the viewport, placed by
  `models/place.ts` where a browser lacks anchor positioning. The arrows,
  Page Up and Down, Home and End move among the options past the
  disabled ones; typing a label's first letters reaches it, a letter
  again cycling those it starts; Enter or Space chooses and closes, as a
  press does, Escape closes it choosing nothing, and Tab closes it and
  moves on, the focus on the button all along, so it returns there by
  never leaving. The chosen option wears a check; an option may carry an
  icon, be disabled, sit under a heading with the others of its `group`,
  and one may be marked, quietly, as the `default`, which a reader hears
  as ", the default". With a `name` it posts its value in its form, a
  `required` one holding the form back while none is chosen; with no
  placeholder and no value of its own it reads as its first option, as
  the browser's did. Its options are plain data (`Option`,
  `models/select.ts`, whose moves its tests run without a browser), its
  state `SelectState`. A choice is handed to `onchange` and fired as a
  `change` from the button, so a setting commits as it is made; `fit`
  sizes it to what it shows, up to 11rem, as in the View panel.
- `Checkbox`: the one checkbox and the one switch, one button that says
  whether it is on (`aria-checked`), its box and the text naming it
  inside it, or named by its `label` where it has no text; Space or a
  press anywhere on it turns it once, fired as a `change`. A checkbox is a small box, filled with ink and checked once
  on; a switch (`role="switch"`), a track its knob crosses, filled once
  on. With a `name` it posts its value while on.
- `icons`: the Phosphor icons slices may name.

A view whose rows are not its own items links each where its `href`
says, as an inbox's ask links to where it is done.

A `Column` places itself in the list view by `role`: the title, the line
under it, the trailing meta, or the table alone. Its role is where it
goes and what a list shows before a view chooses; a view's Display
chooses which of a list's columns show, the title always among them,
kept as `cards` in the view and its address, so a column the table alone shows
by default can be put in a list's meta. A look's cards' fields are its
own, not a list's: it shows its own default until
the view chooses otherwise.

A value that names a record, a circle among them, is one `Chip`
wherever `Value` draws it: a list's line, a table's cell, a card's
field, a board's column, a group's header and the drawer's
Properties, where it is the record's link as well and goes without its
label. A chip is one compact line, its name ending in an ellipsis
where its place runs out, its collection's icon before it in the
record's own ink, filled one step from the surface it sits on toward
the text ([tokens](#tokens)'s layering), so it reads on the panel, a
card, a grey bar, a hovered row or a popover alike, in either theme. A
person keeps its avatar and name, and is a chip, its avatar inside it,
only in a group's header. A column names the collection its
value is a record of by `record`, as a task's assignee names `people`
and its project `projects`; a property, by an `href` that is a record's
own, `/<collection>/<id>`; a `person` is always one of `people`. The
icon is the one that collection's view declares, which `Cell` reads
from the sidebar's navigation the shell hands `useShell`, so no slice
imports another's to find it. A person wears one person (Phosphor
`User`), as core person's `people` declares, and a circle a group
(`Users`), as core circle's `circles` declares. It stands at the value's size, quieter
than its text, and is hidden from assistive technology, since the text
names the record. A collection that declares no icon, or that the shell
does not mount, leaves its chip with none; an enumeration, as a task's
priority, names no record and wears none.

### Comments

Every comment is drawn by the same parts, as Linear draws them: a
record's threads (core body's `Thread`), a motion's discussion and a
document's comments alike, under the record's Activity.

- `Conversation` is a thread: one quiet card, the board's tile's
  hairline, its messages apart by space, replies set in under their
  root, and at its foot the box that replies. A resolved thread folds to
  one quiet line (`Resolved on` its day), which opens it.
- `Message` is one comment: a small avatar, the author's name and a
  quiet relative time on one line, the text under them at body size, and
  under that its `foot`, as its reactions. Its `actions`, small icon
  buttons (`Button`'s `icon`: Reply, Resolve, a smiley), sit at its top
  right, shown on hover or focus, always where there is no hover.
- `Reactions` draws a message's reactions only once one is given: a
  small pill chip each, its emoji and count, the reader's own tinted
  with `--accent-soft`, a click toggling theirs. `AddReaction` is the
  smiley that opens the six in one tight row (`Popover`'s `icon`).
- `Rich` draws a comment's text from its Markdown subset
  (`models/rich.ts`): bold `**x**`, italic `*x*`, inline code, links
  `[x](url)` to the web, mail or a path in the app, bullet and numbered
  lists and quotes; a line break is a break and a blank line a
  paragraph, so a plain comment reads as it was written. It is parsed
  into nodes and drawn by them, never as HTML; a slice's `words` draws
  each run of plain text, splitting out its mentions and links.
- `RichField` writes it: a field with a faint edge, `rows` lines at
  rest (two for a new comment, one for a reply, "Leave a reply…"),
  growing as it is written, set as a document's text with no grip or
  slash menu, and no label of its own (`label` names it to assistive
  technology). A toolbar over a selection marks it bold, italic or
  code, links it or makes it a list, as Ctrl or Cmd with B, I, E and K
  do; `- `, `1. `, `> `, `**x**`, `*x*` and `` `x` `` typed become what
  they say; Enter breaks the line. Its submit is a small round arrow
  inside its bottom right, bright once there is text and dim before,
  or Ctrl or Cmd with Enter, in a `Form` drawn `bare`. Where the slice
  answers `suggest`, `@` or `[[` offers suggestions, picked by arrow and
  Enter or a press, each put in as a chip that posts its token. It is
  the browser's own editable text, read back as Markdown on each
  change (`hooks/RichState.svelte.ts`), so the browser keeps the caret,
  composition, undo and the clipboard; a paste is read as Markdown. Its
  `head` sits inside its top: `Remark`, the quote a comment answers,
  with a × that drops it, or read above a posted comment.

### Panels

A record's body is its blocks, and everything else stays out of their
way. What a slice shows on a record's overview that is not its body is
a panel (`Panel`), and every panel is one system (the operator, 19
Nov): one framed summary, as a figure or a chart sits among text, a
faint fill (the raised step) and a hairline, the column's width, flush
with its left edge. Its anatomy:

- the header, the one heading (`Heading`): its icon, its `title` and
  its `count` muted beside it, then at its end its state's pill
  (`status`, a `Badge`) and quiet facts (`meta`, a `Meta`: a date, "due
  19 Nov", "3 mandates");
- the body, what it summarises, composed of the inner elements below;
- the footer, where it has one: `help` on its left, muted, as why a vote
  is not offered or what a threshold means, and its key actions
  (`actions`) as one run of buttons at its right end, so a filled one
  and those beside it are drawn as one row of cells: each in its
  context's tone with an icon saying what it does, a vote's Consent
  `positive` with a check, Object `danger` with a raised hand, Abstain
  `quiet`, an "Open …" leading on with an arrow, a move such as "Move
  to project" whose choice stays a `Field` in the body (a bare `Form`
  there, its submit naming it by `form`).

Header, body and footer share one inset, the record's title's, so
every left edge lines up, and inside it `--inset` is nil, so what it
holds sits flush to it. No button stands in a panel's body, nor a form
drawing its own button: the ui check's `panels` refuses either, a
panel's `actions` and `help` snippets passed over
([enforcement](../../../../_corpus/doc/enforcement.md)). A record's own
writes, Send, Close, Archive, stay in the page's header, never in a
panel. A slice puts one panel where it has custom content, never a
stack of sections beside its text: the motion's Vote is one, after the
proposal. A record's overview draws its panels after the body in the
`body` layout and as its stack in the `panels` layout, the body then
the last panel, `Notes`, which while it holds nothing is only its quiet
"Add a note", no panel; the slices' computed figures, their `figures`,
are one panel, Figures, of `Stat`s, after the body or first. A figure
earns its place as a quantity a reader acts on or compares, money owed,
a budget against what is spent, hours, work left: never a mere count a
tab or the Activity already gives (a document's versions and comments),
nor what a panel's sentence or table already states (a terms' clauses,
a lines table's totals), nor a nil that says nothing (nothing owed,
nothing shared, no task open); a figure with no value is dropped, and
with none left there is no Figures panel. A panel given no body and no
footer is not drawn, never an empty frame under its title.

Its inner elements are the UI core's, used inside panels and out:

- `Table` drawn `dense`: rows closer, their text flush with the panel's
  content edge and a row's hover reaching into its padding; with
  `totals`, lines ruled off under its rows (net, VAT, total), each
  figure under the last column and a `total` heavier under its own
  rule, or alone with no headers, as a payslip's pay and an expense's
  claim. A `Sheet` is a financial statement alone, never a list of
  totals, which the ui check refuses as a sheet of one unnamed column.
- `Stats` of `Stat`s: computed figures, each a tile one step from the
  surface toward the text, so it stands out on the panel, its label in
  quiet sentence case over its value in the display face, a tone on the
  value alone, a figure naming a record linking to it; tiles of one
  width, as many as fit a line.
- `Field` in its modes ([fields](#fields)): read-only label→value rows
  (`readonly`), set apart in a `Row spaced`; a choice that commits
  (`live`), or that a footer's action posts.
- `Empty`: one muted line where there is nothing to show, "Nothing
  received for it yet", which `Table` draws for no rows; never a `Note`
  drawn `quiet`, which the ui check refuses.
- `Meta`: quiet trailing facts in a header, a footer or a line's end.
- `Tally`: a whole split in parts as one thin bar in proportion over
  its legend, each part's dot in its tone, its label and its figure
  (`kind` writes them, a sum as money); `of` is the whole where the
  parts fall short of it, its rest a bare track, as eight stances of a
  roll of ten.
- `Prose`, `Note`, `Row`, `Cell` and `Diff`, as anywhere.

### Fields

`Field` is the one field, in modes rather than other components:

- as a form's, its default: its label over its input, posting with the
  form it is in;
- `readonly`: its label and its value as text, no input drawn and
  nothing posted, the value drawn by `Value` as its `kind`, else as its
  `type` says where the two agree (a number, a day), a link where it has
  an `href`; every read-only label→value row is one, a panel's and
  `Explained`'s;
- `live`: it commits as it changes, as a setting's does, a pick as it
  is made and a typed value on leaving it or on Enter, Escape taking a
  typed edit back (`committing`); `Setting` draws its field so.

`bare` draws it compactly, as Linear's properties: its icon and its
value alone, its label only its tooltip and its accessible name. The
icon is the value's own lead where it has one, else the field's
(`icon`); a quiet word or two before the value (`lead`, "closes",
"quorum"), muted, says what it is where the value alone would not. A bare `live` field fills on hover and opens its `editor` in a
popover on a press anywhere on it, never a pencil, a record's chip in it
staying its link; every row of the drawer's Properties is one.


## Never native

**Never native components.** Every control is the UI core's own,
on-brand and accessible by keyboard and assistive technology alike in
every browser, never the browser's: a choice is a `Select`, a day a
date `Field` with its own calendar, a time of day a time `Field` with
its own list of times, a file to upload a file `Field`, the UI core's
picker, a box to tick or a toggle a `Checkbox`, a choice among a few a
group of buttons (`role="radio"`, as the icons a saved view may wear).
The ui check refuses, by name, a `<select>` and an `<input>` of type
date, datetime-local, month, week, time, checkbox, radio or file in any
`.svelte` file of the org app, its UI core's among them; a file input
carrying `hidden` passes, as the picker's own, which it keeps unseen
for the form to post
([enforcement](../../../../_corpus/doc/enforcement.md)).

## Settings


A settings page is a plain form, `Settings`, one `Setting` a row: its
label, beside it who changes it where the reader's own write does not,
and its current value in its field. Who changes it is one quiet icon,
`Who` (`who` in `models/settings.ts`): the motions' scales where a
circle changes it by motion, named in its tooltip ("Assembly changes
this by motion") with why, in the guard's words; the same in the accent
where the reader's change waits among the changes to propose; a host's
drives where a host sets it; a lock where nothing the reader may write
changes it. A field the reader saves wears none. The icon is a button
the keyboard reaches, its name the few words and its tooltip, shown as
the pointer rests on it or it takes the focus and hidden by Escape, its
description, so assistive technology reads both; no line under the
field repeats it. Every field is editable, whoever reads it, and the
form has no Save: each setting commits as its field does. A pick, from
a select, a checkbox, a radio or a calendar, commits as it is made; a
typed value commits when focus leaves the field or on Enter (Ctrl or
Cmd with Enter in a text area), and Escape takes a typed edit back
(the `committing` attachment). A value committed as it was in force
does nothing. A slice declares each setting with the write that
changes it directly, if any, and the motion kind that changes it
otherwise, its arguments filled from the field (`models/settings.ts`).
A setting's field is one `Field` draws, or an arrangement, `Arrange`,
where it declares its `choices`: a fieldset of the tree of choices on
show, in their order, each at the top level or in an accordion, and
under it those not shown. Where a choice sits is all there is to say of
it, with no toggle and no field naming its accordion: it is dragged,
by the pointer or the keyboard (`placing`), into an accordion or out of
one, along the tree, or down among those not shown, and an accordion
is dragged as a whole, or among those not shown with all its choices.
An accordion's heading renames it, and New accordion makes an empty
one to drag choices into, which the listing holds once one is in it.
Its value is one listing (`models/arrange.ts`): the choices on, in
order, separated by commas, an accordion's run after its name and a
colon, the runs separated by semicolons, as a circle's features are
written ([features](../circle/index.md#features)). One declared
`grouped`, as the coop's layout is, puts every choice on show in an
accordion, called a group: a choice lands in a group only, never at the
top level, a group named blank keeps its name, New group makes one, and
those not shown are not enabled. How to drag is the help icon's tooltip
beside the label, `Who` with an i, as any setting's `help` is.

A setting of `type` `toggle` is a switch, `Checkbox` as `role="switch"`,
its value `yes` or `no`, each turn a commit; at `depth` 1 it is drawn
under the setting before it on a guide line, and `disabled` it waits, as
a feature's switch waits on its group's. One declaring `post` posts the
fields it gives for its value in place of its own, and alone, one write
in flight of its own, so a circle's switches each save one row
([features](../circle/index.md#features)).

A record's page draws a field it saves in the same way: its block draws
`Settings` with that one setting, its write posted with the record's id
as an item's are, and the page has no Save button either; a record's
own words are its body, as a contact's notes are, never such a field
([contact](../../feats/contact/index.md#shell)).

A settings page is served at `/settings/<name>`, listed in Settings'
sidebar under its group, or, a page of one thing, at
`/settings/<name>/<id>`, which its slice reads for that id and its
writes are posted with, as an item's are; it is not listed, since the
sidebar names no thing, and the thing's own page links to it, as a
circle's links to its features page. While it is open, Settings'
sidebar stands in place of the features as on any settings page.

A setting (`Declared`, as the package exports its type) names its
field, its value in force, the page action that saves it, if one does,
and, where the reader's write would be refused, why, as its slice reads
the guard's reason before anything is written; and the motion that
changes it otherwise: its kind, its arguments from the value typed and
the one it replaces, those the reader may change before proposing
labelled as the New form labels them and the rest carried as they are,
and the words its title says the change in. The form is handed the
circle that decides its motions and the deadline asked for, as its
slice reads them. The dev server alone serves a specimen of a form
mixing the two kinds, `/specimens/settings`, a page of no slice that
reads nothing and has no actions, for the browser test to see the
dialog on.

A setting the reader may change saves by its write as it commits,
through the page's writes as any form's: the write posts the fields
it saves that differ from their values in force (`posted`), so one
left as it is never posts and a contact detail never set stays unset.
Each write has one post in flight at a time: a commit made while it
posts waits for it to settle, then sends the values as they stand.
Under the field, in a quiet line, a mark says how the commit went,
announced as it changes (`aria-live`): Saving… while it posts, a brief
Saved once it settles, or Not saved and the refusal's reason, the
field keeping what was typed; the shell shows the outcome as for any
`Form`, the write's that names one, as the theme's cookie names none.
A setting the reader may not change, since its write needs a mandate
they lack, or since only a motion changes it, never posts a write. On
the settings pages its commit puts the change among **the changes to
propose**, a basket for each circle that decides, since one motion goes
to one circle (`BasketState`, `useBasket`, `models/basket.ts`): the
field keeps the value typed, its icon turns to the accent (Proposed to
Assembly), and a quiet line under it shows the value in force struck
through. A change back to the value in force takes it out. The basket
gathers across the settings pages, a change named by its page, the
thing the page is of and its setting, and is kept for the session in a
cookie, `cella-basket`, which the browser alone reads as the page
mounts and a sign-in or a sign-out clears; nothing of it is written
before it is proposed. While any change waits, the settings pages'
sidebar holds them (`Basket`), standing in the drawer and opening on
them as one is gathered: for each circle, "3 changes to propose to
Assembly", each change in a line, from what to what, with its own
removal, and Review and propose and Discard. Review opens one `Dialog`
(`ProposeBasket`) showing every change as its diff (`Diff`): the tree
of an arrangement with its marks, a plain value from the one in force,
struck through, to the new. Under them the motions' New form,
prefilled: its title, the one change's or each one's joined, the
circle, the deadline it asks for, and the proposal. Propose posts it to
the `basket` write of the page the first change was made on, with each
change's page, thing, setting and value, which the server turns into
the actions, never those a client names; a refusal keeps the dialog
open, saying why, and once proposed the basket empties. A page mixing
the two kinds saves what the reader may change at once and gathers the
rest.

A settings form with no basket above it, as a record's page draws for
one field, offers the motion at once: its commit opens
`ProposeInstead`, a `Dialog`, one a commit, which says plainly that the change needs a motion of
the circle that decides it, shows the change from the value in force
to the one typed, and says why in the guard's own words, the refusal
its write's guard gives as early as it can, with the values it read
(`proposal`). Its form is the motions' New form, prefilled: the circle
that decides it (`motion.decider`), its title saying the change
("Rename Coordination to Operations"), the action it carries with its
arguments, from the value typed and the one it replaces, and the
deadline the procedure its requirements fix asks for. The reader may
edit any of it before proposing; its primary action, Propose to the
deciding circle, posts it to the page slice's own `propose` action,
the outcome naming the log entry that proposes the motion, and the
field, marked Proposed, shows the value in force again, the change now
the motion's to make. A refused proposal keeps the dialog open, saying
why. Cancel, Escape or a click outside it takes the change back, the
field showing the value in force. A setting no motion is declared to
change, or with no circle to decide it, is marked Not saved.

Something new that only a motion makes, as a circle's role, is no
setting: it is composed whole and proposed as one motion. `Compose` is
a quiet button, as Add a role…, opening a `Dialog` of its fields, each
an argument of the motion's one action (`Composed`,
`models/compose.ts`), none of them a key the write can take itself,
as a role's id is taken from its name; above them, why a motion makes it, in
its guard's words. Its primary action, Propose to the deciding circle,
posts the motions' New form to the page's `propose`: the circle that
decides it, the title its slice words from what was typed, the
deadline the circle asks, and the action's arguments, typed and fixed.
The guard judges it: a refusal keeps the dialog open with what was
typed, saying why; a proposal closes it empty.

The Settings section opens on Account, the acting person's own
settings at `/settings/account`, which the account menu at the
sidebar's foot links to as well: a `Settings` form of their name, email
and phone, each saved by `profile`, every person's right on their own,
and their theme, light, dark or the system's, saved in its cookie and
worn as it is chosen, each saved as it is left; and
under it their devices, the one their session signs with marked as this
device and each other current one with its revoke, as on their page.
Its fields are all the reader's own, so none opens a motion.

Organization, the coop's own, comes first under Organization at
`/settings/organization`, which the coop menu's Settings opens: a
`Settings` form of the coop's particulars in force, its name, legal
name, legal form, capital, seat, SIREN, trade register and VAT number,
none saved by anyone's write, since only a motion of the assembly
adopts them ([the coop's
particulars](../circle/index.md#the-coops-particulars)). A value's
edit, as it commits, joins the changes to propose to the assembly, and
the motion proposing them carries one Adopt a policy replacing the
particulars with every value changed, its procedure the one their
protection fixes; and under the form,
read-only, the scope's address and its timezone, each with the host icon beside
its label, its tooltip saying a host sets it and why ([the notary](../notary/index.md#settings)). Membership-motion
serves it, as the graft that proposes the assembly's motions
([membership-motion](../../grafts/membership-motion/index.md#shell-of-the-roll)).

## Posting a write

`post(start, prove)` is how every write leaves a page, a form's, a
dropped card's, an agenda's move and a document's edit: `start` is its
first post, the route's `write` form submitted or its `send` command,
and while the server answers with what to sign it signs it with the
device this browser keeps for that scope, actor and device, and sends
the proof back by `prove`, naming the run it answers ([trust](../../../../_corpus/doc/trust.md#keys-and-addresses)).
It ends with the write's outcome, Settled, Refused or Pending. The
page's writes are `useWrites` (`WriteState`): the root layout makes it
and shows its last outcome, until the next page; each route names how
its page writes (`serve`, a `Route`: its `write` form, an instance a
form, `send`, `prove`, the queries it reads and how it reads again);
`post` there asks for the page's queries with each proof, so its
outcome comes back with them refreshed in the same flight, and `send`
posts a write by the page's script, as a drop does. A `Form` spreads its
instance on its element and submits through it; each field in it is
named through its `FormState` (`useForm`), bound to the instance's
form, so `Field`, `Grid` and `Hidden` post as SvelteKit's remote forms
ask, and a field outside a form keeps its name. A post that gets no
answer it can read, the
connection dropped or a proxy answering in the server's place, throws,
which the editor's sync reads as being offline; a `Form` shows it as an
`unknown` outcome (`lost`), since the write may have been made, keeps
what was typed and asks for a reload before it is sent again. The devices are kept in IndexedDB by
`hooks/kept.svelte.ts` (`keep`, `kept`, `held`), each private key a
CryptoKey the browser made, or derived for a fixture member, never
exported.

The sign-in page (`SignIn`) shows what a real member sees, in a card of
its own on the pre-sign-in `Gate`, which is wide there to lay out the card
and the test list. The card reads "Continue as" each person this browser
keeps a key for, one full-width row each, the name alone, with a quiet
remove at its right end that forgets the key in this browser (after a
confirmation unless it is a fixture member's); with none it says this
browser is not signed in and points to the invitation link or to Link
device. Below the rows, "Link device" and, right-aligned, a quiet Help
popover explaining the ways in: an invitation's link for a first device, or
this browser approved from a device the person already uses; it opens
leftward from its button (`Popover`'s `align="end"`). Link device is a
step of its own: it takes over the whole card, with a Back at its top
left that returns to the card as it was (Escape too, `SignInState.leave`).
It asks for the person's address and a name for this browser, then
makes a key here (`SignInState.make`) and shows its QR code and link,
which open the person's Account settings on a device they are signed in
on, with the key and its name filled in, and a pairing code (`pairCode`)
to type there, since a link alone must not enrol a key; "I approved it,
sign in" then signs in with the key. The dev server's fixture members,
and a demo's members, are a list with no panel at the right edge of the
screen ("Test accounts" or "Demo members"), below the card on a narrow
one, each row with all its circles as compact chips on one line, the name
giving way first; a person the card already shows is not offered again,
and in a demo's room a member another browser leased reads `taken`,
disabled.

## State

A component holds no state of its own: the collection's filter and row,
whether its New is open, the command menu, the dismissed outcome, the
drawer's opening, the lens and the people's names, what a date field
holds typed and says of it and the day its calendar is on, what a time
field holds typed and whether its list is open and the time its
keyboard is on, the file a picker holds and why it refused one, and
whether a select is open and the option its keyboard is on, are state
classes in `hooks/` (`CollectionState`, `CreateState`, `CommandState`,
`ShellState`, `DateState`, `TimeState`, `FileState`, `SelectState`),
and the sign-in and
an invitation taken up (`SignInState`, `JoinState`), each reached through
its `use*` hook, as [architecture](../../../../_corpus/doc/architecture.md#client-state)
describes. `ShellState` imports no router: the shell hands its `follow` the
router's `afterNavigate`, so the class stays plain TypeScript where a
slice's block reaches it through `useShell`, as a circle's View as
this circle reads the lens. `useSection` hands a `Section`'s title down, so an empty
`Table` in it says "No roles" in one quiet line, with no headers.

## Dragging

Every list that reorders, reorders by dragging; the ui check refuses up
and down arrow or caret buttons that move things. The primitives:

- `models/drag.ts`: a drag as plain data (the list, the item lifted, the
  index it would take, pointer or keyboard) and its moves: `start`,
  `over`, `step`, `drop` (the move, none when it lands where it began),
  `cancel`, `slot` (where the indicator goes) and `reorder` over a list
  of any type; a list that nests lands its items on places instead
  (`placing`).
- `DragState` and `useDrag()`: the page's one drag as state, so any
  component shows where an item will land (`before(list, i)`) and dims
  the lifted one, with the announcement for assistive technology.
- `sortable(drag, { list, axis, label, onmove })`, an attachment on the
  list: its items carry `data-drag-item` and `data-drag-index`, each
  item's handle `data-drag-handle`. The pointer (mouse, touch, pen) lifts
  past a few pixels, drags a floating preview, drawn inside an empty
  copy of the list so the list's own styles reach it (inside a popover,
  in its top layer, so it shows above it), scrolls the list's scroller
  near its edges and drops on release; Escape cancels. On a
  focused handle the keyboard lifts with Space (or Enter on a button),
  moves with the arrows, drops with Space or Enter, cancels with Escape,
  each step announced in a live region. `onmove(from, to)` hears the
  drop.
- `DragHandle` (a labelled grip) and `DropIndicator`, the one line where
  an item will land, from the tokens.
- `placing(drag, { list, lift, describe, onplace })`, an attachment for a
  list whose items land on places it names, not only between its items,
  as an arrangement's choices land in an accordion or out of one, at the
  top level or among those not shown, and its accordions as a whole. Its
  items carry `data-drag-item` and `data-drag-key`, each handle
  `data-drag-handle`; while one is lifted the list draws its places, a
  line each (`data-drop-place`), indented as deep as the item would
  sit, or an area (`data-drop-zone`) that takes it anywhere inside. The
  pointer aims at the zone under it or the nearest line, the one as deep
  as the preview's left edge where two lie together, as the end of an
  accordion and the top level after it do; the keyboard lifts with Space
  or Enter, steps through the places with the arrows and drops with
  Space or Enter, each place announced in the list's own words
  (`describe`), Escape cancelling either. `DragState` holds the lifted
  item's key beside its drag (`placing`, `aiming`, `holding`).

Dashboard widgets, a table's columns in the View panel's Display popover, the viewer's own
view tabs, a document's blocks and a meeting's agenda reorder this way, and an
arrangement (`Arrange`) places its choices so;
`Popover`, `DragHandle`, `Ordered`, `sortable` and `useDrag` are
exported for slices to compose.

## Dashboards

Every collection has a dashboard, the third layout, configured and never
coded. `models/query.ts`, exported alone as `@cella/org-ui/models` for the
server, types a collection's fields from its columns' kinds (money and
number, date, a badge as an enumeration, a person, a circle, else text) and defines a widget
as a plain object: a figure (`kpi`), the count of rows or the sum,
average, minimum or maximum of a numeric field, or a chart of either,
grouped by an enumeration (bars) or by a date's month (a line), each
over optional conditions (a field among some of its values, a date in
the month or year of the scope's day). A view or a graft may declare its widgets
(`dashboard`); without any, defaults derive from the fields. The
viewer's own are JSON in the address (`w`), so the server renders them;
the server checks them against the fields, drops and reports what
names an undeclared field or asks what a field cannot give, and runs the
rest as SQL aggregates over the collection's rows (`measures` in
`@cella/org-db`); `result` shapes what they measured into what
`Dashboard` draws, a line through every month from the first. `Dashboard` draws the results: figures as text, bars with their
values beside them, a line with its months and values in a table for
assistive technology and each month's tooltip. `Widgets`, in the View
panel's Display popover, reorders and removes them inline; Add widget
opens the shared Dialog with the widget's form (field, measure,
filter) ending in Add and Cancel, and an edit opens it the same way,
ending in Save and Cancel; confirming saves the view's widgets and
closes the dialog, and Cancel, Escape or a click outside it changes
nothing.

## Accessibility

The `a11y` e2e scenario (`apps/org/ts/_e2e/a11y.test.ts`) scans, with
axe-core through Playwright, the sign-in page and, signed in as
Camille on Lanterne, the Inbox `/` lands on, every collection the sidebar mounts in
its default view, the first item each lists and its form open on
New, in light and in dark, on Chromium, Firefox and WebKit. A
violation of impact serious or critical fails it. What it found when
it was added is fixed in the component that draws it, never in one
page; a violation whose fix would change the design system's look (a
token's colour, the navigation, the layout at narrow widths) waits for
the operator's design session, listed in the scenario by its axe rule
and the page it is on, so the list only shrinks and a new violation of
that rule elsewhere still fails. It lists none.

What it holds the components to: a popover's trigger is named by its
visible text, the coop's mark and the account's initials hidden from
assistive technology; a list of errors is a list inside its live
region, never a list made one; and a region that scrolls with nothing
in it the keyboard reaches, the page frame's content or a table's
strip, is a tab stop named for its page or its section while it
scrolls, so the arrows scroll it (`scroller` in `models/keys.ts`).

## Types

`App`, `Owned`, `Added`, `View`, `Page`, `Column`, `Prop`, `Link`, `Event`,
`Block` and `Embed` describe a slice's client side; an `Embed` is what a
slice draws inside another's item (a motion inside a document), which a
graft declares on the page it extends and the detail view hands every
block as `embeds`; `Viewer` who looks, the signed-in person and the
device their session signs with, which the detail view hands every block
as `viewer`, for what only the viewer may do on the page; `Done` a write's outcome as
the page receives it. A slice's server side is `Slice` in `@cella/org-db`.
