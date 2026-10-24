<script lang="ts">
  import { useEditor } from '../hooks/useEditor.ts'
  import type { TreeID } from '../model/doc.ts'

  let { id, kind = 'p', placeholder = "Type '/' for commands" }: { id: TreeID; kind?: string; placeholder?: string } = $props()
  const ed = useEditor()

  // The text inside is the editor's, painted from Loro; Svelte draws only
  // the element.
  const mount = (el: HTMLElement) => ed.mount(id, el)
</script>

<div
  class="editable {kind}"
  contenteditable="true"
  spellcheck="true"
  role="textbox"
  aria-multiline="true"
  tabindex="0"
  data-block={id}
  data-placeholder={placeholder}
  {@attach mount}
></div>

<style>
  .editable {
    outline: none;
    white-space: pre-wrap;
    overflow-wrap: anywhere;
    min-height: 1.45em;
    padding: 2px 0;
    caret-color: var(--accent-border);
    flex: 1;
    min-width: 0;
  }

  .editable:global([data-empty]):focus::before {
    content: attr(data-placeholder);
    color: var(--text-subtle);
    position: absolute;
    pointer-events: none;
  }

  .editable :global(strong) {
    font-weight: 700;
  }

  .editable :global(code) {
    font-family: var(--font-mono);
    font-size: 0.85em;
    background: var(--sunk);
    border-radius: 4px;
    padding: 0.1em 0.25em;
    color: var(--negative-text);
  }

  .editable :global(a) {
    color: var(--accent-text);
    text-decoration: underline;
    text-decoration-color: var(--accent-border);
    text-underline-offset: 2px;
  }
</style>
