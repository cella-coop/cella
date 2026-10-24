<script lang="ts">
  import type { Snippet } from 'svelte'

  // A borderless card: a drawer's Properties, Related or Activity, or a
  // block in the content. Same styling wherever it sits.
  let { title, count, children }: { title: string; count?: number; children: Snippet } = $props()
</script>

<section class="card">
  <h2 class="eyebrow">{title}{#if count !== undefined}<span class="count">{count}</span>{/if}</h2>
  {@render children()}
</section>

<style>
  .card {
    display: grid;
    gap: var(--space-2);
    padding: var(--space-3) var(--space-4) var(--space-4);
    background: var(--panel);
    border-radius: var(--radius-panel);
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
  }
  .count {
    color: var(--text-subtle);
    font-weight: 500;
  }
</style>
