<script lang="ts">
  import type { View } from '../../hooks/EditorState.svelte.ts'

  let { view }: { view: View } = $props()
</script>

<div class="divider" data-atomic={view.id}><hr /></div>

<style>
  .divider {
    padding: var(--space-2) 0;
    cursor: default;
  }

  hr {
    border: none;
    border-top: 1px solid var(--line);
    margin: 0;
  }
</style>
