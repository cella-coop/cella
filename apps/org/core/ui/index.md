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
- `Frame`: the one page frame, a header with eyebrow, title, subtitle and
  actions, the content, and the drawer. The header's last button, or `]`
  anywhere, shows and hides the drawer on every page at once; a cookie
  keeps the viewer's choice, so the server renders it.
- `Collection`: the one collection component, the same header and rows
  for every collection, and a drawer holding one card, View: the filter,
  the layout (list · table · dashboard) and, in a table, its columns, in
  a dashboard, its widgets, the layout, the hidden columns and the
  widgets in the URL. Writes stay in the header, with the
  count and any status badge the view and its extensions declare (the
  log verifies); a collection page renders nothing else, which the ui
  check enforces on the shell's `[collection]` page. Keyboard
  first: `j`/`k` move, Enter opens, `/` filters (opening the drawer), `c`
  opens New.
- `Detail`: the one detail view, the item's blocks in the content and the
  drawer's cards: Properties (label and value rows), Related and Activity.
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
