<script lang="ts">
  import type { Snippet } from 'svelte'
  import { sortable } from '../attachments/sortable.ts'
  import { useDrag } from '../hooks/useDrag.ts'
  import Button from './Button.svelte'
  import DragHandle from './DragHandle.svelte'
  import DropIndicator from './DropIndicator.svelte'
  import Icon from './Icon.svelte'
  import Plus from 'phosphor-svelte/lib/Plus'
  import X from 'phosphor-svelte/lib/X'

  // A list of rows a form adds to and removes from, as an invoice's
  // lines or a motion's choices: each row its own fields, the caller's,
  // this component naming only its grip, dragged to reorder as
  // `Ordered`'s rows are, its removal and, at its foot, Add. With no
  // rows, one quiet line naming what is added; its state is a
  // `RepeatState`, which `add`, `remove` and `move` call.
  let {
    name,
    rows,
    label,
    empty = 'Nothing added yet.',
    add = 'Add',
    onadd,
    onremove,
    onmove,
    row,
  }: {
    // The list's name, which the page's drag tells its rows apart by.
    name: string
    rows: unknown[]
    // A row's name, for its grip and its removal.
    label: (i: number) => string
    empty?: string
    add?: string
    onadd: () => void
    onremove: (i: number) => void
    onmove: (from: number, to: number) => void
    row: Snippet<[unknown, number]>
  } = $props()

  const drag = useDrag()
</script>

<div class="repeat">
  {#if rows.length === 0}
    <p class="empty">{empty}</p>
  {:else}
    <ul class="rows" {@attach sortable(drag, { list: name, label, onmove })}>
      <DropIndicator show={drag.before(name, 0)} />
      {#each rows as r, i (i)}
        <li class="row" data-drag-item={name} data-drag-index={i} class:lifted={drag.lifted && drag.dragging(name, i)}>
          <DragHandle label={label(i)} />
          <div class="fields">{@render row(r, i)}</div>
          <button type="button" class="remove" aria-label="Remove {label(i)}" title="Remove {label(i)}" onclick={() => onremove(i)}>
            <Icon icon={X} />
          </button>
        </li>
        <DropIndicator show={drag.before(name, i + 1)} />
      {/each}
    </ul>
  {/if}
  <Button tone="quiet" lead={Plus} onclick={onadd}>{add}</Button>
</div>

<style>
  .repeat {
    display: grid;
    gap: var(--space-2);
  }
  .empty {
    font-size: var(--text-sm);
    color: var(--text-muted);
  }
  .rows {
    list-style: none;
    margin: 0;
    padding: 0;
    display: grid;
    gap: 2px;
  }
  .row {
    display: flex;
    align-items: flex-start;
    gap: var(--space-2);
    padding: var(--space-1) var(--space-2);
    border-radius: var(--radius-control);
  }
  .row:hover {
    background: var(--hover);
  }
  .row.lifted {
    opacity: 0.4;
  }
  .fields {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-wrap: wrap;
    gap: var(--space-2);
  }
  .remove {
    display: grid;
    place-items: center;
    width: 1.6rem;
    height: 1.6rem;
    margin-top: 0.1rem;
    padding: 0;
    border: none;
    border-radius: var(--radius-control);
    background: none;
    color: var(--text-subtle);
    opacity: 0;
    cursor: pointer;
  }
  .row:hover .remove,
  .remove:focus-visible {
    opacity: 1;
  }
  .remove:hover {
    background: var(--hover);
    color: var(--negative-text);
  }
</style>
