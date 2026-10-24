<script lang="ts">
  import Editable from '../Editable.svelte'
  import type { View } from '../../hooks/EditorState.svelte.ts'

  let { view }: { view: View } = $props()
</script>

<div class="item">
  <span class="marker" aria-hidden="true">{view.number}.</span>
  <Editable id={view.id} placeholder="List" />
</div>

<style>
  .item {
    display: flex;
    gap: var(--space-2);
  }

  .marker {
    min-width: 1.1em;
    text-align: right;
    color: var(--text-muted);
    padding-top: 2px;
    font-variant-numeric: tabular-nums;
  }
</style>
