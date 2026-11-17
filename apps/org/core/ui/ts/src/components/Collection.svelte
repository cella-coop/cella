<script lang="ts">
  import { onMount, type Component } from 'svelte'
  import { goto } from '$app/navigation'
  import { page } from '$app/state'
  import SlidersHorizontal from 'phosphor-svelte/lib/SlidersHorizontal'
  import Plus from 'phosphor-svelte/lib/Plus'
  import type { Column, Status } from '../models/view.ts'
  import {
    address,
    alike,
    arranged,
    fields,
    grouping,
    lanes,
    opens,
    PAGE,
    spec as preset,
    swimlane,
    type Custom,
    type Pin,
    type Look,
    type Preset,
    type Result,
    type Shift,
    type Spec,
    type Widget,
    under,
  } from '../models/query.ts'
  import { anchor, period } from '../models/calendar.ts'
  import { widest } from '../models/format.ts'
  import { abandon } from '../models/navigation.ts'
  import { control, focused, typing } from '../models/keys.ts'
  import { inked, inkOf } from '../models/ink.ts'
  import { mark } from '../marks.ts'
  import { recordIcon } from '../record-icons.ts'
  import { sortable } from '../attachments/sortable.ts'
  import { useWrites } from '../hooks/useWrites.ts'
  import { useCollection } from '../hooks/useCollection.ts'
  import { useCreate } from '../hooks/useCreate.ts'
  import { useDrag } from '../hooks/useDrag.ts'
  import { useRow } from '../hooks/useRow.ts'
  import { useShell } from '../hooks/useShell.ts'
  import { useViews } from '../hooks/useViews.ts'
  import Board from './Board.svelte'
  import Button from './Button.svelte'
  import Calendar from './Calendar.svelte'
  import Dialog from './Dialog.svelte'
  import Gallery from './Gallery.svelte'
  import Group from './Group.svelte'
  import Pill from './Pill.svelte'
  import Cell from './Cell.svelte'
  import Dashboard from './Dashboard.svelte'
  import DropIndicator from './DropIndicator.svelte'
  import FilterBar from './FilterBar.svelte'
  import Frame from './PageFrame.svelte'
  import Icon from './Icon.svelte'
  import Table from './Table.svelte'
  import Viewing from './Viewing.svelte'

  // The one collection component: the same header, view bar, filter bar
  // and rows for every collection, as a list, a table, a gallery, a
  // board, a calendar or a dashboard, and the drawer's View panel holding
  // how they are shown (layout, grouping, sort, fields; display only).
  // The filter bar always draws on its own line under the header, above
  // the rows, at one height: chips on the left, Search and + Filter on
  // the right (`FilterBar`). The view
  // bar's tabs are the collection's preset views, then the viewer's own;
  // the active one, and anything changed from it, live in the address, so
  // a view can be linked and the server renders it as it is. The rows are
  // the server's, kept, filtered and paged in SQL: the page of them the
  // address asks for, out of `kept`, of which `matched` hold the text
  // filter. Keyboard first: j and k move, Enter opens, / filters, f adds
  // a filter, c creates.
  let {
    name,
    title,
    icon,
    columns,
    rows,
    kept,
    matched,
    href,
    own,
    about,
    creates = [],
    status = [],
    empty = 'Nothing here yet.',
    caption,
    values = {},
    groups = {},
    views,
    view,
    spec,
    errors = [],
    today,
    look,
    shifts,
    dashboard = null,
    sorted = null,
    declared = null,
    whole = false,
  }: {
    name: string
    title: string
    // The collection's icon, as the sidebar shows it.
    icon?: Component<any>
    caption?: string
    columns: Column[]
    rows: any[]
    // How many rows the view keeps, and how many of those hold its text
    // filter.
    kept: number
    matched: number
    href?: (row: any) => string | undefined
    // The row's own page, where `href` links it elsewhere.
    own?: (row: any) => string | undefined
    about?: unknown
    // The New forms, each under its title where there are several.
    creates?: { title?: string; form: Component<{ rows: any[]; about: any }> }[]
    status?: Status[]
    empty?: string
    // Each enumeration's values over the rows, for the editors' choices.
    values?: Record<string, string[]>
    // How many rows each value of the field they are grouped by holds,
    // across every page.
    groups?: Record<string, number>
    // The preset views, each with how many rows it keeps.
    views: (Preset & { count: number })[]
    // The active view's id, and what it shows, as the server read them.
    view: string
    spec: Spec
    errors?: string[]
    today: string
    // How the collection looks before a view changes it, and the board
    // moves it makes writes.
    look: Look
    shifts: Shift[]
    // In the dashboard layout, the server's run of its widgets.
    dashboard?: { custom: boolean; widgets: Widget[]; results: Result[]; errors: string[] } | null
    // The field the rows are ordered by first, and which way, the view's
    // sort or else the collection's own order (`declared`), which a
    // table's header says.
    sorted?: { key: string; dir: 'ascending' | 'descending' } | null
    declared?: { key: string; dir: 'ascending' | 'descending' } | null
    // Whether the member's lens leaves the collection whole, as it does
    // one whose rows name no circle that owns them, which its header says.
    whole?: boolean
  } = $props()

  const typed = $derived(fields(columns))
  const state = useCollection(
    () => rows,
    () => matched - rows.length,
    () => spec.q,
    {
      // A filter typed, once the typing pauses, and a next page, each
      // asked of the server in the address.
      filter: (q) => {
        if (q !== spec.q) {
          change({ ...spec, q })
        }
      },
      more: () => {
        const q = new URLSearchParams(page.url.search)
        q.set('n', String(rows.length + PAGE))
        goto(`${page.url.pathname}?${q}`, { replace: true, reset: false }).catch(abandon)
      },
    },
  )
  // The keyboard's row, kept as the page is left and focused again when
  // history comes back to it, once the rows are drawn.
  const row = useRow()
  onMount(() =>
    row.follow(
      () => state.active,
      (i) => (state.active = i),
    ),
  )
  const shell = useShell()
  const saved = useViews(
    () => name,
    () => kept,
    (c) => customLink(c),
  )
  const drag = useDrag()
  const writes = useWrites()
  // New: the shell's one Dialog, holding the create forms.
  const create = useCreate()

  const hidden = $derived(new Set(spec.hide))
  const titled = $derived(columns.find((c) => c.role === 'title') ?? columns[0])
  // A row's own icon, of the curated set, where its collection's rows
  // carry one (a project's, a circle's): its own where it is set, else
  // the collection's, as a reference to one wears elsewhere (`Cell`).
  // A collection whose rows carry no `icon` field at all wears none here,
  // as before.
  const markOf = (row: unknown) => {
    const icoded = row as { icon?: string | null }
    return icoded && 'icon' in icoded ? (recordIcon(icoded.icon) ?? icon) : undefined
  }
  const subs = $derived(columns.filter((c) => c.role === 'sub'))
  const metas = $derived(columns.filter((c) => c.role === 'meta'))
  // A table's columns, but the one its rows are grouped by, which each
  // group's header names.
  const visible = $derived(arranged(columns, spec.order).filter((c) => c === titled || (!hidden.has(c.key) && c !== group?.by)))

  const active = $derived(views.find((v) => v.id === view))
  const custom = $derived(saved.find(view))
  // What a preset, or All for a custom view, shows over the collection's
  // look: what the server resolves an address against.
  const resolved = (id: string) => preset(views.find((v) => v.id === id), look)
  const base = $derived(custom?.spec ?? resolved(view))
  const dirty = $derived(!alike({ ...spec, q: state.filter }, base))

  const count = $derived(spec.q ? `${matched} of ${kept} · “${spec.q}”` : String(kept))
  const noun = $derived(title.toLowerCase())

  const link = (id: string, s: Spec) => `${page.url.pathname}${address(id, s, resolved(id))}`
  const presetLink = (p: Preset) => link(p.id, resolved(p.id))
  const customLink = (c: Custom) => link(c.id, c.spec)
  // The open view as Pinned holds it: at its own address, not with what
  // is changed from it, named by the collection where it is a preset.
  const pin: Pin | null = $derived(
    custom
      ? { collection: name, view: custom.id, name: custom.name, ...(custom.icon ? { icon: custom.icon } : {}), href: customLink(custom) }
      : active
        ? { collection: name, view: active.id, name: active.id === 'all' ? title : `${title}: ${active.name}`, ...(active.icon ? { icon: active.icon } : {}), href: presetLink(active) }
        : null,
  )

  // The gallery's and the board's cards: the view's fields, or the
  // collection's lines under a title and its trailing meta; and the
  // board's columns, an enumeration, person or circle: the view's own
  // `columns`, else, migrated in code, the one its `by` named before a
  // board had columns of its own, else the one the collection's look
  // names, else its first enumeration.
  const grouped = $derived(columns.find((c) => c.key === grouping({ layout: 'board', by: spec.by, columns: spec.columns }, typed, look)?.key))
  // A board's swimlanes: the field its rows group by, each lane holding
  // the whole set of columns; none for a single lane.
  const laning = $derived(columns.find((c) => c.key === swimlane(spec, typed)?.key))
  // The field a list, a table or a gallery groups its rows by,
  // where the view names one: a header over each group's rows, with its
  // value and how many rows it holds across every page, a chevron that
  // collapses it (`state.collapsed`, `state.toggleGroup`) and, where the
  // collection offers New, a + that creates in it.
  const group = $derived.by(() => {
    const by = ['list', 'table', 'gallery'].includes(spec.layout) && spec.by ? columns.find((c) => c.key === grouping(spec, typed)?.key) : undefined
    return by && { by, counts: groups, month: by.kind === 'date', collapsed: state.collapsed, oncollapse: (v: string) => state.toggleGroup(v), oncreate: creates.length ? () => create.show() : undefined }
  })
  const opening = (i: number) => !!group && opens(state.shown, i, group.by.key, group.month)
  // The fields the view chooses, in its order, but those a layout always
  // shows: every layout's title.
  const chosen = (fixed: Column[]) => arranged(columns, spec.cards).filter((c) => spec.cards.includes(c.key) && !fixed.includes(c))
  // What Display offers to show, and what shows: a list's fields under
  // and after each row's title, the collection's lines and meta where the
  // view chooses none; else the cards' fields. A list takes the
  // look's own card fields as no choice, its cards' and not theirs.
  const fixed = $derived([titled])
  const choices = $derived(columns.filter((c) => !fixed.includes(c)))
  const lined = $derived(spec.layout === 'list')
  const choosing = $derived(spec.cards.length > 0 && !(lined && spec.cards.join() === (look.cards ?? []).join()))
  // What the rows are grouped by leaves them, as its header names it,
  // but where the view chose it.
  const shown = $derived(
    choosing ? chosen(fixed)
    : spec.layout === 'list' ? [...subs, ...metas].filter((c) => c !== group?.by)
    : [...subs, ...metas].filter((c) => c !== grouped && c !== laning && c !== group?.by),
  )
  // A list places each field it shows by its role: a line under the title
  // goes under it, any other after it, with the meta.
  const lines = $derived(shown.filter((c) => c.role === 'sub'))
  const after = $derived(shown.filter((c) => c.role !== 'sub'))

  // The calendar's date, the first when the view names none, and the
  // month or week around the day the address is at, else today's.
  const placing = $derived(typed.find((f) => f.key === spec.on) ?? typed.find((f) => f.type === 'date'))
  const shownPeriod = $derived(period(anchor(page.url.searchParams.get('at'), today), spec.span, today))
  // The field a calendar colours its cards by, where the view groups by
  // one, and its values in its board's order, which hand out the inks.
  const tinted = $derived(spec.layout === 'calendar' && spec.by ? columns.find((c) => c.key === grouping(spec, typed)?.key && c.kind !== 'date') : undefined)
  const tints = $derived(tinted ? lanes(look, tinted.key, values[tinted.key] ?? []) : [])

  // A calendar draws its period even with no row on its days, so it keeps
  // its header and navigation; `kept` counts the view over the whole
  // collection, so only a collection with no rows says it is empty.

  // A list, a table and a gallery draw a page of rows at a time; a board
  // and a calendar place every row the view keeps, and a dashboard draws
  // none.
  const paging = $derived(!(spec.layout === 'dashboard' || (spec.layout === 'board' && grouped) || (spec.layout === 'calendar' && placing)))

  const at = (day: string | null) => {
    const q = new URLSearchParams(page.url.search)
    if (day) {
      q.set('at', day)
    } else {
      q.delete('at')
    }
    return `${page.url.pathname}?${q}`
  }

  // A change to what the active view shows, kept in the address; where
  // the viewer is in a calendar, `at`, is not the view's, and stays.
  function change(s: Spec) {
    const to = link(view, s)
    const where = page.url.searchParams.get('at')
    goto(where ? `${to}${to.endsWith('?') ? '' : '&'}at=${encodeURIComponent(where)}` : to, { replace: true, reset: false }).catch(abandon)
  }

  function opened(c: Custom) {
    goto(customLink(c)).catch(abandon)
  }

  function remove() {
    if (custom) {
      saved.remove(custom.id)
      goto(link('all', resolved('all'))).catch(abandon)
    }
  }

  // A card dropped in another column: the collection's write for that
  // move, sent for the item as its button posts it, signed as the acting
  // member, with the column it entered as `to`, for a write that takes a
  // card into any of several. The outcome shows as any write's; the rows
  // come back with it, so a refused move leaves the card where it was.
  async function move(id: string, s: Shift, to: string) {
    await writes.shown(writes.send(s.action, [['to', to]], id))
  }

  function open(i: number) {
    const target = state.shown[i] && href?.(state.shown[i])
    if (target) {
      goto(target).catch(abandon)
    }
  }

  function naming() {
    shell.choose('view')
    saved.naming = true
  }

  // The filter bar's Save: through the view's own save, as its Save
  // always went, a viewer's own view updated at once, a preset named as
  // a new one, in the drawer's View panel.
  function saveView() {
    if (custom) {
      saved.update(custom.id, { ...spec, q: state.filter })
    } else {
      naming()
    }
  }

  // Reset: back to what the open view shows before this page's own
  // changes, in the address and in the filter still being typed.
  function reset() {
    state.filter = base.q
    state.adding = null
    state.searching = false
    change(base)
    state.refocus()
  }

  function onkeydown(e: KeyboardEvent) {
    // While a dialog is open, the rows behind it take no key.
    if (e.metaKey || e.ctrlKey || e.altKey || e.defaultPrevented || create.open || document.querySelector('dialog[open], [aria-modal="true"]')) {
      return
    }
    if (typing(e)) {
      if (e.target === state.search && e.key === 'Escape') {
        e.preventDefault()
        state.collapse()
      }
      if (e.target === state.search && e.key === 'ArrowDown') {
        state.enter()
      }
      return
    }
    if (e.key === 'j' || e.key === 'ArrowDown') {
      state.move(1)
      e.preventDefault()
    } else if (e.key === 'k' || e.key === 'ArrowUp') {
      state.move(-1)
      e.preventDefault()
    } else if (e.key === 'Enter' && state.active >= 0 && !control(e)) {
      open(state.active)
    } else if (e.key === '/') {
      e.preventDefault()
      state.searching = true
    } else if (e.key === 'f' || e.key === 'F') {
      e.preventDefault()
      state.openAdd()
    } else if (e.key === 'c' && creates.length) {
      create.show()
      e.preventDefault()
    }
  }
