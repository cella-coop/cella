<script lang="ts">
  import type { Component } from 'svelte'
  import Plus from 'phosphor-svelte/lib/Plus'
  import type { Column } from '../models/view.ts'
  import { shift, type Shift } from '../models/query.ts'
  import { transfer } from '../attachments/transfer.ts'
  import { mirror } from '../attachments/mirror.ts'
  import { useDrag } from '../hooks/useDrag.ts'
  import Icon from './Icon.svelte'
  import Value from './Value.svelte'
  import Group from './Group.svelte'
  import Tile from './Tile.svelte'

  // The one board, as Linear's: a column per value of the enumeration,
  // the person or the circle it groups by, in the declared order, its
  // header in one row across the top, pinned there as the page scrolls
  // down and moving across with the columns, each with its count over the
  // whole board and, where the collection offers New, a + that creates.
  // A card drags only into a column the collection's moves make a write,
  // which `onshift` runs; every other column takes no drop. Where the
  // view also groups by a field of its own, `swimlane`, the rows split
  // first into a lane per its value: a thin bar across every column
  // (`Group.svelte`, the same as a list's), collapsible, its cards under
  // it in the columns the header names, an empty one a bare band; none
  // splits them into one. A value's tone is read from a row holding it
  // anywhere on the board, else from one holding it alone, so a column's
  // or a lane's chip wears the same tone with cards or without.
  let {
    rows,
    by,
    lanes,
    titled,
    shown,
    href,
    shifts,
    onshift,
    oncreate,
    swimlane,
    swimlanes = [],
    collapsed,
    oncollapse,
    mark,
  }: {
    rows: any[]
    by: Column
    lanes: string[]
    titled: Column
    shown: Column[]
    href?: (row: any) => string | undefined
    shifts: Shift[]
    onshift: (id: string, move: Shift, from: string, to: string) => void
    oncreate?: (value: string) => void
    swimlane?: Column
    swimlanes?: string[]
    collapsed?: Set<string>
    oncollapse?: (value: string) => void
    // A card's own icon, before its title; none draws none.
    mark?: (row: any) => Component<any> | undefined
  } = $props()

  const drag = useDrag()
  const lane = (row: any) => String(by.value(row) ?? '—')
  const takes = (from: string, to: string) => !!shift(shifts, by.key, from, to)
  const label = (id: string) => String(titled.value(rows.find((r) => r.id === id)) ?? id)
  const laid = (row: any) => String(swimlane?.value(row) ?? '')
  const sample = (c: Column, v: string, none: string) => rows.find((r) => String(c.value(r) ?? none) === v) ?? { [c.key]: v }
</script>

