+++
title = "UI"
updated = 2026-11-14
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
  co-op's own writing whole, a document's headings and `Prose` included,
  Geist Mono for code (`--font-mono`), self-hosted
  from Fontsource through the brand's `fonts.css`; headings take the
  brand's weight and tracking, the body its weight and leading. The
  shell keeps its own denser scale, `--text-2xs` to `--text-2xl` around
  15px, beside the brand's `--t-*`. A section's title is
  Urbanist in sentence case with its count muted beside it, a card's and
  a table's columns' labels quiet sentence case; the one eyebrow, small
  capitals tracked `0.1em`, is a stat tile's label. A section, and the
  page's content outside one, sets one inline padding (`--inset`) that
  its notes, forms, properties and figures share with its title and its
  tables' first column, so a block never sits left of its heading; a
  card's own padding is its inset;
- states: a badge's tone is its state's class, alike in both themes:
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
  border, a select drawing it as an outline (`--focus-outline`), since
  WebKit's native menu list drops a shadow; and nothing sets `outline:
  none` without drawing the ring.

The theme is light, dark or the system's, a cookie the server writes into
`<html data-theme>` before any script runs.

The dev server alone serves a specimen of the shell in the brand's inks,
`/specimens/ink`, a page of no slice that reads nothing, drawn by
`Inks`, proposing where the site's five pentad inks (`--p0` to `--p4`)
go in a working tool. Ink
marks identity and the one primary action, and never fills a surface:
the primary button as a cell solid in its ink, as the site's actions
are, and a secondary action as a wash of it; the selected navigation row
and the focus ring; a collection's icon tinted by its area's ink, and a
record chip's icon by its collection's; a circle's or a person's avatar
in an ink seeded by its name, as the site seeds its lists. Beside each,
the same thing as the shell draws it today, and what stays neutral:
tables, body text, forms and panels. The semantic tones keep their
meanings, so no ink is a state's. The page shows both themes side by
side, and each text on ink states its contrast, every one at least WCAG
AA's 4.5:1 (3:1 for an icon or a ring). The inks are handed out in the
site's turn started at the blue, so the first area's primary action never
reads as a refusal, and one table, `models/ink.ts`, both draws each
role and measures it, so the contrast the page states is the one it
draws.

## Components

- `Shell`: the grid, sidebar · content. The sidebar's top and foot stay
  put and only its middle scrolls. Its top is the co-op selector, the
  co-op's mark and name, followed by the lensed circle's name where the
  member has one, "Lanterne / Web", so a lens is never hidden. Its menu
  lists the scopes the shell serves (one today) with their legal names,
  then the circles the member reads: "All circles" first, which clears
  the lens and is checked where there is none, then the circles the
  member sits in, then the rest. A circle chosen there is the member's
  **lens**, which every collection reads through
  ([architecture](../../../../_corpus/doc/architecture.md#the-lens)): a cookie
  of the scope's, written by `/lens` as `/theme` writes the theme, so
  the server renders the lensed page and nothing of it enters the log;
  a lens naming a circle the member no longer reads is none. Then,
  always shown, the Inbox, whole whatever the lens, since it is what
  waits on the member, where `/` and the sign-in land, and Activity,
  the log read as a feed of who did what. The middle holds the sections as
  accordions, as Linear's teams: Governance, Office, Work, Payments,
  Ledger and Equity, flat, never nested, each its name
  and a caret, a dot on a shut one whose collections hold rows waiting
  on the acting member, whole whatever the lens as the Inbox is. Open,
  a section's collections hang from a guide
  line; a section's collections that name a `subgroup` are labelled by
  it where it has more than one. A collection the view declares
  `counted` shows how many rows it holds for the acting member, in the
  lensed circle where there is a lens, the count its page heads with,
  in a small quiet pill. Several sections may be open at once: one the
  viewer never touched is open while it holds the page, and one they
  opened or shut stays so. The foot is the command menu,
  then the account menu, the signed-in member, whose menu holds their
  address, Settings, Sign out and the theme. Settings is its own
  sidebar, one for the member and the co-op as Linear's, in place of
  the top and the sections while one of its pages is open: Back to app,
  which returns to the last page left, then the `platform` collections
  in two groups, each under its heading, as each collection's
  `subgroup` names: Personal, the member's own (Devices), then
  Organization, the co-op's (Imports). The account menu's Settings opens
  it at Personal's first page, the co-op menu's at Organization's. In
  dev mode a faint upright "prototype" with a test tube sits at the
  content's bottom right. The last write's outcome floats above.
- `Gate`: what a person reaches before signing in, alone on the page,
  the co-op's mark and name above one panel; `SignIn` in it, a button for
  each device this browser keeps for the scope, which signs the server's
  challenge, the fixture members on the dev server, and a key made here
  for its person to enrol from a device they hold; and `Join`, an
  invitation's link opened, whose one button makes the invitee's first
  device in this browser and takes the invitation up with it, then
  loads the invitee's own page afresh, reading nothing again first. Until the
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
- `Frame` (`PageFrame.svelte`): the one page frame, its header one
  compact row as Linear's, spanning the content and the drawer: on an
  item, a quiet caret back to its collection, on a collection its icon as
  the sidebar shows it; the page's name (on an item, a muted crumb of
  its kind and reference, its title the content's heading), its
  caption as the name's tooltip, with its count and status badges; the
  page's tabs right after, a collection's views, scrolling in their own
  strip; then the page's writes and one quiet icon group, the drawer's
  panel tabs beside its toggle, which stays there when the drawer is
  shut. A write in the header keeps the row one line: its fields'
  labels are read by assistive technology and not seen, and a choice is
  at most 16rem wide. A form a header's popover opens is no part of
  the row: its fields show their labels and its choices take its width.
  Under it, the content and the drawer, which
  scrolls down and never across. The toggle, or `]` anywhere, shows and
  hides the drawer on every page at once; a cookie keeps the viewer's
  choice, so the server renders it. One tab per panel, the open one
  marked even when alone: a collection's View, an item's Details.
  While a navigation runs (SvelteKit's `navigating`), its content stays,
  dimmed and `aria-busy`, until the next page's queries answer.
- `Skeleton` and `Failed`: what a page's boundary draws while its
  queries load the first time, its frame named by what the shell knows
  without them and quiet lines where its content goes, static and
  holding no component with state; and when a query throws, not found
  or broken, with the error's status and message, inside the shell.
- `Collection`: the one collection component, the same header, view bar
  and rows for every collection, and a drawer holding one panel, View
  (`Viewing`), of one shape for every collection, as Linear's display
  menu. At its top the layout, a segmented control of icons (list · feed ·
  table · gallery · board · calendar · dashboard, those the
  collection's fields allow), then the text filter, then the same rows
  in the same order everywhere, each a label and a dropdown: Group by
  (a board's columns, an enumeration; a calendar's date, and month or
  week), Order by (any of the collection's fields, and a toggle beside
  it for ascending or descending; none chosen, the collection's own
  order) and Filter (a field to add a condition on: a date, or any field
  with a handful of values, at most `limits.values` across the rows the
  view would keep without it, an enumeration's, a person's and a
  circle's among them; the conditions
  under it as chips); then Display, a
  row that opens a popover of what is shown (in a table, its columns, in
  a gallery or on a board, its cards' fields, in a calendar, its cards'
  fields, in a dashboard, its widgets); and last, saving what is shown
  as a view. A row the layout has no use for is shown disabled, never
  dropped, so the rows never move; a control that offers no choice
  reads as its value, not as a control: a disabled field is muted, and
  a disabled select drops its field and chevron. What a collection offers lives only
  inside the dropdowns and popovers: its fields are a dropdown's
  options, and a condition's values (a field's, each a person or a
  circle by name, or a date's month or year) are picked in a popover
  opened from its chip. A column says what it holds by its kind, and a
  `person` or a `circle` column is a field of its own type, never text:
  it groups and filters by who or which circle, as an enumeration does
  by its value. Its rows
  are the server's, kept, filtered, ordered and paged in SQL, and only
  the lensed circle's where the member has a lens: a collection whose
  rows name no owning circle says under its header that the lens
  leaves it whole
  ([reading at scale](../../../../_corpus/doc/architecture.md#reading-at-scale),
  [the lens](../../../../_corpus/doc/architecture.md#the-lens)):
  a list, a feed, a table and a gallery draw a hundred rows at a time
  (`PAGE`), with a button under them that asks the address for the
  next hundred (`n`) and how many of the rows are drawn; the keyboard
  moving past the last drawn row asks for the next page, and the text
  filter goes into the address once the typing pauses, which draws the
  first page again. A board and a calendar place every row the view
  keeps. The feed draws each row as one line of who did what and when,
  as a record's Activity reads: its first person column as their chip,
  then its title, linked, then its first date, and the time links to
  the row's own page where the view links its title elsewhere; it is
  offered only where a column is a person and one a date. `Gallery`
  lays the items out as cards (`Tile`); `Board` puts them in a column
  per value of an enumeration, each with its count, the board offered
  only where a field enumerates; `Calendar` puts them on the days of a
  month, in whole weeks from Monday, or of a week, by a date field, in
  the order of their time where the date holds one
  (`YYYY-MM-DDTHH:MM`), or in the view's order where it sorts them,
  each tinted by the first of its cards' fields
  that has a tone, a week showing the fields under each title; the
  calendar is offered only where a field is a date. Which month or week
  it shows is where the viewer is, not part of the view: `at` in the
  address, today when absent, which its arrows and Today link to and
  a change to the view keeps
  (`models/calendar.ts`). A view, its extensions overriding it part by
  part, declares its `look`: its default layout, its board's grouping
  and columns' order (`lanes`), its cards' fields, its calendar's date
  (`on`) and span; the log opens as a feed, circles and projects as a gallery, motions and
  tasks as a board, timesheets as a table, meetings as a calendar of
  months. A board move is
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
  `sort`, `by`, `cards`, `on`, `span`, `w`) live
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
  first: `j`/`k` move, Enter opens, `/` filters (opening the drawer), `c`
  opens New. The row `j`/`k` moves to takes the focus, one row in the
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
  every layout's: a list's, a feed's, a table's and a gallery's rows, a
  board's cards in each column and a calendar's in each day, each read
  in that order by the one statement, so the next hundred continue it.
- `Detail`: the one record page, the same for every collection, as
  Linear's issue page. The content is the record's: its title, large,
  then its free-form content, a document's blocks where its kind holds
  them, a record's own words where it holds them as text, a circle's
  purpose or a report's caption (`summary`, in the text face as
  `Prose`), and under a hairline its Activity, what happened to it in
  order, with its comments and the box that adds one where its kind
  takes comments (`comment`). Each slice gives its events newest first
  (`activity`), a comment's words as its `body`; the page merges every
  slice's and shows them oldest first, the box last. The drawer's
  Details panel holds its properties, label and value rows on the
  drawer itself, with no card or panel around them, and under them
  Related; nothing in the drawer is boxed. A record whose structured
  data is central to it puts that data in a tab of its own after the
  first (`tabs`): a motion's Stances and Effects, a meeting's Agenda, a
  circle's Roles, Seats and Policies, a document's Versions, a report's
  Figures, an invoice's Lines, a period's Entries, a project's
  Milestones and Budget, a contact's Invoices, a person's Employment; the first tab is the
  content and its Activity, and a kind with no free-form content shows
  its overview's blocks there. The header's crumb names the record by
  its kind and reference (`subtitle`, its id), never a sentence about
  it, which its properties and content say. Tabs show as
  pills in the header when there are two or more, the open one in the
  URL (`?tab=`); a block sits in the tab it names (`{ tab, block }`), a
  bare one in the first, and an extension's blocks join the owner's
  tabs or add their own. A tab earns its place only as a genuinely
  different view. Every collection's item page is drawn by `Detail`
  alone, and the ui check refuses an item page that frames itself. Esc
  goes back to the collection.
- `Card` (a borderless card raised on the panel, in the drawer or the
  content), `Section` (a block in the content),
  `Properties`, `Related`, `Activity`, `Table`, `Sheet` (a financial
  statement: headings, lines and ruled-off totals with a figure per
  column, a line opening on its accounts, each linking to its ledger),
  `Cell`, `Stats`, `Explained` (settings said in full: each its label
  and what bounds it, its value now and the one proposed, a badge saying
  how it bears, over a sentence saying what it means, which wraps and is
  never cut off), `Badge`, `Person` (a person wherever one appears:
  their name, their address on hover; a column, property or event of the
  `person` kind is an address drawn so, from the names of the people the
  co-op knows, which the shell reads once for its pages; a column of the
  `circle` kind is a circle's id drawn as its name, as the circles a
  mandate names are), `Grid` (figures to type into, a row per
  thing and a column per day, each cell showing what it holds and taking
  what is added, with the totals; the arrows move between open cells;
  `pick` gives each row a choice in a column after its label, the
  first of its options chosen, as the circle a row's time is worked
  for),
  `Button`, `Form` (a write, posting to the route's `write` form for a
  named write, files and all, through `post`, its fields bound to it; `ready` false keeps its button disabled while
  there is nothing to post; the fields a refused write names as `spent`,
  written before it stopped, are emptied),
  `Hidden` (a value a form posts that no one types, named through the
  form it is in),
  `Field` (text, a number, a date, a time, an address, an email or a
  file; a date is typed in the app's locale and posts as an ISO day, the
  browser's own calendar a button beside it (`DateField`); a day typed
  that names none keeps the form from posting and says how to write
  one, until a valid day is typed or one is picked from the calendar,
  which replaces what is typed and drops the complaint; which `accept` narrows to the media types it offers; a
  select with a `placeholder` offers it as a disabled first choice,
  never a blank), `Ordered` (a list a slice's writes reorder, as an
  agenda: each row numbered, with its grip and its columns, what the
  slice puts at its end and a quiet removal when the slice offers one;
  `fixed` drops both once the list may not change), `Prose`, `Note` (a quiet line), `Message` (one message of a thread:
  who and when over what it says, set in by its depth as a reply, its
  writes at its foot), `Mention` (a member or a document named inside a
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
- `icons`: the Phosphor icons slices may name.

A view whose rows are not its own items links each where its `href`
says, as an inbox's ask links to where it is done.

A `Column` places itself in the list view by `role`: the title, the line
under it, the trailing meta, or the table alone.

## Settings

A settings page is a plain form, `Settings`, one `Setting` a row: its
label, its current value in its field, and under it in a quiet line
what changes it, a write the reader makes or a motion of the circle
that decides it. Every field is editable, whoever reads it; Save posts
only the fields changed. A slice declares each setting with the write
that changes it directly, if any, and the motion kind that changes it
otherwise, its arguments filled from the field (`models/settings.ts`).

A setting (`Declared`, as the package exports its type) names its
field, its value in force, the page action that saves it, if one does,
and, where the reader's write would be refused, why, as its slice reads
the guard's reason before anything is written; and the motion that
changes it otherwise: its kind, its arguments from the value typed and
the one it replaces, those the reader may change before proposing
labelled as the New form labels them and the rest carried as they are,
and the words its title says the change in. The form is handed the
circle that decides its motions and the deadline asked for, as its
slice reads them. `plan` splits the fields changed into each write,
posted once with all its fields, one after the other until one does not
settle, and one motion: the kind of the first field changed that its
reader may not write, which every other field of that kind joins, its
arguments merged and its titles joined. A field of another kind waits
for the next Save, marked not saved, as does one no motion is declared
to change. The dev server alone serves a specimen of a form mixing the
two kinds, `/specimens/settings`, a page of no slice that reads nothing
and has no actions, for the browser test to see the dialog on.

A field the reader may change saves by its write, and the form shows
the outcome as any `Form` does: the last write's that names one, as
the theme's cookie names none. A field they may not change, since its
write needs a mandate they lack, or since only a motion changes it,
does not save: Save opens `ProposeInstead`, a dialog in the top layer
as `Popover` is, which says why in the guard's own words, the refusal
its write's guard gives as early as it can, with the values it read,
and offers to propose the change instead. Its form is the motions'
New form, prefilled: the circle that decides it (`motion.decider`),
its title saying the change ("Rename Coordination to Operations"),
the action it carries with its arguments, from the value typed and the
one it replaces, and the deadline the procedure its requirements fix
asks for. The reader may edit any of it before proposing; Propose posts
it to the page slice's own `propose` action, and the outcome names the
log entry that proposes the
motion. Closing the dialog keeps what was typed, and the field marks
the change as not saved. A form whose fields mix the two saves the one
kind and offers the motion for the other, in one go.

The Settings section opens on Account, the acting person's own
settings at `/settings/account`, which the account menu at the
sidebar's foot links to as well: a `Settings` form of their name, email
and phone, each saved by `profile`, every person's right on their own,
and their theme, light, dark or the system's, saved in its cookie and worn at once; and
under it their devices, the one their session signs with marked as this
device and each other current one with its revoke, as on their page.
Its fields are all the reader's own, so none opens a motion.

Organization, the co-op's own, comes first under Organization at
`/settings/organization`, which the co-op menu's Settings opens: a
`Settings` form of the co-op's particulars in force, its name, legal
name, legal form, capital, seat, SIREN, trade register and VAT number,
none saved by anyone's write, since only a motion of the assembly
adopts them ([the co-op's
particulars](../circle/index.md#the-co-ops-particulars)). Save opens
the dialog proposing a motion of the assembly, each value changed its
own field, which carries Adopt a policy replacing the particulars with
them, its procedure the one their protection fixes; and under the form,
read-only, the scope's address and its timezone, each saying a host
sets it ([the notary](../notary/index.md#settings)). Membership-motion
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

## State

A component holds no state of its own: the collection's filter and row,
the command menu, the dismissed outcome, the drawer's opening, the
lens and the people's names, and what a date field holds typed and says of it, are state classes in
`hooks/` (`CollectionState`, `CommandState`, `ShellState`, `DateState`), and the sign-in and
an invitation taken up (`SignInState`, `JoinState`), each reached through
its `use*` hook, as [architecture](../../../../_corpus/doc/architecture.md#client-state)
describes. `useSection` hands a `Section`'s title down, so an empty
`Table` in it says "No roles" in one quiet line, with no headers.

## Dragging

Every list that reorders, reorders by dragging; the ui check refuses up
and down arrow buttons that move things. The primitives:

- `models/drag.ts`: a drag as plain data (the list, the item lifted, the
  index it would take, pointer or keyboard) and its moves: `start`,
  `over`, `step`, `drop` (the move, none when it lands where it began),
  `cancel`, `slot` (where the indicator goes) and `reorder` over a list
  of any type. Nesting would add a target list to `to`; nothing nests
  yet.
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

Dashboard widgets, a table's columns in the View panel's Display popover, the viewer's own
view tabs, a document's blocks and a meeting's agenda reorder this way;
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
panel's Display popover, adds, edits, reorders and removes them.

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
visible text, the co-op's mark and the account's initials hidden from
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
