<script lang="ts">
  import { Select } from '@cella/org-ui'
  import Text from '../Text.svelte'
  import { useEditor } from '../../hooks/useEditor.ts'
  import type { View } from '../../hooks/EditorState.svelte.ts'

  let { view }: { view: View } = $props()
  const ed = useEditor()
  const languages = ['text', 'toml', 'sql', 'typescript', 'rust']
</script>

<div class="code">
  <span class="language">
    <Select
      fit
      label="Language"
      options={languages.map((l) => ({ value: l, label: l }))}
      bind:value={() => view.props.language ?? 'text', (language) => ed.setKind(view.id, 'code', { language })}
    />
  </span>
  <Text id={view.id} placeholder="Code" />
</div>
