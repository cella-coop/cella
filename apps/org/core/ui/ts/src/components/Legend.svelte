<script lang="ts">
  import type { Column } from '../models/view.ts'
  import type { Key } from '../models/calendar.ts'
  import { inked } from '../models/ink.ts'
  import Card from './Card.svelte'
  import Count from './Count.svelte'
  import Value from './Value.svelte'

  // What a grouped calendar's colours mean, as a card of the drawer under
  // the View's: one row per value, drawn as the value is wherever else it
  // appears (a circle's icon in its ink and its name), its colour as a
  // swatch, and how many of the rows the period shows hold it, muted at
  // the right, so no value is told by colour alone. A press on a row hides
  // that value's entries from the grid, and the row dims.
  let { by, keys, muted, ontoggle }: { by: Column; keys: Key[]; muted: Set<string>; ontoggle: (value: string) => void } = $props()
</script>

<Card title="Legend">
  <ul aria-label="By {by.label.toLowerCase()}">
    {#each keys as k (k.value)}
      <li style={k.ink === null ? undefined : inked(k.ink)} class:inked={k.ink !== null} class:hidden={muted.has(k.value)}>
        <button type="button" aria-pressed={!muted.has(k.value)} title="{muted.has(k.value) ? 'Show' : 'Hide'} {k.value === '' ? 'None' : k.value}" onclick={() => ontoggle(k.value)}>
          <span class="swatch" aria-hidden="true"></span>
          {#if k.value === ''}
            <span class="none">None</span>
          {:else}
            <Value value={by.value(k.row)} kind={by.kind} tone={by.tone?.(k.row)} states={by.states} record={by.record} />
          {/if}
          <span class="count"><Count value={k.count} /></span>
        </button>
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
  button {
    display: flex;
    align-items: center;
    gap: var(--space-2);
    width: 100%;
    min-width: 0;
    min-height: 1.75rem;
    padding: 0 var(--space-1);
    border: none;
    border-radius: var(--radius-control);
    background: none;
    color: var(--text);
    font: inherit;
    font-size: var(--text-sm);
    text-align: start;
    cursor: pointer;
  }
  button:hover {
    background: var(--hover);
  }
  .hidden button {
    opacity: 0.45;
  }
  .hidden .swatch {
    background: none;
    box-shadow: inset 0 0 0 1px var(--line);
  }
  .none {
    color: var(--text-subtle);
  }
  .count {
    margin-inline-start: auto;
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
