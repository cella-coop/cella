<script lang="ts">
  import { useEditor } from '../hooks/useEditor.ts'
  import type { View } from '../hooks/EditorState.svelte.ts'
  import { atomic } from '../model/doc.ts'
  import { blocks } from './blocks/index.ts'

  let { view }: { view: View } = $props()
  const ed = useEditor()
  const Body = $derived(blocks[view.kind])
  const selected = $derived(ed.selected.has(view.id))
  const drop = $derived(ed.dropAt?.id === view.id ? ed.dropAt.place : null)
</script>

<div
  class="row"
  class:selected
  data-row={view.id}
  data-kind={view.kind}
  data-drop={drop}
  style:--depth={view.depth}
  role="presentation"
  onclick={(e) => {
    if (atomic.has(view.kind) && !(e.target as HTMLElement).closest('[data-handle]')) {
      ed.select(view.id)
    }
  }}
>
  <button
    class="handle"
    data-handle
    draggable="true"
    aria-label="Drag to move, click to select"
    tabindex="-1"
    ondragstart={(e) => ed.dragstart(e, view.id)}
    ondragend={() => ed.dragend()}
    onclick={() => ed.select(view.id)}
  >
    <svg viewBox="0 0 10 16" width="10" height="16" aria-hidden="true">
      {#each [3, 8, 13] as y (y)}
        <circle cx="2.5" cy={y} r="1.3" />
        <circle cx="7.5" cy={y} r="1.3" />
      {/each}
    </svg>
  </button>
  <div class="content" data-content>
    <Body {view} />
  </div>
</div>

<style>
  .row {
    position: relative;
    display: flex;
    align-items: flex-start;
    padding-left: calc(var(--depth) * 1.6rem);
    border-radius: var(--radius-control);
    margin: 1px 0;
  }

  .content {
    flex: 1;
    min-width: 0;
    padding: 1px var(--space-1);
  }

  .selected .content {
    background: var(--accent-soft);
    border-radius: var(--radius-control);
  }

  .handle {
    opacity: 0;
    border: none;
    background: none;
    padding: 4px 2px;
    margin-left: -18px;
    width: 18px;
    cursor: grab;
    fill: var(--text-subtle);
    border-radius: 4px;
    transition: opacity var(--fast) var(--ease);
  }

  .row:hover > .handle,
  .selected > .handle {
    opacity: 1;
  }

  .handle:hover {
    background: var(--hover);
  }

  [data-drop]::after {
    content: '';
    position: absolute;
    right: 0;
    height: 2px;
    background: var(--accent-border);
    border-radius: 1px;
    left: calc(var(--depth) * 1.6rem);
  }

  [data-drop='before']::after {
    top: -2px;
  }

  [data-drop='after']::after {
    bottom: -2px;
  }

  [data-drop='into']::after {
    bottom: -2px;
    left: calc((var(--depth) + 1) * 1.6rem);
  }
</style>
