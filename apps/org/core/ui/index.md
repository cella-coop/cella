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

- `Shell`: the grid, sidebar · content; the scope and the user menu (act
  as, dev only; theme), the command menu and the navigation, by group; the
  last write's outcome floats above.
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
  (list · table · dashboard) and, in a table, its columns, in a
  dashboard, its widgets; and saving what is shown as a view. The view
  bar's tabs are the collection's presets, declared as plain objects on
  its view (`views`: invoices' Unpaid and Overdue, decisions' Open and
  Closed, members' Active and Invited, transactions' This period), All
  after them, then the viewer's own; each tab's tooltip names it with
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
  Esc goes back to the collection.
- `Card` (a borderless card raised on the panel, in the drawer or the
  content), `Section` (a block in the content),
  `Properties`, `Related`, `Activity`, `Table`, `Cell`, `Stats`, `Badge`,
  `Button`, `Form` (a write, posting to a named form action), `Field`,
  `Prose`, `Icon` (Phosphor, duotone), `Outcome`, `Command`.
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

Dashboard widgets, a table's columns in the View card and the viewer's
own view tabs reorder this way.

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

`App`, `Owned`, `Added`, `View`, `Page`, `Column`, `Prop`, `Link`, `Event`
and `Block` describe a slice's client side; `Done` a write's outcome as
the page receives it. A slice's server side is `Slice` in `@cella/org-db`.
