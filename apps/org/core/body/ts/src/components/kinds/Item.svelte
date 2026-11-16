<script lang="ts">
  import { Checkbox } from '@cella/org-ui'
  import Text from '../Text.svelte'
  import { useEditor } from '../../hooks/useEditor.ts'
  import type { View } from '../../hooks/EditorState.svelte.ts'

  // A list item: a bullet, a number counted among its siblings, or a
  // to-do's checkbox, then its text.
  let { view }: { view: View } = $props()
  const ed = useEditor()
  const checked = $derived(view.props.checked ?? false)
  const bullet = $derived(['•', '◦', '▪'][view.depth % 3])
</script>

<div class="item" data-done={(view.kind === 'todo' && checked) || undefined}>
  {#if view.kind === 'todo'}
    <Checkbox label="Done" bind:checked={() => checked, (on) => ed.check(view.id, on)} />
  {:else if view.kind === 'numbered'}
    <span class="marker" data-numbered aria-hidden="true">{view.number}.</span>
  {:else}
    <span class="marker" aria-hidden="true">{bullet}</span>
  {/if}
  <Text id={view.id} placeholder={view.kind === 'todo' ? 'To-do' : 'List'} />
</div>
