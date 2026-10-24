<script lang="ts">
  import type { LoroDoc } from 'loro-crdt'
  import { useEditor } from '../hooks/useEditor.ts'
  import type { EditorState } from '../hooks/EditorState.svelte.ts'
  import Block from './Block.svelte'
  import Slash from './Slash.svelte'
  import Toolbar from './Toolbar.svelte'

  let { doc, name, onready }: { doc: LoroDoc; name: string; onready?: (ed: EditorState) => void } = $props()
  const ed = useEditor(() => doc)

  const root = (el: HTMLElement) => {
    ed.root = el
    onready?.(ed)
    return () => {
      ed.root = null
      ed.destroy()
    }
  }
</script>

<svelte:document onselectionchange={() => ed.selectionChanged()} onpointerup={() => ed.pointerup()} />

<!-- The editor is a composite widget: its blocks are the textboxes, and
     the keys it handles here are for blocks selected whole. -->
<!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
<div
  class="editor"
  class:blocks={ed.range !== null}
  tabindex="-1"
  role="document"
  aria-label="{name} editor"
  {@attach root}
  onbeforeinput={(e) => ed.beforeinput(e)}
  onkeydown={(e) => (ed.range ? ed.blockKey(e) : ed.editKey(e))}
  oncompositionstart={() => ed.compositionstart()}
  oncompositionend={(e) => ed.compositionend(e)}
  oncopy={(e) => ed.copy(e, false)}
  oncut={(e) => ed.copy(e, true)}
  onpaste={(e) => ed.paste(e)}
  onpointerdown={(e) => ed.pointerdown(e)}
  onpointermove={(e) => ed.pointermove(e)}
  ondragover={(e) => ed.dragover(e)}
  ondrop={(e) => ed.drop(e)}
>
  {#each ed.rows as view (view.id)}
    <Block {view} />
  {/each}
  {#if ed.slash}
    <Slash />
  {/if}
  {#if ed.bar && !ed.range}
    <Toolbar />
  {/if}
</div>

<style>
  .editor {
    outline: none;
    padding: var(--space-2) var(--space-2) var(--space-6) var(--space-5);
    min-height: 12rem;
  }

  .blocks {
    caret-color: transparent;
  }
</style>
