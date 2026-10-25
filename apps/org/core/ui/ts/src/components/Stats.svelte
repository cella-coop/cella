<script lang="ts">
  import type { Prop } from '../models/view.ts'
  import Cell from './Cell.svelte'

  // A row of figures over a collection or an item: totals, a status. A
  // tile's label is the one place an eyebrow stands, in small tracked
  // capitals; in a section the row sits at the section's inset.
  let { items }: { items: Prop[] } = $props()
</script>

<dl class="stats">
  {#each items as s (s.label)}
    <div class="stat">
      <dt>{s.label}</dt>
      <dd><Cell value={s.value} kind={s.kind} tone={s.tone} /></dd>
    </div>
  {/each}
</dl>

<style>
  .stats {
    display: flex;
    flex-wrap: wrap;
    gap: var(--space-2);
    margin: 0;
    padding-inline: var(--inset, 0);
  }
  .stat {
    background: var(--raised);
    border-radius: var(--radius-panel);
    padding: var(--space-2) var(--space-4);
    min-width: 9rem;
  }
  dt {
    font-size: var(--text-2xs);
    font-weight: 600;
    letter-spacing: var(--eyebrow-tracking);
    text-transform: uppercase;
    color: var(--text-subtle);
  }
  dd {
    margin: 0;
    font-family: var(--font-display);
    font-size: var(--text-xl);
    display: flex;
  }
</style>
