<script lang="ts">
  import type { Component } from 'svelte'
  import type { Column } from '../models/view.ts'
  import { show } from '../models/format.ts'
  import { inked, inkOf } from '../models/ink.ts'
  import { useShell } from '../hooks/useShell.ts'
  import Avatar from './Avatar.svelte'
  import Value from './Value.svelte'
  import Icon from './Icon.svelte'

  // An item as a card in a gallery or on a board, laid out as Linear's:
  // a muted reference (the first monospaced field the view chose) at the
  // top left and, at the right, the avatar of the first field naming a
  // person; then its title, two lines at most, after its own icon; then
  // the other chosen fields as quiet chips, wrapping, none labelled and
  // an empty one drawn not at all; and a muted line at the foot for the
  // first created or updated date. The whole card opens the item; on a
  // board, it is also what is dragged between columns.
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

  const shell = useShell()
  const filled = (c: Column) => show(c.value(row), c.kind) !== '—'
  const ref = $derived(shown.find((c) => c.kind === 'mono' && filled(c)))
  const who = $derived(shown.find((c) => c.kind === 'person' && filled(c)))
  const dated = $derived(shown.find((c) => c.kind === 'date' && /^(created|updated)/i.test(c.label) && filled(c)))
  const chips = $derived(shown.filter((c) => c !== ref && c !== who && c !== dated && filled(c)))
  const address = $derived(who ? String(who.value(row)) : '')
  const name = $derived(shell.name(address) ?? address)
</script>

{#snippet body()}
  <!-- A reference heads the card with the avatar at its right; with none,
       the avatar sits at the end of the title's first line, so no empty
       row opens the card. -->
  {#if ref}
    <span class="top">
      <span class="ref">{show(ref.value(row), ref.kind)}</span>
      {#if who}<span class="who" title="{who.label}: {name}"><Avatar {name} size="1.25rem" /></span>{/if}
    </span>
  {/if}
  <span class="title">
    {#if icon}<span class="mark" style={inked(inkOf(String(titled.value(row))))}><Icon {icon} /></span>{/if}
    <span class="text">{titled.value(row)}</span>
    {#if who && !ref}<span class="who" title="{who.label}: {name}"><Avatar {name} size="1.25rem" /></span>{/if}
  </span>
  {#if chips.length}
    <span class="chips">
      {#each chips as c (c.key)}
        <Value value={c.value(row)} kind={c.kind} tone={c.tone?.(row)} record={c.record} size="card" />
      {/each}
    </span>
  {/if}
  {#if dated}
    <span class="foot">{dated.label} {show(dated.value(row), dated.kind)}</span>
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
    border: 1px solid color-mix(in oklab, var(--text) 9%, transparent);
    grid-template-columns: minmax(0, 1fr);
    min-width: 0;
    transition: background var(--fast) var(--ease);
  }
  a.tile:hover {
    background: var(--hover);
  }
  .top {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--space-2);
    min-height: 1.25rem;
  }
  .ref {
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    color: var(--text-muted);
    font-family: var(--font-mono);
    font-size: var(--text-xs);
  }
  .who {
    display: inline-flex;
    margin-inline-start: auto;
  }
  .title .who {
    flex: none;
    align-self: flex-start;
  }
  .title {
    display: flex;
    align-items: baseline;
    gap: var(--space-2);
    font-weight: 500;
    line-height: 1.35;
  }
  .text {
    flex: 1 1 auto;
    min-width: 0;
    display: -webkit-box;
    -webkit-box-orient: vertical;
    -webkit-line-clamp: 2;
    line-clamp: 2;
    overflow: hidden;
    overflow-wrap: anywhere;
  }
  .mark {
    display: inline-flex;
    flex: none;
    align-self: center;
    color: var(--mark);
  }
  .chips {
    min-width: 0;
    display: flex;
    flex-wrap: wrap;
    gap: var(--space-1);
  }
  .foot {
    color: var(--text-muted);
    font-size: var(--text-xs);
  }
</style>
