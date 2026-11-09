<script lang="ts">
  import { DragHandle } from '@cella/org-ui'
  import { useEditor } from '../hooks/useEditor.ts'
  import { atomic, type TreeID } from '../models/blocks.ts'
  import { bodies } from './kinds/index.ts'
  import Block from './Block.svelte'

  // A block and the blocks nested under it. Its line is what a drag
  // carries and where a drop lands: the grip and the body; the grip also
  // chooses the block whole.
  let { id }: { id: TreeID } = $props()
  const ed = useEditor()
  const view = $derived(ed.views.get(id))
  const index = $derived(view ? ed.rows.indexOf(view) : -1)
  const Body = $derived(view ? bodies[view.kind] : undefined)
  const last = $derived(index === ed.rows.length - 1)
  const drop = $derived(ed.drag.before('blocks', index) ? 'before' : last && ed.drag.before('blocks', ed.rows.length) ? 'after' : undefined)
  const label = $derived(view ? (atomic.has(view.kind) ? view.kind : `${view.kind} ${index + 1}`) : '')
</script>

{#if view && Body}
  <div class="block" data-row={id} data-kind={view.kind} data-last={last || undefined} data-selected={ed.chosen.selected.has(id) || undefined}>
    <div class="line" data-drag-item="blocks" data-drag-index={index} data-drop={drop} data-dragging={ed.drag.dragging('blocks', index) || undefined}>
      <DragHandle {label} />
      <div class="body" data-content>
        <Body {view} />
      </div>
    </div>
    {#if view.children.length}
      <div class="children">
        {#each view.children as child (child)}
          <Block id={child} />
        {/each}
      </div>
    {/if}
  </div>
{/if}
