+++
title = "UI"
updated = 2026-10-24
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
  read or measured, self-hosted from Fontsource; eyebrow labels in small
  capitals tracked `0.1em`;
- shape: 12px radius on floating things and panels, 6px on controls; soft
  shadows on floating things only (`--shadow-float`).

The theme is light, dark or the system's, a cookie the server writes into
`<html data-theme>` before any script runs.

## Components

- `Shell`: the grid, sidebar · content. The sidebar's top is the co-op
  selector, the co-op's mark and name, its menu listing the scopes the
  shell serves (one today) with their legal names; its foot is the
  account menu, the acting member, whose menu holds Act as (dev only,
  with its warning) and the theme; between them the command menu and the
  navigation, by group. The last write's outcome floats above.
- `Popover`: the one popover and menu, opened from its trigger in the
  top layer (native `popover`), so nothing clips it: Escape and a click
  outside close it and focus returns to the trigger; anchored by CSS
  anchor positioning and flipped to stay in the viewport, placed by
  `models/place.ts` where a browser lacks it; as a menu it focuses its
  checked or first item and moves with the arrows, Home and End. The ui
  check refuses a layer floated by hand (`position: absolute` with a
  `z-index`) anywhere else.
- `Frame` (`PageFrame.svelte`): the one page frame, its header one
  compact row as Linear's, spanning the content and the drawer: the
  eyebrow (the group, or on an item the collection, as the way back)
  over the page's name with its count and status badges; the page's
  tabs right after, a collection's views, scrolling in their own strip;
  then the page's writes and one quiet icon group, the drawer's panel
  tabs beside its toggle, which stays there when the drawer is shut.
  Under it, the content (an item's subtitle first) and the drawer, which
  scrolls down and never across. The toggle, or `]` anywhere, shows and
  hides the drawer on every page at once; a cookie keeps the viewer's
  choice, so the server renders it. One tab per panel, the open one
  marked even when alone: a collection's View, an item's Details.
- `Collection`: the one collection component, the same header, view bar
  and rows for every collection, and a drawer holding one card, View
  (`Viewing`): the text filter, the conditions on the rows (an
  enumeration's values as chips, a date's month or year), the layout
  (list · table · gallery · board · dashboard, icon-only so it fits) and,
  in a table, its columns, in a gallery or on a board, its cards'
  fields and the board's grouping, in a dashboard, its widgets; and
  saving what is shown as a view. `Gallery` lays the items out as cards
  (`Tile`); `Board` puts them in a column per value of an enumeration,
  each with its count, the board offered only where a field enumerates.
  A view, its extensions overriding it part by part, declares its
  `look`: its default layout, its board's grouping and columns' order
  (`lanes`), its cards' fields; circles and projects open as a gallery,
  decisions and tasks as a board, timesheets as a table. A board move is
  a write only where a slice declares it (`shifts`: the field, the
  columns it leaves and enters, the write): the `transfer` attachment
  lets a card drop only there, and the drop posts that write to the
  item's page as its button does, with the column entered as `to`, so
  one write takes a card into any of several, as a task's move does,
  signed as the acting member, its outcome shown as any write's and the
  rows read
  again, so a refused move leaves the card where it was. The view
  bar's tabs are pills (`Pill`): All first, what a bare address shows,
  then any preset the collection or an extension declares as a plain
  object (`views`), then the viewer's own. A preset earns its tab only
  by showing what the default layout and its filters do not already
  give; none does today, so every collection has All and the viewer's
  views. Each tab's tooltip names it with
  its count, and its last button saves a new view. The active view (`v`)
  and what is changed from it (`view`, `where`, `q`, `hide`, `w`) live
  in the URL, so a view is a link and the server renders it, checking
  every part against the fields. A viewer's own views are a preference,
  never a record: `ViewsState` keeps them in the browser's storage as a
  versioned object (`Saved`), ready to move into a member's preferences,
  and renames, updates and deletes them; presets are not editable. The
  ui check keeps browser storage to a hook's state class. Writes stay in
  the header, with the
  count and any status badge the view and its extensions declare (the
  log verifies); a collection page renders nothing else, which the ui
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
  different view: decisions have Overview and Stances; documents and
  invoices have one. Esc goes back to the collection.
- `Card` (a borderless card raised on the panel, in the drawer or the
  content), `Section` (a block in the content),
  `Properties`, `Related`, `Activity`, `Table`, `Cell`, `Stats`, `Badge`,
  `Button`, `Form` (a write, posting to a named form action; `ready`
  false keeps its button disabled while there is nothing to post),
  `Field` (a select with a `placeholder` offers it as a disabled first
  choice, never a blank), `Prose`, `Note` (a quiet line), `Icon`
  (Phosphor, duotone), `Outcome`, `Command`.
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

A `Column` places itself in the list view by `role`: the title, the line
under it, the trailing meta, or the table alone.

## State

A component holds no state of its own: the collection's filter and row,
the command menu, and the dismissed outcome and the drawer's opening are state classes in `hooks/`
(`CollectionState`, `CommandState`, `ShellState`), each reached through
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
view tabs and a document's blocks reorder this way; `Popover`,
`DragHandle`, `sortable` and `useDrag` are exported for slices to
compose.

## Dashboards

Every collection has a dashboard, the third layout, configured and never
coded. `models/query.ts`, exported alone as `@cella/org-ui/models` for the
server, types a collection's fields from its columns' kinds (money and
number, date, a badge as an enumeration, else text) and defines a widget
as a plain object: a figure (`kpi`), the count of rows or the sum,
average, minimum or maximum of a numeric field, or a chart of either,
grouped by an enumeration (bars) or by a date's month (a line), each
over optional conditions (an enumeration among some values, a date in
the current month or year). A view or a graft may declare its widgets
(`dashboard`); without any, defaults derive from the fields. The
viewer's own are JSON in the address (`w`), so the server renders them;
the server checks them against the fields, drops and reports what
names an undeclared field or asks what a field cannot give, and runs the
rest over the collection's rows as its read API returns them, building
no SQL. `Dashboard` draws the results: figures as text, bars with their
values beside them, a line with its months and values in a table for
assistive technology and each month's tooltip. `Widgets`, in the View
card, adds, edits, reorders and removes them.

## Types

`App`, `Owned`, `Added`, `View`, `Page`, `Column`, `Prop`, `Link`, `Event`,
`Block` and `Embed` describe a slice's client side; an `Embed` is what a
slice draws inside another's item (a decision inside a document), which a
graft declares on the page it extends and the detail view hands every
block as `embeds`; `Done` a write's outcome as
the page receives it. A slice's server side is `Slice` in `@cella/org-db`.