</script>

<svelte:window {onkeydown} />

<!-- A group's header in a list, over the first of its rows. -->
{#snippet head(row: any)}
  {#if group}
    {const value = $derived(under(row, group.by.key, group.month))}
    <li class="group">
      <Group
        by={group.by}
        {row}
        {value}
        month={group.month}
        count={group.counts[value] ?? 0}
        collapsed={group.collapsed.has(value)}
        oncollapse={() => group.oncollapse(value)}
        oncreate={group.oncreate}
      />
    </li>
  {/if}
{/snippet}

{#snippet viewing()}
  <Viewing
    {name}
    {spec}
    fields={typed}
    {columns}
    {titled}
    {values}
    {dashboard}
    {shown}
    {choices}
    grouped={grouped?.key}
    swimlane={laning?.key}
    placing={placing?.key}
    {declared}
    opened={base}
    {custom}
    {pin}
    {whole}
    onchange={change}
    onsave={opened}
    onremove={remove}
  />
{/snippet}

<Frame
  {title}
  {icon}
  {count}
  {caption}
  subtitle={whole && shell.lens ? `The lens on ${shell.lens.name} leaves ${title} whole: no circle owns its rows.` : spec.across && shell.lens ? `Across circles: every circle's ${noun} you read.` : undefined}
  badges={status.map((s) => s(about)).filter((b) => b !== undefined)}
  panels={[{ id: 'view', label: 'View', icon: SlidersHorizontal, body: viewing }]}
>
  {#snippet actions()}
    {#if creates.length}
      <Button tone="primary" kbd="C" onclick={() => create.show()}><Icon icon={Plus} />New</Button>
    {/if}
  {/snippet}

  {#snippet bar()}
  <nav class="viewbar" aria-label="Views">
    <ul>
      {#each views as v (v.id)}
        <li>
          <Pill
            href={presetLink(v)}
            on={view === v.id}
            icon={mark(v.icon ?? (v.id === 'all' ? 'all' : undefined))}
            title="View {v.name} {noun} {v.count}"
            onclick={() => {
              state.filter = ''
              state.searching = false
              state.adding = null
            }}
          >
            {v.name}
          </Pill>
        </li>
      {/each}
    </ul>
    <!-- The viewer's own views, which they drag into their order. -->
    <ul
      {@attach sortable(drag, {
        list: 'views',
        axis: 'x',
        label: (i) => saved.list[i]?.name ?? 'view',
        onmove: (from, to) => saved.arrange(from, to),
      })}
    >
      {#each saved.list as c, i (c.id)}
        <DropIndicator show={drag.before('views', i)} axis="x" />
        <li data-drag-item="views" data-drag-index={i}>
          <Pill
            href={customLink(c)}
            on={view === c.id}
            icon={mark(c.icon)}
            title="View {c.name} {noun} {saved.tallies[c.id] ?? ''}"
            aria-roledescription="draggable view"
            data-drag-handle
            onclick={() => {
              state.filter = c.spec.q
              state.searching = false
              state.adding = null
            }}
          >
            {c.name}
          </Pill>
        </li>
      {/each}
      <DropIndicator show={drag.before('views', saved.list.length)} axis="x" />
    </ul>
    <button class="new" title="Save this as a view" aria-label="Save this as a view" onclick={naming}><Icon icon={Plus} /></button>
  </nav>
  {/snippet}

  <FilterBar {spec} {base} fields={typed} {values} {dirty} onchange={change} onsave={saveView} onreset={reset} />

  {#if errors.length}
    <div role="status">
      <ul class="errors">
        {#each errors as e (e)}<li>{e}</li>{/each}
      </ul>
    </div>
  {/if}

  <!-- New's dialog, in the top layer: the create forms, each under its
       title where there are several, mounted only while it is open. A
       page draws no create form. -->
  {#if creates.length}
    <Dialog bind:dialog={create.dialog} title="New in {title}" oncancel={() => create.close()} onclose={() => create.closed()}>
      {#if create.open}
        <!-- Keyed by the form, which stays as the rows read again, so a
             refused form keeps what was typed. -->
        {#each creates as c (c.form)}
          {const Create = $derived(c.form)}
          {#if creates.length > 1}<h3 class="creates">{c.title ?? 'New'}</h3>{/if}
          <Create {rows} {about} />
        {/each}
      {/if}
    </Dialog>
  {/if}

  <div class="rows">
    {#if spec.layout === 'dashboard'}
      <Dashboard results={dashboard?.results ?? []} errors={dashboard?.errors ?? []} />
    {:else if state.shown.length === 0 && !(spec.layout === 'calendar' && placing && kept > 0)}
      <p class="empty">{spec.q ? `Nothing matches “${spec.q}”.` : empty}</p>
    {:else if spec.layout === 'table'}
      <Table
        columns={visible}
        rows={state.shown}
        {href}
        active={state.active}
        stop={state.stop}
        onfocusrow={(i) => (state.active = i)}
        {sorted}
        onsort={(key) => change({ ...spec, q: state.filter, sort: { field: key, dir: sorted?.key === key && sorted.dir === 'ascending' ? 'desc' : 'asc' } })}
        {group}
        mark={markOf}
      />
    {:else if spec.layout === 'gallery'}
      <Gallery rows={state.shown} {titled} {shown} {href} {group} mark={markOf} />
    {:else if spec.layout === 'board' && grouped}
      <Board
        rows={state.shown}
        by={grouped}
        lanes={lanes(look, grouped.key, values[grouped.key] ?? [])}
        swimlane={laning}
        swimlanes={laning ? lanes(look, laning.key, values[laning.key] ?? []) : []}
        collapsed={state.collapsed}
        oncollapse={(v) => state.toggleGroup(v)}
        {titled}
        {shown}
        {href}
        {shifts}
        onshift={(id, s, _, to) => move(id, s, to)}
        mark={markOf}
      />
    {:else if spec.layout === 'calendar' && placing}
      <Calendar rows={state.shown} on={placing} period={shownPeriod} {titled} {shown} {href} link={at} sorted={spec.sort !== null} by={tinted} order={tints} />
    {:else}
      <ul class="list" class:nested={!!group}>
        {#each state.shown as row, i (row.id)}
          {const to = $derived(href?.(row))}
          {#if opening(i)}{@render head(row)}{/if}
          <!-- svelte-ignore a11y_no_noninteractive_tabindex: the keyboard roves the rows, one in the tab order, so a screen reader reads the row it is on -->
          {#if !group || !group.collapsed.has(under(row, group.by.key, group.month))}
          <li
            class:active={i === state.active}
            tabindex={i === state.stop ? 0 : -1}
            onfocusin={() => (state.active = i)}
            {@attach focused(i === state.active)}
          >
            <span class="main">
              {const rowIcon = $derived(markOf(row))}
              {#if to}
                <a href={to} class="title stretched" tabindex="-1">{#if rowIcon}<span class="mark" style={inked(inkOf(String(titled.value(row))))}><Icon icon={rowIcon} /></span>{/if}{titled.value(row)}</a>
              {:else}
                <span class="title">{#if rowIcon}<span class="mark" style={inked(inkOf(String(titled.value(row))))}><Icon icon={rowIcon} /></span>{/if}{titled.value(row)}</span>
              {/if}
              {#each lines as c (c.key)}
                <span class="sub"><Cell value={c.value(row)} kind={c.kind === 'badge' ? 'text' : c.kind} record={c.record} /></span>
              {/each}
            </span>
            <span class="meta">
              {#each after as c (c.key)}
                {#if c.kind === 'date'}
                  <!-- A date takes the width of the widest, an empty one its dim dash in the same box, so what comes before it lines up down the list. -->
                  <span class="dated"><span class="widest" aria-hidden="true">{widest}</span><Cell value={c.value(row)} kind="date" tone={c.tone?.(row)} /></span>
                {:else}
                  <Cell value={c.value(row)} kind={c.kind} tone={c.tone?.(row)} record={c.record} />
                {/if}
              {/each}
            </span>
          </li>
          {/if}
        {/each}
      </ul>
    {/if}
    {#if paging && state.left > 0}
      <p class="more">
        <Button onclick={() => state.extend()}>Show {Math.min(state.left, PAGE)} more</Button>
        <span>{state.shown.length} of {matched}</span>
      </p>
    {/if}
  </div>
</Frame>

<style>
  /* The view bar, as Linear's: quiet tabs, the active one on a sunk fill,
     and the button that saves what is shown as a new view. */
  .viewbar {
    display: flex;
    align-items: center;
    gap: var(--space-1);
    min-width: 0;
    overflow-x: auto;
    scrollbar-width: none;
  }
  .viewbar ul {
    display: flex;
    gap: var(--space-1);
    list-style: none;
    margin: 0;
    padding: 0;
  }
  .new {
    display: grid;
    place-items: center;
    width: 1.75rem;
    height: 1.75rem;
    border: none;
    border-radius: var(--radius-control);
    background: none;
    color: var(--text-muted);
    cursor: pointer;
  }
  .new:hover {
    background: var(--hover);
    color: var(--text);
  }
  /* A create form's title, where New holds several. */
  .creates {
    margin: 0;
    font-size: var(--text-sm);
    font-weight: 500;
    color: var(--text-muted);
  }
  .errors {
    margin: 0;
    padding: var(--space-2) var(--space-3);
    list-style: none;
    border-radius: var(--radius-control);
    background: var(--warning-soft);
    color: var(--warning-text);
    font-size: var(--text-sm);
  }
  .list {
    list-style: none;
    margin: 0;
    padding: 0;
  }
  .list li {
    position: relative;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--space-4);
    min-height: var(--row);
    padding: 0 var(--space-3);
    border-radius: var(--radius-control);
    font-size: var(--text-sm);
  }
  .list li:not(.group):hover,
  .list li.active {
    background: var(--hover);
  }
  /* A group's header: a quiet line over its rows, with room above it. */
  .list li.group {
    min-height: 0;
    padding: var(--space-3) var(--space-3) var(--space-1);
  }
  /* The first group has nothing above it but the filter bar, which keeps
     its own gap: no room of its own above it. */
  .list li.group:first-child {
    padding-top: 0;
  }
  /* Grouped, the rows sit inset from their group's bar at both ends, so
     each reads as held by the header above it. */
  .list.nested li:not(.group) {
    margin-inline: var(--space-3);
  }
  /* The title's link covers its row, so the whole row opens the item. */
  .stretched::after {
    content: '';
    position: absolute;
    inset: 0;
  }
  .main {
    display: flex;
    flex: 1 1 auto;
    align-items: baseline;
    gap: var(--space-3);
    min-width: 0;
    overflow: hidden;
  }
  .title {
    display: inline-flex;
    align-items: center;
    gap: var(--space-1);
    font-weight: 500;
    white-space: nowrap;
  }
  .title .mark {
    display: inline-flex;
    flex: none;
    color: var(--mark);
  }
  .sub {
    color: var(--text-muted);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .meta {
    display: flex;
    align-items: center;
    gap: var(--space-4);
    flex-shrink: 0;
  }
  /* A trailing date's box: as wide as the widest date, in tabular
     figures, the date or its dash at its end. */
  .dated {
    display: inline-grid;
    justify-items: end;
    font-variant-numeric: tabular-nums;
  }
  .dated > :global(*) {
    grid-area: 1 / 1;
  }
  .widest {
    visibility: hidden;
  }
  .empty {
    color: var(--text-muted);
    padding: var(--space-4) var(--space-3);
  }
  .more {
    display: flex;
    align-items: center;
    gap: var(--space-3);
    margin: var(--space-3) 0 0;
    padding-inline: var(--space-3);
    font-size: var(--text-sm);
    color: var(--text-muted);
  }
</style>
