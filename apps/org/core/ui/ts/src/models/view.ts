import type { Component, Snippet } from 'svelte'
import type { Look, Preset, Shift, Widget } from './query.ts'

// The client side of a slice: what a feat's collections look like, and
// what a graft adds to the collections of the feats it joins. Views and
// pages are configuration over the one collection component and the one
// detail view; blocks are the components a detail view composes.

// The sidebar's sections: `home`, what waits on the acting member, always
// shown; then accordions: governance; office, the documents, meetings and
// reports; work; payments, money in and out; ledger, the accounts, their
// periods and transactions; equity, the members' capital and what the
// surplus builds; and `platform`, Settings, a sidebar of its own.
export type Group = 'home' | 'governance' | 'office' | 'work' | 'payments' | 'ledger' | 'equity' | 'platform'

// A `person` is an address, shown as the person's chip: their name, the
// address on hover.
export type Kind = 'text' | 'title' | 'mono' | 'money' | 'date' | 'number' | 'badge' | 'person'

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
}

// A label and value row in the drawer's Properties card.
export interface Prop {
  label: string
  value: unknown
  kind?: Kind
  tone?: Tone
  href?: string
}

export interface Link {
  label: string
  sub?: string
  href: string
}

export interface Event {
  at: string
  text: string
  // Who did it, by address, shown as their chip.
  who?: string
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

// A block in a tab of the item's page: a bare block sits in the first.
export type Placed<T = any> = Block<T> | { tab: string; block: Block<T> }

// A tab of an item's page, a genuinely different view of the item.
export interface Tab {
  id: string
  label: string
}

export interface Page<T = any> {
  // The kind of item, the tooltip on its name.
  eyebrow: string
  title: (data: T) => string
  subtitle?: (data: T) => string
  properties?: (data: T) => Prop[]
  related?: (data: T) => Link[]
  activity?: (data: T) => Event[]
  // The page's tabs, the first its default, as pills in the header; an
  // extension may add its own after the owner's.
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
}

// A badge beside the header's count, over the collection's `about`: the
// rows are paged on the server, so a figure over all of them is read there.
export type Status = (about: any) => { label: string; tone: Tone } | undefined

export interface View<R = any> {
  group: Group
  // A heading the collection sits under within its section, where the
  // section is long enough to need more than one; a section whose
  // collections name none, or one, lists them without headings.
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
  page?: Omit<Partial<Page<E>>, 'eyebrow' | 'title' | 'subtitle'>
}

// The sidebar's navigation, by group.
export type Nav = { group: string; items: { href: string; title: string; icon: Component<any>; count?: number; subgroup?: string; listed?: boolean }[] }[]

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
