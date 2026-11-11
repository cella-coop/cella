<script lang="ts">
  import type { LoroDoc } from 'loro-crdt'
  import { Blocks, sortable, type Embeds } from '@cella/org-ui'
  import { useEditor } from '../hooks/useEditor.ts'
  import type { Anchor } from '../models/body.ts'
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
  // A comment posted refreshes the page's anchors; its quote is
  // highlighted then, not at the next reload.
  const highlight = () => {
    const a = anchors
    queueMicrotask(() => ed.highlight(a))
  }

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

  // Events from inside a field of the editor's chrome, the link's address,
  // are the field's.
  const ours = (e: Event) => !(e.target as HTMLElement).closest('input, textarea, select, [popover]')

  // Chosen blocks mirror themselves in the page's selection, which
  // Chromium may settle outside the editor, before it: their copy and cut
  // are fired there, and heard here while the selection still mirrors
  // them; text selected elsewhere on the page copies as itself.
  const outside = (e: ClipboardEvent, cut: boolean) => {
    const t = e.target
    if (ed.chosen.mirrored() && ed.root && !(t instanceof Node && ed.root.contains(t)) && !(t instanceof Element && t.closest('input, textarea, select, [contenteditable]'))) {
      ed.clip.copy(e, cut)
    }
  }

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

<svelte:document
  onselectionchange={() => ed.selectionChanged()}
  onpointerdown={(e: PointerEvent) => ed.chosen.away(e)}
  onpointerup={() => ed.chosen.pointerup()}
  oncopy={(e: ClipboardEvent) => outside(e, false)}
  oncut={(e: ClipboardEvent) => outside(e, true)}
/>

<Blocks
  tabindex={-1}
  role="document"
  aria-label="{name}, editing"
  data-editor
  data-chosen={ed.chosen.range ? '' : undefined}
  {@attach attach}
  {@attach drag}
  {@attach highlight}
  onbeforeinput={(e: InputEvent) => ours(e) && ed.input.beforeinput(e)}
  onkeydown={(e: KeyboardEvent) => ours(e) && (ed.chosen.range ? ed.chosen.key(e) : ed.input.key(e))}
  oncompositionstart={() => ed.input.compositionstart()}
  oncompositionend={(e: CompositionEvent) => ed.input.compositionend(e)}
  oncopy={(e: ClipboardEvent) => ours(e) && ed.clip.copy(e, false)}
  oncut={(e: ClipboardEvent) => ours(e) && ed.clip.copy(e, true)}
  onpaste={(e: ClipboardEvent) => ours(e) && ed.clip.paste(e)}
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
