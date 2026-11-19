<script lang="ts">
  import type { Snippet } from 'svelte'

  // A page's one column, as wide as a body's text and its panels, centred
  // in the content, the space either side split evenly; it spaces what it
  // holds as the content spaces its blocks, and sets the inset its
  // content starts at. A record's page and a settings page alike; one
  // listing a collection takes the content's width (`wide`).
  let { wide = false, children }: { wide?: boolean; children: Snippet } = $props()
</script>

<div class="column" class:wide>{@render children()}</div>

<style>
  .column {
    --inset: var(--space-4);
    display: grid;
    align-content: start;
    gap: var(--space-4);
    width: 100%;
    max-width: 48rem;
    margin-inline: auto;
    min-width: 0;
  }
  .column > :global(*) {
    min-width: 0;
  }
  .wide {
    max-width: none;
  }
</style>
