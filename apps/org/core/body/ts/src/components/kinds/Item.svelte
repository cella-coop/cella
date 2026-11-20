<script lang="ts">
  import { blocks } from '@cella/org-ui'
  import Text from '../Text.svelte'
  import { useEditor } from '../../hooks/useEditor.ts'
  import type { View } from '../../hooks/EditorState.svelte.ts'

  // A list item: a bullet, a number counted among its siblings, or a
  // to-do's checkbox, then its text.
  let { view }: { view: View } = $props()
  const ed = useEditor()
  const checked = $derived(view.props.checked ?? false)
</script>

{#if view.kind === 'todo'}
  <blocks.Todo {checked} oncheck={(on) => ed.check(view.id, on)}>
    <Text id={view.id} placeholder="To-do" />
  </blocks.Todo>
{:else}
  <blocks.Item numbered={view.kind === 'numbered'} number={view.number} depth={view.depth}>
    <Text id={view.id} placeholder="List" />
  </blocks.Item>
{/if}
