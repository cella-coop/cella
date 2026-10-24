<script lang="ts">
  import type { Snippet } from 'svelte'

  // A block in a page's content: an eyebrow title over what it holds, on
  // the panel itself, so blocks read as one page rather than boxes.
  let { title, count, children }: { title: string; count?: number; children: Snippet } = $props()
</script>

<section class="section">
  <h2 class="eyebrow">{title}{#if count !== undefined}<span class="count">{count}</span>{/if}</h2>
  {@render children()}
</section>

<style>
  .section {
    display: grid;
    gap: var(--space-2);
    min-width: 0;
  }
  .eyebrow {
    font-family: var(--font-ui);
    font-size: var(--text-2xs);
    font-weight: 600;
    letter-spacing: var(--eyebrow-tracking);
    text-transform: uppercase;
    color: var(--text-subtle);
    display: flex;
    gap: var(--space-2);
    padding-inline: var(--space-3);
  }
  .count {
    font-weight: 500;
  }
</style>
