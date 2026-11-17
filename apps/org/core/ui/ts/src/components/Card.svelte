<script lang="ts">
  import type { Snippet } from 'svelte'

  // A borderless card, raised on the panel: a drawer's Properties, Related,
  // Activity or View, or a block in the content. Same styling wherever it
  // sits: a title in sentence case with its count muted, never an
  // eyebrow; its own padding insets what it holds.
  let { title, count, actions, children }: { title: string; count?: number; actions?: Snippet; children: Snippet } = $props()
</script>

<section class="card">
  <div class="head">
    <h2 class="title">{title}{#if count !== undefined}<span class="count">{count}</span>{/if}</h2>
    {#if actions}<span class="actions">{@render actions()}</span>{/if}
  </div>
  {@render children()}
</section>

<style>
  .card {
    --inset: 0;
    display: grid;
    gap: var(--space-2);
    padding: var(--space-3) var(--space-4) var(--space-4);
    background: var(--raised);
    border-radius: var(--radius-panel);
    min-width: 0;
  }
  /* An optional quiet control at the title's end, which the title's own
     line makes room for. */
  .head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--space-2);
    min-height: 1.5rem;
  }
  .actions {
    display: flex;
    align-items: center;
  }
  .title {
    font-family: var(--font-ui);
    font-size: var(--text-sm);
    font-weight: 500;
    color: var(--text-muted);
    display: flex;
    align-items: baseline;
    gap: var(--space-2);
  }
  .count {
    color: var(--text-subtle);
    font-weight: 400;
    font-variant-numeric: tabular-nums;
  }
</style>
