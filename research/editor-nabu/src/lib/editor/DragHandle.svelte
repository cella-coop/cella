<script lang="ts">
  // nabu's DragHandle, scoped to one editor. Upstream finds blocks under the
  // pointer by `.nabu-editor` and looks their id up in its own engine, so
  // with two editors on a page (whose blocks share ids, being the same
  // document) both handles show and a drop in one moves the block in the
  // other. Also: a block that is not a list item, dropped beside one, lands
  // beside the outermost list instead of inside a list.
  import { wrapOrphan } from '@aionbuilders/nabu'
  import type { EditorState } from '../hooks/EditorState.svelte.ts'

  let { editor }: { editor: EditorState } = $props()
  const engine = $derived(editor.engine)

  const W = 24
  let handle = $state({ visible: false, top: 0, left: 0, id: null as string | null })
  let dragging = $state(false)
  let indicator = $state({ visible: false, top: 0, left: 0, width: 0 })
  let drop: { id: string; after: boolean } | null = null
  let dragged: string | null = null

  function at(x: number, y: number, exclude: string | null): HTMLElement | null {
    const el = document.elementFromPoint(x, y)
    const b = el?.closest?.('[data-block-id]') as HTMLElement | null
    if (!b || !editor.root?.contains(b) || b.closest('[data-nabu-ui]')) {
      return null
    }
    if (exclude && b.dataset.blockId === exclude) {
      return null
    }
    // A list is a wrapper, not something to grab: take the item under it.
    if (b.dataset.blockType === 'list') {
      return null
    }
    return b
  }

  function onmove(e: PointerEvent) {
    if (dragging) {
      handle.visible = false
      const b = at(e.clientX, e.clientY, dragged)
      if (!b) {
        indicator.visible = false
        drop = null
        return
      }
      const r = b.getBoundingClientRect()
      const after = e.clientY > r.top + r.height / 2
      drop = { id: b.dataset.blockId!, after }
      indicator = { visible: true, top: after ? r.bottom : r.top, left: r.left, width: r.width }
      return
    }
    if (document.elementFromPoint(e.clientX, e.clientY)?.closest?.('.drag')) {
      return
    }
    const b = at(e.clientX, e.clientY, null)
    if (!b) {
      handle.visible = false
      return
    }
    const r = b.getBoundingClientRect()
    handle = { visible: true, top: r.top + 2, left: r.left - W, id: b.dataset.blockId! }
  }

  function ondown(e: PointerEvent) {
    e.preventDefault()
    dragged = handle.id
    if (!dragged) {
      return
    }
    dragging = true
    try {
      ;(e.target as HTMLElement).setPointerCapture?.(e.pointerId)
    } catch {
      // Synthetic pointers have no capture; the window still gets the moves.
    }
  }

  function onup() {
    if (dragging) {
      perform()
    }
    dragging = false
    dragged = null
    indicator.visible = false
    drop = null
  }

  function perform() {
    const id = dragged
    if (!drop || !id) {
      return
    }
    const block = engine.blocks.get(id) as any
    let target = engine.blocks.get(drop.id) as any
    if (!block || !target || block === target || target.parents?.some((p: any) => p.id === block.id)) {
      return
    }
    if (block.type !== 'list-item' && target.type === 'list-item') {
      target = target.parents.findLast((p: any) => p.type === 'list') ?? target
    }
    if (drop.after) {
      block.node.moveAfter(target.node)
    } else {
      block.node.moveBefore(target.node)
    }
    wrapOrphan(engine, block)
    engine.commit().then(() => {
      const fresh = engine.blocks.get(id) as any
      if (fresh?.behaviors?.has('text')) {
        engine.selection.setCursor(fresh, 0)
      }
    })
  }
</script>

<svelte:window onpointermove={onmove} onpointerup={onup} />

{#if handle.visible && !dragging}
  <button
    class="drag"
    data-nabu-ui
    contenteditable="false"
    type="button"
    aria-label="Drag to reorder"
    style:top="{handle.top}px"
    style:left="{handle.left}px"
    onpointerdown={ondown}>⠿</button
  >
{/if}

{#if indicator.visible}
  <div class="indicator" style:top="{indicator.top}px" style:left="{indicator.left}px" style:width="{indicator.width}px"></div>
{/if}

<style>
  .drag {
    position: fixed;
    z-index: 150;
    width: 24px;
    height: 22px;
    display: flex;
    align-items: center;
    justify-content: center;
    border: none;
    background: transparent;
    cursor: grab;
    color: var(--text-subtle);
    border-radius: var(--radius-control);
    padding: 0;
  }
  .drag:hover {
    background: var(--hover);
    color: var(--text);
  }
  .indicator {
    position: fixed;
    z-index: 150;
    height: 2px;
    pointer-events: none;
    background: var(--accent-fill);
    border-radius: 2px;
  }
</style>
