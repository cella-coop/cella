<script lang="ts">
  import Editable from '../Editable.svelte'
  import { useEditor } from '../../hooks/useEditor.ts'
  import type { View } from '../../hooks/EditorState.svelte.ts'

  let { view }: { view: View } = $props()
  const ed = useEditor()
  const checked = $derived(view.props.checked ?? false)
</script>

<div class="item" class:done={checked}>
  <input type="checkbox" {checked} aria-label="Done" onchange={() => ed.check(view.id, !checked)} />
  <Editable id={view.id} placeholder="To-do" />
</div>

<style>
  .item {
    display: flex;
    gap: var(--space-2);
    align-items: flex-start;
  }

  input {
    margin: 0.3em 0 0;
    accent-color: var(--accent-fill);
    width: 1em;
    height: 1em;
  }

  .done :global(.editable) {
    color: var(--text-subtle);
    text-decoration: line-through;
  }
</style>
