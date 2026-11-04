+++
title = "UI"
updated = 2026-11-04
+++

The shell's design system (`@cella/org-ui`): the tokens, the one shell,
page frame, collection component, detail view and drawer, and the
primitives a slice's blocks compose. It is the only package that holds
CSS; `cella check feats` refuses a `<style>` or a `style` attribute in any
other `.svelte` file, so no page or block styles itself.

## Tokens

`styles/tokens.css`. Colours are parametric OKLCH: a tone is a chroma and
a hue (`--tone-base`, warm paper; `--tone-accent`, ochre; positive,
negative, warning), a shade is a lightness mirrored around a midpoint by
one sign, `--theme`, so dark mode is that variable and a compressed ladder
of surfaces. Components read roles, never shades:

- surfaces: `--ground` under the sidebar, `--panel` under the content
  and its drawer alike, `--raised` for cards and stats on the panel,
  `--float` for floating things, `--sunk` for fields and a segmented
  control's well, `--selected` for its chosen segment, lighter than the
  well in both themes, `--hover`;
- text: `--text`, `--text-muted`, `--text-subtle`;
- accent: `--accent-fill` (fixed lightness in both themes),
  `--accent-border`, `--accent-text`, `--accent-soft`, `--on-accent`;
- type: Alegreya for display and headings, Alegreya Sans for everything
  read or measured, self-hosted from Fontsource. A section's title is
  Alegreya in sentence case with its count muted beside it, a card's and
  a table's columns' labels quiet sentence case; the one eyebrow, small
  capitals tracked `0.1em`, is a stat tile's label. A section, and the
  page's content outside one, sets one inline padding (`--inset`) that
  its notes, forms, properties and figures share with its title and its
  tables' first column, so a block never sits left of its heading; a
  card's own padding is its inset;
- states: a badge's tone is its state's class, alike in both themes:
  neutral at rest (a draft, closed, voided), accent under way (open,
  unpaid, submitted, approved and not yet paid), drawn as a ring with no
  fill so it never reads as an alarm, positive settled, warning wanting
  attention (overdue, suspended), negative refused or failed; the soft
  fills are tints (`--soft`), lighter in dark, so a tone shows in its
  text and never saturates;
- locale: the app's, `locale` in `models/format.ts` (en-GB), writes
  every day (16 Oct 2026) and is how a date field reads and types one
  (16/10/2026), whatever the browser's language; amounts read as euros
  the French way;
- shape: 12px radius on floating things and panels, 6px on controls; soft
  shadows on floating things only (`--shadow-float`);
