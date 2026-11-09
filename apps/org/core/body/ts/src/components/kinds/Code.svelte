<script lang="ts">
  import Text from '../Text.svelte'
  import { useEditor } from '../../hooks/useEditor.ts'
  import type { View } from '../../hooks/EditorState.svelte.ts'

  let { view }: { view: View } = $props()
  const ed = useEditor()
  const languages = ['text', 'toml', 'sql', 'typescript', 'rust']
</script>

<div class="code">
  <select class="language" aria-label="Language" value={view.props.language ?? 'text'} onchange={(e) => ed.setKind(view.id, 'code', { language: e.currentTarget.value })}>
    {#each languages as l (l)}
      <option value={l}>{l}</option>
    {/each}
  </select>
  <Text id={view.id} placeholder="Code" />
</div>
