<script lang="ts">
  import type { Snippet } from 'svelte'

  // Items side by side, wrapping where the column ends: chips, counts,
  // read-only fields. `end` sets them at the row's end; `spaced` sets them
  // further apart, as fields each a label over its value.
  let { end = false, spaced = false, children }: { end?: boolean; spaced?: boolean; children: Snippet } = $props()
</script>

<div class="row" class:end class:spaced>{@render children()}</div>

<style>
  .row {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: var(--space-2);
    min-width: 0;
  }
  .end {
    justify-content: end;
  }
  .spaced {
    align-items: start;
    gap: var(--space-3) var(--space-6);
  }
</style>
