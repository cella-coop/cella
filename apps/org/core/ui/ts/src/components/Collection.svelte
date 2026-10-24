<script lang="ts">
  import { tick, type Component } from 'svelte'
  import { applyAction, deserialize } from '$app/forms'
  import { goto, refreshAll } from '$app/navigation'
  import { page } from '$app/state'
  import SlidersHorizontal from 'phosphor-svelte/lib/SlidersHorizontal'
  import Plus from 'phosphor-svelte/lib/Plus'
  import type { Column, Status } from '../models/view.ts'
  import {
    address,
    alike,
    arranged,
    fields,
    lanes,
    matches,
    spec as preset,
    type Custom,
    type Look,
    type Preset,
    type Result,
    type Shift,
    type Spec,
    type Widget,
  } from '../models/query.ts'
  import { control, nearest, typing } from '../models/keys.ts'
  import { mark } from '../marks.ts'
  import { sortable } from '../attachments/sortable.ts'
  import { useCollection } from '../hooks/useCollection.ts'
  import { useDrag } from '../hooks/useDrag.ts'
  import { useShell } from '../hooks/useShell.ts'
  import { useViews } from '../hooks/useViews.ts'
  import Board from './Board.svelte'
  import Button from './Button.svelte'
  import Card from './Card.svelte'
  import Gallery from './Gallery.svelte'
  import Pill from './Pill.svelte'
  import Cell from './Cell.svelte'
  import Dashboard from './Dashboard.svelte'
  import DropIndicator from './DropIndicator.svelte'
  import Frame from './PageFrame.svelte'
  import Icon from './Icon.svelte'
  import Table from './Table.svelte'
  import Viewing from './Viewing.svelte'

  // The one collection component: the same header, view bar and rows for
  // every collection, as a list, a table, a gallery, a board or a
  // dashboard, and the drawer's
  // View card holding how they are shown. The view bar's tabs are the
  // collection's preset views, then the viewer's own; the active one, and
  // anything changed from it, live in the address, so a view can be
  // linked and the server renders it as it is. Keyboard first: j and k
  // move, Enter opens, / filters, c creates.
  let {
    name,
    title,
    columns,
    rows,
    href,
    about,
    create,
    status = [],
    empty = 'Nothing here yet.',
    caption,
    values = {},
    views,
    view,
    spec,
    errors = [],
    today,
    look,
    shifts,
    dashboard = null,
  }: {
    name: string
    title: string
    caption?: string
    columns: Column[]
    rows: any[]
    href?: (row: any) => string | undefined
    about?: unknown
    create?: Component<{ rows: any[]; about: any }>
    status?: Status[]
    empty?: string
    // Each enumeration's values over the rows, for the editors' choices.
    values?: Record<string, string[]>
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
  } = $props()

  const typed = $derived(fields(columns))
  const kept = $derived(rows.filter((r) => matches(r, spec.where, typed, today)))
  const state = useCollection(() => kept, () => columns, () => spec.q)
  const shell = useShell()
  const saved = useViews(() => name)
  const drag = useDrag()

  const hidden = $derived(new Set(spec.hide))
  const titled = $derived(columns.find((c) => c.role === 'title') ?? columns[0])
  const subs = $derived(columns.filter((c) => c.role === 'sub'))
  const metas = $derived(columns.filter((c) => c.role === 'meta'))
  const visible = $derived(arranged(columns, spec.order).filter((c) => c === titled || !hidden.has(c.key)))

  const active = $derived(views.find((v) => v.id === view))
  const custom = $derived(saved.find(view))
  // What a preset, or All for a custom view, shows over the collection's
  // look: what the server resolves an address against.
  const resolved = (id: string) => preset(views.find((v) => v.id === id), look)
  const base = $derived(custom?.spec ?? resolved(view))
  const dirty = $derived(!alike({ ...spec, q: state.filter }, base))

  const count = $derived(state.filter ? `${state.shown.length} of ${kept.length} · “${state.filter}”` : String(kept.length))
  const noun = $derived(title.toLowerCase())

  const link = (id: string, s: Spec) => `${page.url.pathname}${address(id, s, resolved(id))}`
  const presetLink = (p: Preset) => link(p.id, resolved(p.id))
  const customLink = (c: Custom) => link(c.id, c.spec)
  const tally = (c: Custom) => rows.filter((r) => matches(r, c.spec.where, typed, today)).length

  // The gallery's and the board's cards: the view's fields, or the
  // collection's lines under a title and its trailing meta; and the
  // board's enumeration, the first when the view names none.
  const enums = $derived(columns.filter((c) => c.kind === 'badge'))
  const grouped = $derived(columns.find((c) => c.key === spec.by) ?? enums[0])
  const shown = $derived(
    spec.cards.length ? arranged(columns, spec.cards).filter((c) => spec.cards.includes(c.key)) : [...subs, ...metas].filter((c) => c !== grouped),
  )

  // A change to what the active view shows, kept in the address.
  function change(s: Spec) {
    goto(link(view, s), { replace: true, reset: false })
  }

  function opened(c: Custom) {
    goto(customLink(c))
  }

  function remove() {
    if (custom) {
      saved.remove(custom.id)
      goto(link('all', resolved('all')))
    }
  }

  // A card dropped in another column: the collection's write for that
  // move, posted to the item's page as its button posts it, signed as the
  // acting member, with the column it entered as `to`, for a write that
  // takes a card into any of several. The outcome shows as any write's;
  // the rows are read again, so a refused move leaves the card where it
  // was.
  async function move(id: string, s: Shift, to: string) {
    const body = new FormData()
    body.set('to', to)
    const res = await fetch(`${page.url.pathname}/${encodeURIComponent(id)}?/${s.action}`, {
      method: 'POST',
      body,
      headers: { 'x-sveltekit-action': 'true' },
    })
    await applyAction(deserialize(await res.text()))
    await refreshAll()
  }

  function open(i: number) {
    const target = state.shown[i] && href?.(state.shown[i])
    if (target) {
      goto(target)
    }
  }

  // The filter is in the drawer: / opens it first when it is closed.
  async function filter() {
    shell.show(true)
    shell.choose('view')
    await tick()
    state.focus()
  }

  function naming() {
    shell.choose('view')
    saved.naming = true
  }

  function onkeydown(e: KeyboardEvent) {
    if (e.metaKey || e.ctrlKey || e.altKey || e.defaultPrevented) {
      return
    }
    if (typing(e)) {
      if (e.target === state.search && e.key === 'Escape') {
        state.clear()
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
      filter()
    } else if (e.key === 'c' && create) {
      state.toggle()
      e.preventDefault()
    }
  }
</script>

<svelte:window {onkeydown} />

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
    grouped={grouped?.key}
    {custom}
    {dirty}
    onchange={change}
    onsave={opened}
    onremove={remove}
  />
{/snippet}

<Frame
  {title}
  {count}
  {caption}
  badges={status.map((s) => s(rows, about)).filter((b) => b !== undefined)}
  panels={[{ id: 'view', label: 'View', icon: SlidersHorizontal, body: viewing }]}
>
  {#snippet actions()}
    {#if create}
      <Button tone="primary" kbd="C" onclick={() => state.toggle()}><Icon icon={Plus} />New</Button>
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
            onclick={() => (state.filter = '')}
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
            title="View {c.name} {noun} {tally(c)}"
            aria-roledescription="draggable view"
            data-drag-handle
            onclick={() => (state.filter = c.spec.q)}
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

  {#if errors.length}
    <ul class="errors" role="status">
      {#each errors as e (e)}<li>{e}</li>{/each}
    </ul>
  {/if}

  {#if create && state.creating}
    {const Create = $derived(create)}
    <Card title="New"><Create {rows} {about} /></Card>
  {/if}

  <div class="rows">
    {#if spec.layout === 'dashboard'}
      <Dashboard results={dashboard?.results ?? []} errors={dashboard?.errors ?? []} />
    {:else if state.shown.length === 0}
      <p class="empty">{state.filter ? `Nothing matches “${state.filter}”.` : empty}</p>
    {:else if spec.layout === 'table'}
      <Table columns={visible} rows={state.shown} {href} active={state.active} />
    {:else if spec.layout === 'gallery'}
      <Gallery rows={state.shown} {titled} {shown} {href} />
    {:else if spec.layout === 'board' && grouped}
      <Board
        rows={state.shown}
        by={grouped}
        lanes={lanes(look, grouped.key, values[grouped.key] ?? [])}
        {titled}
        {shown}
        {href}
        {shifts}
        onshift={(id, s, _, to) => move(id, s, to)}
      />
    {:else}
      <ul class="list">
        {#each state.shown as row, i (row.id)}
          {const to = $derived(href?.(row))}
          <li class:active={i === state.active} {@attach nearest(i === state.active)}>
            <span class="main">
              {#if to}
                <a href={to} class="title stretched">{titled.value(row)}</a>
              {:else}
                <span class="title">{titled.value(row)}</span>
              {/if}
              {#each subs as c (c.key)}
                <span class="sub"><Cell value={c.value(row)} kind={c.kind === 'badge' ? 'text' : c.kind} /></span>
              {/each}
            </span>
            <span class="meta">
              {#each metas as c (c.key)}
                <Cell value={c.value(row)} kind={c.kind} tone={c.tone?.(row)} />
              {/each}
            </span>
          </li>
        {/each}
      </ul>
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
  .list li:hover,
  .list li.active {
    background: var(--hover);
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
    font-weight: 500;
    white-space: nowrap;
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
  .empty {
    color: var(--text-muted);
    padding: var(--space-4) var(--space-3);
  }
</style>
