<script lang="ts">
  import { untrack } from 'svelte'
  import { useEditor } from '../hooks/useEditor.ts'
  import type { TreeID } from '../models/blocks.ts'

  // A block's text. What is inside is the editor's, painted from Loro;
  // Svelte draws only the element. Mounting may place the caret, which
  // reads the slash menu's state; untracked, so that the menu opening
  // never mounts the block again.
  let { id, placeholder = 'Type / for blocks' }: { id: TreeID; placeholder?: string } = $props()
  const ed = useEditor()
  const mount = (el: HTMLElement) => untrack(() => ed.mount(id, el))
</script>

<div
  class="text"
  contenteditable="true"
  spellcheck="true"
  role="textbox"
  aria-multiline="true"
  aria-label={placeholder}
  tabindex="0"
  data-block={id}
  data-placeholder={placeholder}
  {@attach mount}
></div>
