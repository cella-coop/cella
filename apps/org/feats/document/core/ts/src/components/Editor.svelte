<script lang="ts">
  import type { LoroDoc } from 'loro-crdt'
  import { Blocks, sortable, type Embeds } from '@cella/org-ui'
  import { useEditor } from '../hooks/useEditor.ts'
  import type { Anchor } from '../models/document.ts'
  import type { TreeID } from '../models/blocks.ts'
  import { atomic } from '../models/blocks.ts'
  import Block from './Block.svelte'
  import Slash from './Slash.svelte'
  import Toolbar from './Toolbar.svelte'

  // The block editor over one Loro document: a composite widget, whose
  // blocks are its textboxes; the keys it handles itself are for blocks
  // chosen whole. Blocks reorder by their grips, with the UI core's
  // sortable, by pointer or by keyboard.
  let { doc, name, anchors = [], embeds = {} }: { doc: LoroDoc; name: string; anchors?: Anchor[]; embeds?: Embeds } = $props()
  const ed = useEditor(() => ({ doc, anchors, embeds: () => embeds }))

  const attach = (el: HTMLElement) => {
    // Tests and tools reach the editor from its element, as other editors
    // let them; nothing in the app does.
    Object.defineProperty(el, 'cellaEditor', { value: ed, configurable: true })
    return ed.attach(el)
  }
  const drag = sortable(ed.drag, {
    list: 'blocks',
    label: (i) => `block ${i + 1}`,
    onmove: (from, to) => ed.dropAt(from, to),
  })

  // A press on a grip, or on a block without text, chooses it whole.
  function onclick(e: MouseEvent) {
    const t = e.target as HTMLElement
    const row = t.closest<HTMLElement>('[data-row]')?.dataset.row as TreeID | undefined
    if (!row) {
      return
    }
    const view = ed.views.get(row)
    if (t.closest('[data-drag-handle]') || (view && atomic.has(view.kind) && t.closest('[data-atomic]'))) {
      ed.chosen.select(row)
    }
  }
</script>

<svelte:document onselectionchange={() => ed.selectionChanged()} onpointerup={() => ed.chosen.pointerup()} />

<Blocks
  tabindex={-1}
  role="document"
  aria-label="{name}, editing"
  data-editor
  data-chosen={ed.chosen.range ? '' : undefined}
  {@attach attach}
  {@attach drag}
  onbeforeinput={(e: InputEvent) => ed.input.beforeinput(e)}
  onkeydown={(e: KeyboardEvent) => (ed.chosen.range ? ed.chosen.key(e) : ed.input.key(e))}
  oncompositionstart={() => ed.input.compositionstart()}
  oncompositionend={(e: CompositionEvent) => ed.input.compositionend(e)}
  oncopy={(e: ClipboardEvent) => ed.clip.copy(e, false)}
  oncut={(e: ClipboardEvent) => ed.clip.copy(e, true)}
  onpaste={(e: ClipboardEvent) => ed.clip.paste(e)}
  onpointerdown={(e: PointerEvent) => ed.chosen.pointerdown(e)}
  onpointermove={(e: PointerEvent) => ed.chosen.pointermove(e)}
  {onclick}
>
  {#each ed.roots as id (id)}
    <Block {id} />
  {/each}
  <Slash />
  <Toolbar />
</Blocks>
