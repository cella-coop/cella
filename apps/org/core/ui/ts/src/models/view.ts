import type { Component, Snippet } from 'svelte'
import type { Look, Preset, Shift, Widget } from './query.ts'
import type { Option } from './select.ts'

// The client side of a slice: what a feat's collections look like, and
// what a graft adds to the collections of the feats it joins. Views and
// pages are configuration over the one collection component and the one
// detail view; blocks are the components a detail view composes.

// Where the sidebar puts a collection that is not a feature's: `home`,
// what waits on the acting member, always shown; and `platform`,
// Settings, a sidebar of its own, its collections under Personal, the
// member's own, or Organization, the co-op's, as each names its
// `subgroup`. A collection that names neither is its feat's, in the
// sidebar where the circle the member is in enabled that feature.
export type Group = 'home' | 'platform'

// A `person` is an address, shown as the person's chip: their name, the
// address on hover, after the icon of the collection of people; a `circle`
// is a circle's id, shown as its name.
export type Kind = 'text' | 'title' | 'mono' | 'money' | 'date' | 'number' | 'badge' | 'priority' | 'boolean' | 'person' | 'circle'

export type Tone = 'neutral' | 'accent' | 'positive' | 'negative' | 'warning'

// A column of a collection. In the list view `role` places it: the title,
// the line under it, or the trailing meta; `hidden` keeps it to the table.
export interface Column<R = any> {
  key: string
  label: string
  kind?: Kind
  value: (row: R) => unknown
  tone?: (row: R) => Tone
  role?: 'title' | 'sub' | 'meta' | 'hidden'
  // The collection whose record the value names, as a task's assignee
  // names one of `people`: the value wears that collection's icon.
  record?: string
  // The collection whose record's id the value is, as a task's project's
  // id: that record's page jumps by it to the rows naming it. A person
  // column's address names one of `people`, a circle column's id one of
  // `circles`, with no `of`.
  of?: string
}

// How a property is changed, in the popover its row opens: `pick` among
// options, one or many (searchable, each with its icon, dot or avatar),
// `icon` from the curated grid, `date` on a calendar, `text` typed. The
// choice goes through the named `write`, as the field `field` (many
// comma-separated) beside any `extra` fields, the record being the
// page's own, as a form posts it.
export interface Edit {
  kind: 'pick' | 'icon' | 'date' | 'text'
  write: string
  field: string
  // What it holds now: an option's value, the values chosen, an icon's
  // slug, a day, the text.
  current?: string | string[] | null
  options?: Option[]
  multi?: boolean
  // The choice that clears it, for a single pick.
  none?: string
  number?: boolean
  extra?: [string, string][]
  // Where a choice is another write than `write`, by the choice's value: a
  // task's status moves, but done is a completion.
  writes?: Record<string, string>
  // What a typed value is asked in, as its placeholder: euros for a sum.
  hint?: string
}

// A property whose edit is a slice's own: a block drawn in its popover,
// given its data, closing it through `close`.
export interface Editor<D = any> {
  block: Component<{ data: D; close: () => void }>
  data: D
}

// A row in the drawer's Properties: an icon and a value, its `label` on
// hover and for a screen reader, drawn beside the value only where the
// value cannot say what it is (a figure, a count, a phrase). One with no
// value is not listed, but offered under Add property where it can be
// `edit`ed; one whose `href` is a record's, `/<collection>/<id>`, wears
// that collection's icon.
export interface Prop {
  label: string
  value: unknown
  kind?: Kind
  tone?: Tone
  href?: string
  // A glyph of its own, in the ink seeded by `ink`, as a record's icon.
  icon?: Component<any>
  ink?: string
  // Several people, by address, as a row of avatars, instead of a value;
  // the first leads.
  people?: string[]
  edit?: Edit | Editor
  // Clustered with its neighbours of the same group, a little apart from
  // the rest, in the order its first names it.
  group?: string
}

// A line of the drawer's Related: a record it links to, or a jump to the
// collection `collection` names, filtered to the rows that name the
// record, wearing that collection's icon and `count`, how many of them
// the reader sees.
export interface Link {
  label: string
  sub?: string
  href: string
  collection?: string
  count?: number
}

export interface Event {
  at: string
  text: string
  // Who did it, by address, shown as their chip.
  who?: string
  // What a comment says, under its line.
  body?: string
}

