<script lang="ts">
  import type { Snippet } from 'svelte'
  import { useSection } from '../hooks/useSection.ts'

  // A block in a page's content: a title in sentence case with its count
  // muted beside it, over what it holds, on the panel itself, so blocks
  // read as one page rather than boxes. Its title, notes, forms and
  // figures share one inline padding (`--inset`), its tables' first
  // column's.
  let { title, count, children }: { title: string; count?: number; children: Snippet } = $props()

  useSection(() => title)
</script>

<section class="section">
  <h2 class="title">{title}{#if count !== undefined}<span class="count">{count}</span>{/if}</h2>
  {@render children()}
</section>

<style>
  .section {
    --inset: var(--space-3);
    display: grid;
    gap: var(--space-2);
    min-width: 0;
  }
  .title {
    font-family: var(--font-display);
    font-size: var(--text-lg);
    font-weight: 500;
    color: var(--text);
    display: flex;
    align-items: baseline;
    gap: var(--space-2);
    padding-inline: var(--inset);
  }
  .count {
    font-family: var(--font-ui);
    font-size: var(--text-sm);
    font-weight: 400;
    color: var(--text-subtle);
    font-variant-numeric: tabular-nums;
  }
</style>