- focus: one ring, `--focus`, on whatever the keyboard reaches, a field
  as much as a button; a focused field keeps the ring with its accent
  border, a select drawing it as an outline (`--focus-outline`), since
  WebKit's native menu list drops a shadow; and nothing sets `outline:
  none` without drawing the ring.

The theme is light, dark or the system's, a cookie the server writes into
`<html data-theme>` before any script runs.

## Components

- `Shell`: the grid, sidebar · content. The sidebar's top is the co-op
  selector, the co-op's mark and name, its menu listing the scopes the
  shell serves (one today) with their legal names; its foot is the
  account menu, the signed-in member, whose menu holds their address,
  Sign out and the theme; between them the command menu and the
  navigation: its head unnamed, the co-op's Home and the Inbox, then by
  group, a collection the view declares `counted` showing how many rows
  it holds for the acting member. The last write's outcome floats above.
- `Gate`: what a person reaches before signing in, alone on the page,
  the co-op's mark and name above one panel; `SignIn` in it, a button for
  each device this browser keeps for the scope, which signs the server's
  challenge, the fixture members on the dev server, and a key made here
  for its person to enrol from a device they hold; and `Join`, an
  invitation's link opened, whose one button makes the invitee's first
  device in this browser and takes the invitation up with it.
- `Popover`: the one popover and menu, opened from its trigger in the
  top layer (native `popover`), so nothing clips it: Escape and a click
  outside close it and focus returns to the trigger; anchored by CSS
  anchor positioning and flipped to stay in the viewport, placed by
  `models/place.ts` where a browser lacks it; as a menu it focuses its
  checked or first item and moves with the arrows, Home and End. The ui
  check refuses a layer floated by hand (`position: absolute` with a
  `z-index`) anywhere else.
- `Frame` (`PageFrame.svelte`): the one page frame, its header one
  compact row as Linear's, spanning the content and the drawer: on an
  item, a quiet caret back to its collection; the page's name, its
  caption as the name's tooltip, with its count and status badges; the
  page's tabs right after, a collection's views, scrolling in their own
  strip; then the page's writes and one quiet icon group, the drawer's
  panel tabs beside its toggle, which stays there when the drawer is
  shut. A write in the header keeps the row one line: its fields'
  labels are read by assistive technology and not seen, and a choice is
  at most 16rem wide.
  Under it, the content (an item's subtitle first) and the drawer, which
  scrolls down and never across. The toggle, or `]` anywhere, shows and
  hides the drawer on every page at once; a cookie keeps the viewer's
  choice, so the server renders it. One tab per panel, the open one
  marked even when alone: a collection's View, an item's Details.
- `Collection`: the one collection component, the same header, view bar
  and rows for every collection, and a drawer holding one card, View
  (`Viewing`): the text filter, the conditions on the rows (an
  enumeration's values as chips, a date's month or year), the layout
  (list · table · gallery · board · calendar · dashboard, icon-only so
  it fits) and, in a table, its columns, in a gallery or on a board, its
  cards' fields and the board's grouping, in a calendar, the date it
  places the items by, month or week, and its cards' fields, in a
  dashboard, its widgets; and saving what is shown as a view. Its rows
  are the server's, kept, filtered, ordered and paged in SQL
  ([reading at scale](../../../../_corpus/doc/architecture.md#reading-at-scale)):
  a list, a table and a gallery draw a hundred rows at a time
  (`PAGE`), with a button under them that asks the address for the
  next hundred (`n`) and how many of the rows are drawn; the keyboard
  moving past the last drawn row asks for the next page, and the text
  filter goes into the address once the typing pauses, which draws the
  first page again. A board and a calendar place every row the view
  keeps. `Gallery`
  lays the items out as cards (`Tile`); `Board` puts them in a column
  per value of an enumeration, each with its count, the board offered
  only where a field enumerates; `Calendar` puts them on the days of a
  month, in whole weeks from Monday, or of a week, by a date field, in
  the order of their time where the date holds one
  (`YYYY-MM-DDTHH:MM`), each tinted by the first of its cards' fields
  that has a tone, a week showing the fields under each title; the
  calendar is offered only where a field is a date. Which month or week
  it shows is where the viewer is, not part of the view: `at` in the
  address, today when absent, which its arrows and Today link to
  (`models/calendar.ts`). A view, its extensions overriding it part by
  part, declares its `look`: its default layout, its board's grouping
  and columns' order (`lanes`), its cards' fields, its calendar's date
  (`on`) and span; circles and projects open as a gallery, motions and
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
  `by`, `cards`, `on`, `span`, `w`) live
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
  opens New.
- `Detail`: the one detail view, the item's blocks in the content and the
  drawer's Details panel, its cards stacked as Linear stacks an issue's
  properties: Properties (label and value rows), Related and Activity.
  A page may declare tabs (`tabs`, the first its default), shown as
  pills in the header when there are two or more, the open one in the
  URL (`?tab=`); a block sits in the tab it names (`{ tab, block }`), a
  bare one in the first, and an extension's blocks join the owner's
  tabs or add their own. A tab earns its place only as a genuinely
  different view: motions have Overview and Stances; documents and
  invoices have one. Esc goes back to the collection.
- `Card` (a borderless card raised on the panel, in the drawer or the
  content), `Section` (a block in the content),
  `Properties`, `Related`, `Activity`, `Table`, `Sheet` (a financial
  statement: headings, lines and ruled-off totals with a figure per
  column, a line opening on its accounts, each linking to its ledger),
  `Cell`, `Stats`, `Badge`, `Person` (a person wherever one appears:
  their name, their address on hover; a column, property or event of the
  `person` kind is an address drawn so, from the names of the people the
  co-op knows, which the shell reads once for its pages), `Grid` (figures to type into, a row per
  thing and a column per day, each cell showing what it holds and taking
  what is added, with the totals; the arrows move between open cells),
  `Button`, `Form` (a write, posting to a named form action, files and
  all, through `post`; `ready` false keeps its button disabled while
  there is nothing to post; the fields a refused write names as `spent`,
  written before it stopped, are emptied),
  `Field` (text, a number, a date, a time, an address, an email or a
  file; a date is typed in the app's locale and posts as an ISO day, the
  browser's own calendar a button beside it (`DateField`); which `accept` narrows to the media types it offers; a
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
  since it may have been written), `Command`.
- `Floating`: what floats at a point rather than from a trigger, a menu at
  the caret or a toolbar over a selection: in the top layer, opened
  manually, kept in the viewport; a press on its buttons never takes the
  focus, so the caret stays.
- `Blocks`: a document of blocks, the block editor's surface and its
  read-only reader's, and the look of every kind of block (headings, list
  items with their markers, to-dos, quotes, code, dividers, embeds' cards,
  a block chosen whole, where a dragged block lands). The document feat's
  components name its classes and draw nothing of their own.
- `icons`: the Phosphor icons slices may name.

A view whose rows are not its own items links each where its `href`
says, as an inbox's ask links to where it is done.

A `Column` places itself in the list view by `role`: the title, the line
under it, the trailing meta, or the table alone.

## Posting a write

`post(url, body)` is how every write leaves a page, a form's, a dropped
card's, an agenda's move and a document's edit: it posts to the page's
action, and while the server answers with what to sign it signs it with
the device this browser keeps for that scope, actor and device, and posts
the proof back naming the run it answers ([trust](../../../../_corpus/doc/trust.md#keys-and-addresses)).
It ends with the write's outcome, as SvelteKit's action result, which
the caller applies. A post that gets no answer it can read, the
connection dropped or a proxy answering in the server's place, throws,
which the editor's sync reads as being offline; a `Form` shows it as an
`unknown` outcome (`lost`), since the write may have been made, keeps
what was typed and asks for a reload before it is sent again. The devices are kept in IndexedDB by
`hooks/kept.svelte.ts` (`keep`, `kept`, `held`), each private key a
CryptoKey the browser made, or derived for a fixture member, never
exported.

## State

A component holds no state of its own: the collection's filter and row,
the command menu, the dismissed outcome, the drawer's opening and the
people's names, and what a date field holds typed, are state classes in
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
  past a few pixels, drags a floating preview, scrolls the list's
  scroller near its edges and drops on release; Escape cancels. On a
  focused handle the keyboard lifts with Space (or Enter on a button),
  moves with the arrows, drops with Space or Enter, cancels with Escape,
  each step announced in a live region. `onmove(from, to)` hears the
  drop.
- `DragHandle` (a labelled grip) and `DropIndicator`, the one line where
  an item will land, from the tokens.

Dashboard widgets, a table's columns in the View card, the viewer's own
view tabs, a document's blocks and a meeting's agenda reorder this way;
`Popover`, `DragHandle`, `Ordered`, `sortable` and `useDrag` are
exported for slices to compose.

## Dashboards

Every collection has a dashboard, the third layout, configured and never
coded. `models/query.ts`, exported alone as `@cella/org-ui/models` for the
server, types a collection's fields from its columns' kinds (money and
number, date, a badge as an enumeration, else text) and defines a widget
as a plain object: a figure (`kpi`), the count of rows or the sum,
average, minimum or maximum of a numeric field, or a chart of either,
grouped by an enumeration (bars) or by a date's month (a line), each
over optional conditions (an enumeration among some values, a date in
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
card, adds, edits, reorders and removes them.

The co-op's home, `Home`, is one dashboard over many collections. Its
widgets are pins (`Pin`): a standard widget and the collection it runs
over, checked by `pins` against that collection's fields and run by the
server in SQL over its rows as the acting member sees them; each card names
its collection and links to it (`from`). The root declares the co-op's
pins until a viewer makes their own, JSON in the address (`w`) as a
collection's are. The View card lists them in order, dragged into place
or removed, and edits one collection's with `Widgets` (`c` in the
address), `repin` putting them back where the first of them stood.

## Types

`App`, `Owned`, `Added`, `View`, `Page`, `Column`, `Prop`, `Link`, `Event`,
`Block` and `Embed` describe a slice's client side; an `Embed` is what a
slice draws inside another's item (a motion inside a document), which a
graft declares on the page it extends and the detail view hands every
block as `embeds`; `Viewer` who looks, the signed-in person and the
device their session signs with, which the detail view hands every block
as `viewer`, for what only the viewer may do on the page; `Done` a write's outcome as
the page receives it. A slice's server side is `Slice` in `@cella/org-db`.
