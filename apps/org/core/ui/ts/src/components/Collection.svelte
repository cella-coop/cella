<script lang="ts">
  import { tick, type Component } from 'svelte'
  import { goto } from '$app/navigation'
  import { page } from '$app/state'
  import SlidersHorizontal from 'phosphor-svelte/lib/SlidersHorizontal'
  import Plus from 'phosphor-svelte/lib/Plus'
  import type { Column, Status } from '../models/view.ts'
  import { address, alike, fields, matches, spec as preset, type Custom, type Preset, type Result, type Spec, type Widget } from '../models/query.ts'
  import { control, nearest, typing } from '../models/keys.ts'
  import { mark } from '../marks.ts'
  import { useCollection } from '../hooks/useCollection.ts'
  import { useShell } from '../hooks/useShell.ts'
  import { useViews } from '../hooks/useViews.ts'
  import Button from './Button.svelte'
  import Card from './Card.svelte'
  import Cell from './Cell.svelte'
  import Dashboard from './Dashboard.svelte'
  import Frame from './Frame.svelte'
  import Icon from './Icon.svelte'
  import Table from './Table.svelte'
  import Viewing from './Viewing.svelte'

  // The one collection component: the same header, view bar and rows for
  // every collection, as a list, a table or a dashboard, and the drawer's
  // View card holding how they are shown. The view bar's tabs are the
  // collection's preset views, then the viewer's own; the active one, and
  // anything changed from it, live in the address, so a view can be
  // linked and the server renders it as it is. Keyboard first: j and k
  // move, Enter opens, / filters, c creates.
  let {
    name,
    eyebrow,
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
    dashboard = null,
  }: {
    name: string
    eyebrow: string
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
    // In the dashboard layout, the server's run of its widgets.
    dashboard?: { custom: boolean; widgets: Widget[]; results: Result[]; errors: string[] } | null
  } = $props()

  const typed = $derived(fields(columns))
  const kept = $derived(rows.filter((r) => matches(r, spec.where, typed, today)))
  const state = useCollection(() => kept, () => columns, () => spec.q)
  const shell = useShell()
  const saved = useViews(() => name)

  const hidden = $derived(new Set(spec.hide))
  const titled = $derived(columns.find((c) => c.role === 'title') ?? columns[0])
  const subs = $derived(columns.filter((c) => c.role === 'sub'))
  const metas = $derived(columns.filter((c) => c.role === 'meta'))
  const visible = $derived(columns.filter((c) => c === titled || !hidden.has(c.key)))

  const active = $derived(views.find((v) => v.id === view))
  const custom = $derived(saved.find(view))
  const base = $derived(custom?.spec ?? preset(active))
  const dirty = $derived(!alike({ ...spec, q: state.filter }, base))

  const count = (n: number) => `${n} ${n === 1 ? 'item' : 'items'}`
  const subtitle = $derived(
    [caption, state.filter ? `${state.shown.length} of ${count(kept.length)} · “${state.filter}”` : count(kept.length)].filter(Boolean).join(' · '),
  )
  const noun = $derived(title.toLowerCase())

  const link = (id: string, s: Spec, p?: Preset) => `${page.url.pathname}${address(id, s, p)}`
  const presetLink = (p: Preset) => link(p.id, preset(p), p)
  const customLink = (c: Custom) => link(c.id, c.spec)
  const tally = (c: Custom) => rows.filter((r) => matches(r, c.spec.where, typed, today)).length

  // A change to what the active view shows, kept in the address.
  function change(s: Spec) {
    goto(link(view, s, active), { replace: true, reset: false })
  }

  function opened(c: Custom) {
    goto(customLink(c))
  }

  function remove() {
    if (custom) {
      saved.remove(custom.id)
      goto(link('all', preset()))
    }
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
    {custom}
    {dirty}
    onchange={change}
    onsave={opened}
    onremove={remove}
  />
{/snippet}

<Frame
  {eyebrow}
  {title}
  {subtitle}
  badges={status.map((s) => s(rows, about)).filter((b) => b !== undefined)}
  panels={[{ id: 'view', label: 'View', icon: SlidersHorizontal, body: viewing }]}
>
  {#snippet actions()}
    {#if create}
      <Button tone="primary" kbd="C" onclick={() => state.toggle()}><Icon icon={Plus} />New</Button>
    {/if}
  {/snippet}

  <nav class="bar" aria-label="Views">
    <ul>
      {#each views as v (v.id)}
        <li>
          <a
            href={presetLink(v)}
            class:on={view === v.id}
            aria-current={view === v.id ? 'page' : undefined}
            title="View {v.name} {noun} {v.count}"
            onclick={() => (state.filter = '')}
          >
            <Icon icon={mark(v.icon ?? (v.id === 'all' ? 'all' : undefined))} />{v.name}
          </a>
        </li>
      {/each}
      {#each saved.list as c (c.id)}
        <li>
          <a
            href={customLink(c)}
            class:on={view === c.id}
            aria-current={view === c.id ? 'page' : undefined}
            title="View {c.name} {noun} {tally(c)}"
            onclick={() => (state.filter = c.spec.q)}
          >
            <Icon icon={mark(c.icon)} />{c.name}
          </a>
        </li>
      {/each}
    </ul>
    <button class="new" title="Save this as a view" aria-label="Save this as a view" onclick={naming}><Icon icon={Plus} /></button>
  </nav>

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
  .bar {
    display: flex;
    align-items: center;
    gap: var(--space-2);
    margin-top: calc(-1 * var(--space-2));
  }
  .bar ul {
    display: flex;
    flex-wrap: wrap;
    gap: 2px;
    list-style: none;
    margin: 0;
    padding: 0;
  }
  .bar a {
    display: flex;
    align-items: center;
    gap: var(--space-1);
    height: 1.75rem;
    padding: 0 var(--space-2);
    border-radius: var(--radius-control);
    font-size: var(--text-sm);
    color: var(--text-muted);
  }
  .bar a:hover {
    background: var(--hover);
    color: var(--text);
  }
  .bar a.on {
    background: var(--sunk);
    color: var(--text);
    font-weight: 500;
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
