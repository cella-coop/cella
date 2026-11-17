<script lang="ts">
  import type { Column } from '../models/view.ts'
  import type { Key } from '../models/calendar.ts'
  import { inked } from '../models/ink.ts'
  import Card from './Card.svelte'
  import Value from './Value.svelte'

  // What a grouped calendar's colours mean, as a card of the drawer under
  // the View's: one row per value, drawn as the value is wherever else it
  // appears (a circle's icon in its ink and its name), its colour as a
  // swatch, and how many of the rows the period shows hold it, muted at
  // the right, so no value is told by colour alone.
  let { by, keys }: { by: Column; keys: Key[] } = $props()
</script>

<Card title="Legend">
  <ul aria-label="By {by.label.toLowerCase()}">
    {#each keys as k (k.value)}
      <li style={k.ink === null ? undefined : inked(k.ink)} class:inked={k.ink !== null}>
        <span class="swatch" aria-hidden="true"></span>
        {#if k.value === ''}
          <span class="none">None</span>
        {:else}
          <Value value={by.value(k.row)} kind={by.kind} tone={by.tone?.(k.row)} record={by.record} />
        {/if}
        <span class="count">{k.count}</span>
      </li>
    {/each}
  </ul>
</Card>

<style>
  ul {
    list-style: none;
    margin: 0;
    padding: 0;
    display: grid;
    gap: 2px;
  }
  li {
    display: flex;
    align-items: center;
    gap: var(--space-2);
    min-width: 0;
    min-height: 1.75rem;
    font-size: var(--text-sm);
  }
  .none {
    color: var(--text-subtle);
  }
  .count {
    margin-inline-start: auto;
    color: var(--text-muted);
    font-variant-numeric: tabular-nums;
  }
  .swatch {
    flex: none;
    width: 0.75rem;
    height: 0.75rem;
    border-radius: 3px;
    background: var(--neutral-soft);
    box-shadow: inset 0 0 0 1px var(--line);
  }
  .inked .swatch {
    background: var(--wash);
    box-shadow: inset 0 0 0 1.5px var(--mark);
  }
</style>
