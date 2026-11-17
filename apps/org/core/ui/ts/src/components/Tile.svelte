<script lang="ts">
  import type { Component } from 'svelte'
  import type { Column } from '../models/view.ts'
  import { inked, inkOf } from '../models/ink.ts'
  import Cell from './Cell.svelte'
  import Icon from './Icon.svelte'

  // An item as a card in a gallery or on a board: its title and the
  // fields the view chose, each under its label. The whole card opens the
  // item; on a board, it is also what is dragged between columns.
  let {
    row,
    titled,
    shown,
    href,
    group,
    from,
    dragging = false,
    icon,
  }: {
    row: any
    titled: Column
    shown: Column[]
    href?: string
    // On a board: the group its cards move in, and the column it is in.
    group?: string
    from?: string
    dragging?: boolean
    // The row's own icon, before its title, in its own ink; none draws
    // none.
    icon?: Component<any>
  } = $props()
</script>

{#snippet body()}
  <span class="title">
    {#if icon}<span class="mark" style={inked(inkOf(String(titled.value(row))))}><Icon {icon} /></span>{/if}
    {titled.value(row)}
  </span>
  {#if shown.length}
    <dl>
      {#each shown as c (c.key)}
        <div>
          <dt>{c.label}</dt>
          <dd><Cell value={c.value(row)} kind={c.kind} tone={c.tone?.(row)} record={c.record} /></dd>
        </div>
      {/each}
    </dl>
  {/if}
{/snippet}

{#if href}
  <a
    class="tile"
    class:dragging
    {href}
    data-drag-item={group}
    data-drag-id={group ? row.id : undefined}
    data-drag-from={from}
    data-drag-handle={group ? '' : undefined}
    aria-roledescription={group ? 'draggable card' : undefined}
  >
    {@render body()}
  </a>
{:else}
  <div class="tile">{@render body()}</div>
{/if}

<style>
  .tile {
    display: grid;
    gap: var(--space-2);
    align-content: start;
    padding: var(--space-3);
    border-radius: var(--radius-panel);
    background: var(--raised);
    min-width: 0;
    transition: background var(--fast) var(--ease);
  }
  a.tile:hover {
    background: var(--hover);
  }
  .title {
    display: inline-flex;
    align-items: center;
    gap: var(--space-1);
    font-weight: 500;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .mark {
    display: inline-flex;
    flex: none;
    color: var(--mark);
  }
  dl {
    display: grid;
    gap: var(--space-1);
    margin: 0;
    font-size: var(--text-sm);
  }
  dl div {
    display: flex;
    justify-content: space-between;
    gap: var(--space-3);
    min-width: 0;
  }
  dt {
    color: var(--text-muted);
    flex: none;
  }
  dd {
    margin: 0;
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    text-align: end;
  }
</style>