<!-- The columns of one lane, or of the whole board where it has no
     swimlanes: a card drags only within the group it opens in. -->
{#snippet columns(of: any[], group: string)}
  <div
    class="columns"
    {@attach transfer(drag, {
      group,
      lists: () => lanes,
      takes: (_, from, to) => takes(from, to),
      label,
      ondrop: (id, from, to) => {
        const move = shift(shifts, by.key, from, to)
        if (move) {
          onshift(id, move, from, to)
        }
      },
    })}
  >
    {#each lanes as l (l)}
      {const cards = $derived(of.filter((r) => lane(r) === l))}
      {const open = $derived(!!drag.carry.group && drag.carry.group === group && takes(drag.carry.origin, l))}
      <section class="lane" class:open class:aimed={drag.aimed(group, l)} data-drop-list={l} aria-label="{by.label}: {l}, {cards.length}">
        {#each cards as row (row.id)}
          <Tile {row} {titled} {shown} href={href?.(row)} {group} from={l} dragging={drag.carrying(group, row.id)} icon={mark?.(row)} />
        {/each}
      </section>
    {/each}
  </div>
{/snippet}

<div class="board" style:--n={lanes.length} {@attach mirror}>
  <div class="head" data-mirror>
    <div class="row">
      {#each lanes as l (l)}
        <h3>
          <Value value={l} kind={by.kind} tone={by.tone?.(sample(by, l, '—'))} states={by.states} record={by.record} size="card" />
          <span class="count">{rows.filter((r) => lane(r) === l).length}</span>
          {#if oncreate}
            <button type="button" class="create" onclick={() => oncreate(l)} title="Create in {l}" aria-label="Create in {l}">
              <Icon icon={Plus} size="0.8rem" />
            </button>
          {/if}
        </h3>
      {/each}
    </div>
  </div>
  <div class="body" data-mirror>
    <div class="row">
      {#if swimlane}
        {#each swimlanes as s (s)}
          {const of = $derived(rows.filter((r) => laid(r) === s))}
          <section class="swimlane" role="group" aria-label="{swimlane.label}: {s === '' ? 'None' : s}, {of.length}">
            <div class="lanebar">
              <Group by={swimlane} row={sample(swimlane, s, '')} value={s} count={of.length} collapsed={collapsed?.has(s) ?? false} oncollapse={oncollapse && (() => oncollapse(s))} />
            </div>
            {#if !collapsed?.has(s)}
              {@render columns(of, `board-${s}`)}
            {/if}
          </section>
        {/each}
      {:else}
        {@render columns(rows, 'board')}
      {/if}
    </div>
  </div>
</div>

<style>
  /* The header's row and every lane's lay their columns on one width, at
     least a column's least each, filling the board where it is wider, so
     a column's header stands exactly over its cards in every lane. */
  .board {
    --least: 18rem;
    --gutter: var(--space-2);
    display: grid;
    grid-template-columns: minmax(0, 1fr);
  }
  .row {
    min-width: calc(var(--n) * var(--least) + (var(--n) - 1) * var(--gutter));
  }
  /* Pinned to the top of the page's scroller, the content's, which no
     clipping box stands between, flush with its edge past its padding,
     which the pinning leaves out; it scrolls across only as the columns
     do (`mirror`), its own bar hidden. */
  .head {
    position: sticky;
    top: calc(-1 * var(--space-4));
    z-index: 2;
    margin-top: calc(-1 * var(--space-2));
    padding-top: var(--space-2);
    overflow-x: auto;
    scrollbar-width: none;
    background: var(--panel);
  }
  .head::-webkit-scrollbar {
    display: none;
  }
  .head .row,
  .columns {
    display: grid;
    grid-template-columns: repeat(var(--n), minmax(0, 1fr));
    gap: var(--gutter);
  }
  .body {
    overflow-x: auto;
    container-type: inline-size;
  }
  .body .row {
    display: grid;
    gap: var(--space-3);
    padding-top: var(--space-2);
  }
  /* A lane's bar is as wide as the board shows and stays in view as the
     columns scroll across under it. */
  .lanebar {
    position: sticky;
    left: 0;
    width: 100cqi;
  }
  .swimlane {
    display: grid;
    gap: var(--space-2);
  }
  h3 {
    display: flex;
    gap: var(--space-2);
    align-items: center;
    min-height: 2rem;
    padding: 0 var(--space-2) var(--space-1);
    font-family: var(--font-ui);
    font-size: var(--text-sm);
    font-weight: 500;
  }
  .count {
    color: var(--text-muted);
    font-weight: 400;
  }
  .create {
    display: grid;
    place-items: center;
    margin-left: auto;
    width: 1.5rem;
    height: 1.5rem;
    padding: 0;
    border: none;
    border-radius: var(--radius-control);
    background: none;
    color: var(--text-muted);
    cursor: pointer;
  }
  .create:hover {
    background: var(--hover);
    color: var(--text);
  }
  /* A column is a faint band off the panel, a few percent of the text's
     own colour mixed into it, so it reads alike in light and dark, and a
     surface of its own for what sits in it; the gutters between are
     narrow, and a lane's column with no card is the band alone. */
  .lane {
    display: grid;
    gap: var(--space-2);
    align-content: start;
    grid-template-columns: minmax(0, 1fr);
    min-height: 2.5rem;
    padding: var(--space-2);
    --surface: color-mix(in oklab, var(--text) 1.5%, var(--panel));
    background: var(--surface);
    border-radius: var(--radius-panel);
    outline: 2px dashed transparent;
    outline-offset: -2px;
    transition: outline-color var(--fast) var(--ease);
  }
  .lane.open {
    outline-color: var(--line);
  }
  .lane.aimed {
    outline: 2px solid var(--accent-border);
  }
</style>
