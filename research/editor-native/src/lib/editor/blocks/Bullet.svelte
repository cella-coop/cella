<script lang="ts">
  import Editable from '../Editable.svelte'
  import type { View } from '../../hooks/EditorState.svelte.ts'

  let { view }: { view: View } = $props()
  const marker = $derived(['•', '◦', '▪'][view.depth % 3])
</script>

<div class="item">
  <span class="marker" aria-hidden="true">{marker}</span>
  <Editable id={view.id} placeholder="List" />
</div>

<style>
  .item {
    display: flex;
    gap: var(--space-2);
  }

  .marker {
    width: 1.1em;
    text-align: center;
    color: var(--text-muted);
    padding-top: 2px;
    font-size: 1.15em;
    line-height: 1.3;
  }
</style>
