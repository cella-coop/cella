<script lang="ts">
  import type { Snippet } from 'svelte'
  import type { Column } from '../models/view.ts'
  import { sortable } from '../attachments/sortable.ts'
  import { useDrag } from '../hooks/useDrag.ts'
  import { useSection } from '../hooks/useSection.ts'
  import Cell from './Cell.svelte'
  import DragHandle from './DragHandle.svelte'
  import DropIndicator from './DropIndicator.svelte'
  import Icon from './Icon.svelte'
  import X from 'phosphor-svelte/lib/X'

  // An ordered list a slice's writes reorder, as an agenda: each row its
  // number, its grip and its columns, the first its title, what the slice
  // puts at its end, and a quiet removal when the slice offers one. A drop
  // calls `onmove` with the row's index before and after, a removal
  // `onremove` with the row; `fixed` drops the grips and the removals once
  // the list may no longer change. With no rows, one quiet line, as a
  // table says it.
  let {
    name,
    rows,
    columns,
    onmove,
    onremove,
    fixed = false,
    end,
  }: {
    // The list's name, which the page's drag tells apart.
    name: string
    rows: any[]
    columns: Column[]
    onmove: (from: number, to: number) => void
    onremove?: (row: any) => void
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
          <span class="cell" class:first={j === 0}><Cell value={c.value(row)} kind={c.kind} tone={c.tone?.(row)} states={c.states} record={c.record} /></span>
        {/each}
        {#if end}<span class="end">{@render end(row)}</span>{/if}
        {#if onremove && !fixed}
          <button type="button" class="remove" aria-label="Remove {label(i)}" title="Remove {label(i)}" onclick={() => onremove(row)}>
            <Icon icon={X} />
          </button>
        {/if}
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
  /* A removal, quiet until its row is hovered or it is focused. */
  .remove {
    display: grid;
    place-items: center;
    width: 1.6rem;
    height: 1.6rem;
    padding: 0;
    border: none;
    border-radius: var(--radius-control);
    background: none;
    color: var(--text-subtle);
    opacity: 0;
    cursor: pointer;
  }
  li:hover .remove,
  .remove:focus-visible {
    opacity: 1;
  }
  .remove:hover {
    background: var(--hover);
    color: var(--negative-text);
  }
</style>
