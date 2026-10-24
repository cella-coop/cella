<script lang="ts">
  import { tick, type Component } from 'svelte'
  import { goto } from '$app/navigation'
  import { page } from '$app/state'
  import Rows from 'phosphor-svelte/lib/Rows'
  import TableIcon from 'phosphor-svelte/lib/Table'
  import ChartBar from 'phosphor-svelte/lib/ChartBar'
  import Plus from 'phosphor-svelte/lib/Plus'
  import type { Column, Status } from '../models/view.ts'
  import { fields, type Result, type Widget } from '../models/query.ts'
  import { control, nearest, typing } from '../models/keys.ts'
  import { useCollection } from '../hooks/useCollection.ts'
  import { useShell } from '../hooks/useShell.ts'
  import Button from './Button.svelte'
  import Card from './Card.svelte'
  import Cell from './Cell.svelte'
  import Dashboard from './Dashboard.svelte'
  import Frame from './Frame.svelte'
  import Icon from './Icon.svelte'
  import Table from './Table.svelte'
  import Widgets from './Widgets.svelte'

  // The one collection component: the same header and rows for every
  // collection, as a list, a table or a dashboard, and the drawer's View
  // card holding how they are shown: the filter, the layout and, in a
  // table, its columns, in a dashboard, its widgets. Keyboard first: j and
  // k move, Enter opens, / filters, c creates.
  let {
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
    dashboard = null,
  }: {
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
    // In the dashboard view, the server's run of its widgets.
    dashboard?: { custom: boolean; widgets: Widget[]; results: Result[]; errors: string[] } | null
  } = $props()

  const state = useCollection(() => rows, () => columns)
  const shell = useShell()

  const views = [
    { id: 'list', label: 'List', icon: Rows },
    { id: 'table', label: 'Table', icon: TableIcon },
    { id: 'dashboard', label: 'Dashboard', icon: ChartBar },
  ]
  // The layout, the table's hidden columns and the dashboard's widgets
  // live in the address, so a view can be linked and the server renders
  // it as it is.
  const view = $derived(views.find((v) => v.id === page.url.searchParams.get('view'))?.id ?? 'list')
  const typed = $derived(fields(columns))
  const hidden = $derived(new Set(page.url.searchParams.get('hide')?.split(',') ?? []))
  const titled = $derived(columns.find((c) => c.role === 'title') ?? columns[0])
  const subs = $derived(columns.filter((c) => c.role === 'sub'))
  const metas = $derived(columns.filter((c) => c.role === 'meta'))
  const visible = $derived(columns.filter((c) => c === titled || !hidden.has(c.key)))

  const count = (n: number) => `${n} ${n === 1 ? 'item' : 'items'}`
  const subtitle = $derived(
    [caption, state.filter ? `${state.shown.length} of ${count(rows.length)} · “${state.filter}”` : count(rows.length)]
      .filter(Boolean)
      .join(' · '),
  )

  const switchTo = (id: string) => {
    const query = new URLSearchParams(page.url.search)
    query.set('view', id)
    return `${page.url.pathname}?${query}`
  }

  function arrange(ws: Widget[] | null) {
    const query = new URLSearchParams(page.url.search)
    if (ws) {
      query.set('w', JSON.stringify(ws))
    } else {
      query.delete('w')
    }
    goto(`${page.url.pathname}?${query}`, { replace: true, reset: false })
  }

  function hide(key: string, off: boolean) {
    const keys = new Set(hidden)
    if (off) {
      keys.add(key)
    } else {
      keys.delete(key)
    }
    const query = new URLSearchParams(page.url.search)
    if (keys.size) {
      query.set('hide', [...keys].join(','))
    } else {
      query.delete('hide')
    }
    goto(`${page.url.pathname}?${query}`, { replace: true, reset: false })
  }

  function open(i: number) {
    const link = state.shown[i] && href?.(state.shown[i])
    if (link) {
      goto(link)
    }
  }

  // The filter is in the drawer: / opens it first when it is closed.
  async function filter() {
    shell.show(true)
    await tick()
    state.focus()
  }

  function onkeydown(e: KeyboardEvent) {
    if (e.metaKey || e.ctrlKey || e.altKey) {
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

<Frame {eyebrow} {title} {subtitle} badges={status.map((s) => s(rows, about)).filter((b) => b !== undefined)}>
  {#snippet actions()}
    {#if create}
      <Button tone="primary" kbd="C" onclick={() => state.toggle()}><Icon icon={Plus} />New</Button>
    {/if}
  {/snippet}

  {#snippet drawer()}
    <Card title="View">
      <div class="filter">
        <input bind:this={state.search} bind:value={state.filter} placeholder="Filter" aria-label="Filter" />
        <kbd>/</kbd>
      </div>
      <div class="option">
        <span class="label">Layout</span>
        <nav class="views" aria-label="Layout">
          {#each views as v (v.id)}
            <a href={switchTo(v.id)} class:on={view === v.id} aria-current={view === v.id ? 'page' : undefined}>
              <Icon icon={v.icon} />{v.label}
            </a>
          {/each}
        </nav>
      </div>
      {#if view === 'table'}
        <fieldset class="columns">
          <legend class="label">Columns</legend>
          {#each columns as c (c.key)}
            <label>
              <input
                type="checkbox"
                checked={c === titled || !hidden.has(c.key)}
                disabled={c === titled}
                onchange={(e) => hide(c.key, !e.currentTarget.checked)}
              />
              {c.label}
            </label>
          {/each}
        </fieldset>
      {:else if view === 'dashboard' && dashboard}
        <Widgets widgets={dashboard.widgets} fields={typed} {values} custom={dashboard.custom} onchange={arrange} />
      {/if}
    </Card>
  {/snippet}

  {#if create && state.creating}
    {const Create = $derived(create)}
    <Card title="New"><Create {rows} {about} /></Card>
  {/if}

  <div class="rows">
    {#if view === 'dashboard'}
      <Dashboard results={dashboard?.results ?? []} errors={dashboard?.errors ?? []} />
    {:else if state.shown.length === 0}
      <p class="empty">{state.filter ? `Nothing matches “${state.filter}”.` : empty}</p>
    {:else if view === 'table'}
      <Table columns={visible} rows={state.shown} {href} active={state.active} />
    {:else}
      <ul class="list">
        {#each state.shown as row, i (row.id)}
          {const link = $derived(href?.(row))}
          <li class:active={i === state.active} {@attach nearest(i === state.active)}>
            <span class="main">
              {#if link}
                <a href={link} class="title stretched">{titled.value(row)}</a>
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
  .filter {
    position: relative;
  }
  .filter input {
    padding-inline-end: 2rem;
  }
  .filter kbd {
    position: absolute;
    inset-inline-end: var(--space-2);
    top: 50%;
    translate: 0 -50%;
    font-family: var(--font-ui);
    font-size: var(--text-2xs);
    color: var(--text-subtle);
    pointer-events: none;
  }
  .option {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--space-3);
  }
  .label {
    font-size: var(--text-sm);
    color: var(--text-muted);
  }
  .views {
    display: flex;
    background: var(--sunk);
    border-radius: var(--radius-control);
    padding: 2px;
  }
  .views a {
    display: flex;
    align-items: center;
    gap: var(--space-1);
    height: 1.75rem;
    padding: 0 var(--space-2);
    border-radius: calc(var(--radius-control) - 2px);
    font-size: var(--text-sm);
    color: var(--text-muted);
  }
  .views a.on {
    background: var(--selected);
    color: var(--text);
  }
  .columns {
    display: grid;
    gap: var(--space-1);
    margin: 0;
    padding: 0;
    border: none;
  }
  .columns legend {
    padding: 0 0 var(--space-1);
  }
  .columns label {
    display: flex;
    align-items: center;
    gap: var(--space-2);
    font-size: var(--text-sm);
    cursor: pointer;
  }
  .columns input {
    width: auto;
    min-height: 0;
    margin: 0;
    accent-color: var(--accent-fill);
  }
  .list {
    list-style: none;
    margin: 0;
    padding: 0;
  }
  li {
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
  li:hover,
  li.active {
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
