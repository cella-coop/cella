<script lang="ts">
  import Editable from '../Editable.svelte'
  import { useEditor } from '../../hooks/useEditor.ts'
  import type { View } from '../../hooks/EditorState.svelte.ts'

  let { view }: { view: View } = $props()
  const ed = useEditor()
  const languages = ['text', 'toml', 'sql', 'typescript', 'rust']
</script>

<div class="code">
  <select aria-label="Language" value={view.props.language ?? 'text'} onchange={(e) => ed.setKind(view.id, 'code', { language: e.currentTarget.value })}>
    {#each languages as l (l)}
      <option value={l}>{l}</option>
    {/each}
  </select>
  <Editable id={view.id} kind="mono" placeholder="Code" />
</div>

<style>
  .code {
    background: var(--sunk);
    border-radius: var(--radius-control);
    padding: var(--space-3);
    font-family: var(--font-mono);
    font-size: var(--text-sm);
    display: flex;
    flex-direction: column;
    gap: var(--space-1);
  }

  select {
    align-self: flex-start;
    font: inherit;
    font-size: var(--text-xs);
    color: var(--text-muted);
    background: transparent;
    border: none;
  }
</style>
