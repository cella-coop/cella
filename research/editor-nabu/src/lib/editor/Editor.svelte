<script lang="ts">
  import { NabuEditor, SlashMenu } from '@aionbuilders/nabu'
  import type { EditorState } from '../hooks/EditorState.svelte.ts'
  import { usePair } from '../hooks/usePair.ts'
  import DragHandle from './DragHandle.svelte'
  import Toolbar from './Toolbar.svelte'
  import { commands } from './engine.ts'

  let { editor }: { editor: EditorState } = $props()
  const pair = usePair()
</script>

<div
  class="editor"
  data-side={editor.name}
  bind:this={editor.root}
  oncompositionstart={() => (editor.composing = true)}
  oncompositionend={() => {
    editor.composing = false
    queueMicrotask(() => pair.release(editor))
  }}
>
  <NabuEditor engine={editor.engine as any} />
</div>
<DragHandle {editor} />
<SlashMenu engine={editor.engine as any} commands={commands as any} />
<Toolbar {editor} />

<style>
  .editor {
    font-family: var(--font-display);
    font-size: var(--text-lg);
    line-height: 1.55;
    color: var(--text);
  }
  .editor :global(.nabu-editor) {
    padding: var(--space-4) var(--space-5);
    min-height: 24rem;
  }
  .editor :global(.nabu-heading) {
    font-family: var(--font-display);
    font-weight: 500;
    line-height: 1.2;
  }
  .editor :global(h1.nabu-heading) {
    font-size: var(--text-2xl);
  }
  .editor :global(h2.nabu-heading) {
    font-size: var(--text-xl);
    margin-top: var(--space-4);
  }
  .editor :global(.nabu-blockquote) {
    border-left: 3px solid var(--line);
    padding-left: var(--space-3);
    color: var(--text-muted);
    font-style: italic;
  }
  .editor :global(.nabu-code) {
    font-family: var(--font-mono);
    font-size: var(--text-sm);
  }
  .editor :global(.nabu-link) {
    color: var(--accent-text);
  }
</style>