// A thing of one slice drawn inside another's item, such as a motion
// inside a document: the slice that knows the kind of thing draws it by
// its `ref`, from its own data on the item, and offers the things it may
// embed. A graft declares it on the page of the feat it extends.
export interface Embed<E = any> {
  label: string
  block: Component<{ ref: string; data: E }>
  choices?: (data: E) => { ref: string; label: string }[]
}

// The embeds a page's blocks may draw, by kind, each with its slice's
// data on the item.
export type Embeds = Record<string, { embed: Embed; data: unknown }>

// Who looks at a page: the signed-in person, and the device their
// session signs with.
export interface Viewer {
  actor: string
  device: string
}

// A block: a component the detail view renders in its content, given the
// item's data, or a graft's data on it, the item's id, the embeds the
// page's slices draw, and who looks.
export type Block<T = any> = Component<{ data: T; id: string; embeds?: Embeds; viewer?: Viewer | null }>

// The comment box: a block that also reads whom a mention may name, by
// fetching it once it mounts; edit-time data, never awaited with the
// item at SSR.
export type Comment<T = any> = Component<{ data: T; id: string; embeds?: Embeds; viewer?: Viewer | null; readers?: () => Promise<unknown[]> }>

// A block in a tab of the item's page: a bare block sits in the first.
// An extension's block names a tab its owner's page declares.
export type Placed<T = any> = Block<T> | { tab: string; block: Block<T> }

// A tab of an item's page, a genuinely different view of the item. Only
// the page's owner declares tabs, at most four.
export interface Tab {
  id: string
  label: string
}

export interface Page<T = any> {
  // The kind of item, the tooltip on its name.
  eyebrow: string
  title: (data: T) => string
  // The record's reference, its id, the header's crumb.
  subtitle?: (data: T) => string
  // The record's own words where it holds them as text, a circle's
  // purpose or a report's caption, under its title.
  summary?: (data: T) => string | null | undefined
  // The drawer's label and value rows, and the records it links to.
  properties?: (data: T) => Prop[]
  related?: (data: T) => Link[]
  // Blocks in the drawer's Details, over its rows: a structured field set
  // where it is shown, as a task's assignee, since the content is the
  // record's free-form body.
  details?: Block<T>[]
  // False keeps the log's four, Created, Updated and by whom, out of the
  // Details' properties and in their own History at the drawer's foot,
  // for a page too crowded to carry them among its own fields.
  history?: boolean
  // What happened to the item, newest first; the page merges every
  // slice's and shows them oldest first, under its content.
  activity?: (data: T) => Event[]
  // The box that adds a comment, under the Activity, where the kind
  // takes comments.
  comment?: Comment<T>
  // The page's tabs, the first its default, as pills in the header: at
  // most four, in order, chosen by the slice that owns the collection,
  // its extensions placing their blocks in them. A tab past the first
  // that holds no block, as one whose extension is pruned, is not shown;
  // an extension the owner gives no tab is a jump in Related.
  tabs?: Tab[]
  blocks?: Placed<T>[]
  // What this slice draws inside the item's blocks, by kind.
  embeds?: Record<string, Embed<T>>
  // Writes on the item, in the header.
  actions?: Block<T>
}

// A panel of the drawer, behind its tab: an icon, the label it is named
// by, and what it holds.
export interface Panel {
  id: string
  label: string
  icon: Component<any>
  body: Snippet
  // Something the panel wants seen while it is shut, as the View panel's
  // unsaved changes: a small dot on its tab, and said in its label.
  note?: string
}

// A badge beside the header's count, over the collection's `about`: the
// rows are paged on the server, so a figure over all of them is read there.
export type Status = (about: any) => { label: string; tone: Tone } | undefined

