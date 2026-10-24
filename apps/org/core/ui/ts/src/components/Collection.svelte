<script lang="ts">
  import type { Component } from 'svelte'
  import { goto } from '$app/navigation'
  import { page } from '$app/state'
  import Rows from 'phosphor-svelte/lib/Rows'
  import TableIcon from 'phosphor-svelte/lib/Table'
  import Plus from 'phosphor-svelte/lib/Plus'
  import type { Column } from '../models/view.ts'
  import { typing } from '../models/keys.ts'
  import { useCollection } from '../hooks/useCollection.ts'
  import Button from './Button.svelte'
  import Card from './Card.svelte'
  import Cell from './Cell.svelte'
  import Frame from './Frame.svelte'
  import Icon from './Icon.svelte'
  import Table from './Table.svelte'

  // The one collection component: the same header, filter, view switcher
  // and rows for every collection, keyboard first: j and k move, Enter
  // opens, / filters, c creates.
  let {
    eyebrow,
    title,
    columns,
    rows,
    href,
    about,
    create,
    summaries = [],
    empty = 'Nothing here yet.',
  }: {
    eyebrow: string
    title: string
    columns: Column[]
    rows: any[]
    href?: (row: any) => string | undefined
    about?: unknown
    create?: Component<{ rows: any[]; about: any }>
    summaries?: Component<{ rows: any[]; about: any }>[]
    empty?: string
  } = $props()

  const state = useCollection(() => rows, () => columns)

  const views = [
    { id: 'list', label: 'List', icon: Rows },
    { id: 'table', label: 'Table', icon: TableIcon },
  ]
  const view = $derived(page.url.searchParams.get('view') === 'table' ? 'table' : 'list')
  const titled = $derived(columns.find((c) => c.role === 'title') ?? columns[0])
  const subs = $derived(columns.filter((c) => c.role === 'sub'))
  const metas = $derived(columns.filter((c) => c.role === 'meta'))

  const switchTo = (id: string) => {
    const query = new URLSearchParams(page.url.search)
    query.set('view', id)
    return `${page.url.pathname}?${query}`
  }

  function open(i: number) {
    const link = state.shown[i] && href?.(state.shown[i])
    if (link) {
      goto(link)
    }
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
    } else if (e.key === 'Enter' && state.active >= 0) {
      open(state.active)
    } else if (e.key === '/') {
      state.focus()
      e.preventDefault()
    } else if (e.key === 'c' && create) {
      state.toggle()
      e.preventDefault()
    }
  }

  // Keeps the keyboard's row in view: the DOM's, so an effect.
  $effect(() => {
    document.querySelector(`[data-row="${state.active}"]`)?.scrollIntoView({ block: 'nearest' })
  })
</script>

<svelte:window {onkeydown} />

<Frame {eyebrow} {title} subtitle="{rows.length} {rows.length === 1 ? 'item' : 'items'}">
  {#snippet actions()}
    <input class="filter" bind:this={state.search} bind:value={state.filter} placeholder="Filter  /" aria-label="Filter" />
    <nav class="views" aria-label="View">
      {#each views as v (v.id)}
        <a href={switchTo(v.id)} class:on={view === v.id} title="{v.label} view" aria-current={view === v.id ? 'page' : undefined}>
          <Icon icon={v.icon} />
        </a>
      {/each}
    </nav>
    {#if create}
      <Button tone="primary" kbd="C" onclick={() => state.toggle()}><Icon icon={Plus} />New</Button>
    {/if}
  {/snippet}

  {#each summaries as Summary}
    <Summary {rows} {about} />
  {/each}

  {#if create && state.creating}
    {const Create = $derived(create)}
    <Card title="New"><Create {rows} {about} /></Card>
  {/if}

  <div class="rows">
    {#if state.shown.length === 0}
      <p class="empty">{state.filter ? `Nothing matches “${state.filter}”.` : empty}</p>
    {:else if view === 'table'}
      <Table {columns} rows={state.shown} {href} active={state.active} />
    {:else}
      <ul class="list">
        {#each state.shown as row, i (row.id)}
          {const link = $derived(href?.(row))}
          <li class:active={i === state.active} data-row={i}>
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
    width: 12rem;
    height: 2rem;
  }
  .views {
    display: flex;
    background: var(--sunk);
    border-radius: var(--radius-control);
    padding: 2px;
  }
  .views a {
    display: grid;
    place-items: center;
    width: 1.75rem;
    height: 1.75rem;
    border-radius: calc(var(--radius-control) - 2px);
    color: var(--text-muted);
  }
  .views a.on {
    background: var(--panel);
    color: var(--text);
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
