<script lang="ts">
  import type { Snippet } from 'svelte'
  import type { Prop } from '../models/view.ts'
  import Stat from './Stat.svelte'

  // A row of computed figures over a collection or a record, wrapping:
  // each a `Stat`, given as `items` or composed as its children. In a
  // section it sits at the section's inset, in a panel flush to it.
  let { items = [], children }: { items?: Pick<Prop, 'label' | 'value' | 'kind' | 'tone' | 'href'>[]; children?: Snippet } = $props()
</script>

<dl class="stats">
  {#each items as s (s.label)}
    <Stat label={s.label} value={s.value} kind={s.kind} tone={s.tone} href={s.href} />
  {/each}
  {@render children?.()}
</dl>

<style>
  /* Tiles of one width, as many as fit a line, so a second line's stand
     under the first's. */
  .stats {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(8.5rem, 1fr));
    gap: var(--space-2);
    margin: 0;
    padding-inline: var(--inset, 0);
  }
</style>
