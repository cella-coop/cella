<script lang="ts">
  import type { Snippet } from 'svelte'
  import type { Column } from '../models/view.ts'
  import { sortable } from '../attachments/sortable.ts'
  import { useDrag } from '../hooks/useDrag.ts'
  import { useSection } from '../hooks/useSection.ts'
  import Cell from './Cell.svelte'
  import DragHandle from './DragHandle.svelte'
  import DropIndicator from './DropIndicator.svelte'

  // An ordered list a slice's writes reorder, as an agenda: each row its
  // number, its grip and its columns, the first its title, and what the
  // slice puts at its end, such as a removal. A drop calls `onmove` with
  // the row's index before and after; `fixed` drops the grips once the
  // order may no longer change. With no rows, one quiet line, as a table
  // says it.
  let {
    name,
    rows,
    columns,
    onmove,
    fixed = false,
    end,
  }: {
    // The list's name, which the page's drag tells apart.
    name: string
    rows: any[]
    columns: Column[]
    onmove: (from: number, to: number) => void
    fixed?: boolean
    end?: Snippet<[any]>
  } = $props()

  const drag = useDrag()
  const section = useSection()
  const label = (i: number) => String(columns[0]?.value(rows[i]) ?? 'item')
</script>

{#if rows.length === 0}
  <p class="empty">{section ? `No ${section().toLowerCase()}` : 'Nothing here yet.'}</p>
{:else}
  <ol class="ordered" {@attach sortable(drag, { list: name, label, onmove })}>
    {#each rows as row, i (row.id)}
      <DropIndicator show={drag.before(name, i)} />
      <li data-drag-item={name} data-drag-index={i} class:lifted={drag.lifted && drag.dragging(name, i)}>
        {#if !fixed}<DragHandle label={label(i)} />{/if}
        <span class="n">{i + 1}</span>
        {#each columns as c, j (c.key)}
          <span class="cell" class:first={j === 0}><Cell value={c.value(row)} kind={c.kind} tone={c.tone?.(row)} /></span>
        {/each}
        {#if end}<span class="end">{@render end(row)}</span>{/if}
      </li>
    {/each}
    <DropIndicator show={drag.before(name, rows.length)} />
  </ol>
{/if}

<style>
  .empty {
    font-size: var(--text-sm);
    color: var(--text-muted);
    padding-inline: var(--space-3);
  }
  .ordered {
    list-style: none;
    margin: 0;
    padding: 0;
    display: grid;
    gap: 2px;
  }
  li {
    display: flex;
    align-items: center;
    gap: var(--space-3);
    min-height: var(--row);
    padding: 0 var(--space-2);
    border-radius: var(--radius-control);
    font-size: var(--text-sm);
  }
  li:hover {
    background: var(--hover);
  }
  li.lifted {
    opacity: 0.4;
  }
  .n {
    min-width: 1.25rem;
    color: var(--text-subtle);
    font-variant-numeric: tabular-nums;
    text-align: end;
  }
  .cell {
    display: flex;
    min-width: 0;
    color: var(--text-muted);
  }
  .cell.first {
    flex: 1 1 auto;
    color: var(--text);
    font-weight: 500;
  }
  .end {
    display: flex;
    gap: var(--space-1);
  }
</style>