export interface View<R = any> {
  group?: Group
  // A heading a Settings collection sits under, Personal or
  // Organization.
  subgroup?: string
  title: string
  // A line under the title saying what the collection is, in its trade's
  // words.
  caption?: string
  icon: Component<any>
  columns: Column<R>[]
  // A form for a new item, behind the collection's New button.
  create?: Component<{ rows: R[]; about: any }>
  // A badge beside the header's count saying whether the whole collection
  // holds, as the log's verifying; the collection's `about`, from its
  // server side, is handed to it and to `create`. Figures over the rows
  // are a dashboard's widgets, never a component of the page's own.
  status?: Status
  // The dashboard's widgets until a viewer configures their own; without
  // them, defaults derived from the columns' kinds.
  dashboard?: Widget[]
  // The views offered as tabs before the viewer's own, All after them.
  views?: Preset[]
  // How it looks before a view changes it, and the board's moves that are
  // writes.
  look?: Look
  shifts?: Shift[]
  empty?: string
  // Rows link to their detail; a collection without pages lists only.
  linked?: boolean
  // False keeps the collection out of the sidebar, as files are, which
  // belong to the records they are attached to; the command menu still
  // reaches it.
  listed?: boolean
  // Where a row links when it is not an item of the collection's own, as
  // what waits in the inbox links to where it is done.
  href?: (row: R) => string | undefined
  // The sidebar counts its rows for the acting member.
  counted?: boolean
}

// The theme a person wears: light, dark or the system's.
export type Theme = 'light' | 'dark' | 'system'

// A settings page a slice serves at `/settings/<name>`, in Settings'
// sidebar under its group, first in it: its title and icon, and the block
// that draws it, given what its server side read for the acting person,
// who looks, and the theme they wear. A page of one thing, served at
// `/settings/<name>/<id>` as a circle's features are, is `listed: false`:
// the sidebar names no thing, and the thing's own page links to it.
export interface SettingsPage<T = any> {
  subgroup: 'Personal' | 'Organization'
  title: string
  caption?: string
  listed?: boolean
  icon: Component<any>
  block: Component<{ data: T; viewer: Viewer | null; theme: Theme }>
}

// A collection a feat owns: its view, and its items' page if it has one.
export interface Owned<R = any, T = any> {
  view: View<R>
  page?: Page<T>
}

// What a graft, or the root, adds to a feat's collection: columns over the
// fields its server side adds to each row, and cards and blocks over its
// data on one item.
export interface Added<E = any> {
  columns?: Column[]
  // A badge over the collection's `about`, with what this adds to it.
  status?: Status
  // Widgets over the fields this adds, after the owner's.
  dashboard?: Widget[]
  // Preset views over the fields this adds, after the owner's.
  views?: Preset[]
  // A look over the fields this adds, each part of which overrides the
  // owner's, and the board moves it makes writes.
  look?: Look
  shifts?: Shift[]
  // A New form for a write of the extension's: one that replaces the
  // owner's, or, where the owner has none, one of several, as people take
  // an invitation (membership's) and a hire (employment's), each under its
  // `title`.
  create?: Component<{ rows: any[]; about: any }>
  title?: string
  // What it adds to the item's page, its blocks in the tabs the owner's
  // page declares; its subtitle stands where the owner's page gives none,
  // as a mandate reads as its policy's sentence.
  page?: Omit<Partial<Page<E>>, 'eyebrow' | 'title' | 'summary' | 'tabs'>
}

// The sidebar's navigation, by group, `home`, `feature` and `platform`: a
// feature's collection names its `feature`, the feat that owns it; a
// collection's `count` is its rows for the acting member in the lensed
// circle, its pill; `waiting`, all of them whatever the lens, which a
// shut accordion's dot sums.
export type Nav = {
  group: string
  items: { href: string; title: string; icon: Component<any>; count?: number; waiting?: number; subgroup?: string; listed?: boolean; feature?: string }[]
}[]

// A member the dev server may act as.
export interface Person {
  address: string
  name: string
}

// Somewhere the command menu jumps to.
export interface Jump {
  title: string
  sub?: string
  href: string
  kind: string
}

export interface App {
  name: string
  collections?: Record<string, Owned>
  extends?: Record<string, Added>
  settings?: Record<string, SettingsPage>
}

// An account a statement's line gathers, with its figure in each column,
// linking to its ledger.
export interface SheetAccount {
  code: string
  label: string
  href: string
  amounts: number[]
}

// A rubric of a financial statement, with its figure in each column: a
// heading names what follows and has none; a line gathers accounts, which
// it opens on; a total sums lines.
export interface SheetRow {
  id: string
  kind: 'heading' | 'line' | 'total'
  label: string
  amounts: (number | null)[]
  accounts?: SheetAccount[]
}
