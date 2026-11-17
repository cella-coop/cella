<script lang="ts">
  import type { Snippet } from 'svelte'

  // Items side by side, wrapping where the column ends: a widget's
  // buttons, chips or counts.
  let { children }: { children: Snippet } = $props()
</script>

<div class="row">{@render children()}</div>

<style>
  .row {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: var(--space-2);
    min-width: 0;
  }
</style>
