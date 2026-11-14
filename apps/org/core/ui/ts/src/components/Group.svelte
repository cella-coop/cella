<script lang="ts">
  import type { Column } from '../models/view.ts'
  import Cell from './Cell.svelte'

  // The header over a group of a list's, a feed's, a table's or a
  // gallery's rows: the value they share as its column draws it, a
  // person's chip, a circle's name, an enumeration's badge, or None where
  // they hold none; then how many rows the group holds across every page,
  // as a board's column says. `row` is one of them, which the value and
  // its tone are read from.
  let { by, row, empty, count }: { by: Column; row: any; empty: boolean; count: number } = $props()
</script>

<span class="group">
  {#if empty}
    <span class="none">None</span>
  {:else}
    <Cell value={by.value(row)} kind={by.kind} tone={by.tone?.(row)} />
  {/if}
  <span class="count">{count}</span>
</span>

<style>
  .group {
    display: inline-flex;
    align-items: center;
    gap: var(--space-2);
    min-width: 0;
    font-family: var(--font-ui);
    font-size: var(--text-sm);
    font-weight: 500;
    color: var(--text);
  }
  .none {
    color: var(--text-muted);
  }
  .count {
    color: var(--text-muted);
    font-weight: 400;
  }
</style>
