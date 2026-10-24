<script lang="ts">
  import { useEditor } from '../../hooks/useEditor.ts'
  import type { View } from '../../hooks/EditorState.svelte.ts'

  // A thing of another slice, drawn by the slice that knows its kind; the
  // document holds only its kind and ref.
  let { view }: { view: View } = $props()
  const ed = useEditor()
  const found = $derived(ed.embeds()[view.props.embed ?? ''])
</script>

<div class="embed" data-atomic={view.id} contenteditable="false">
  {#if found}
    <found.embed.block ref={view.props.ref ?? ''} data={found.data} />
  {:else}
    <div class="unknown">{view.props.embed} {view.props.ref}</div>
  {/if}
</div>
