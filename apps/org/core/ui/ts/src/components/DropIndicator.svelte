<script lang="ts">
  // The one drop indicator: where a dragged item will land in a list, a
  // line across a column of items or down a row of them. A list item, as
  // every sortable list in the UI core is a list.
  let { show, axis = 'y' }: { show: boolean; axis?: 'x' | 'y' } = $props()
</script>

{#if show}
  <li class="drop {axis}" aria-hidden="true"></li>
{/if}

<style>
  .drop {
    list-style: none;
    border-radius: var(--radius-pill);
    background: var(--accent-border);
    flex: none;
  }
  .y {
    height: 2px;
    margin: -1px 0;
  }
  .x {
    width: 2px;
    margin: 0 -1px;
    align-self: stretch;
  }
</style>
