<script lang="ts">
  import type { Component } from 'svelte'
  import type { Column } from '../models/view.ts'
  import { shift, type Shift } from '../models/query.ts'
  import { transfer } from '../attachments/transfer.ts'
  import { useDrag } from '../hooks/useDrag.ts'
  import Cell from './Cell.svelte'
  import Group from './Group.svelte'
  import Tile from './Tile.svelte'

  // The one board: a column per value of the enumeration, the person or
  // the circle it groups by, a person's under their chip and a circle's
  // under its name, in the declared order, each with its count and its
  // cards. A card drags only into a column the collection's moves make a
  // write, which `onshift` runs; every other column takes no drop. Where
  // the view also groups by a field of its own, `swimlane`, the rows
  // split first into a lane per its value, each a group bar
  // (`Group.svelte`, the same as a list's), collapsible, holding the
  // whole set of columns again; none splits them into one.
  let {
    rows,
    by,
    lanes,
    titled,
    shown,
    href,
    shifts,
    onshift,
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
</script>

<!-- The columns of one lane, or of the whole board where it has no
     swimlanes: a card drags only within the group it opens in. -->
{#snippet columns(of: any[], group: string)}
  <div
    class="board"
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
        <h3>
          {#if by.kind === 'person' || by.kind === 'circle'}<Cell value={l} kind={by.kind} />{:else}<span>{l}</span>{/if}
          <span class="count">{cards.length}</span>
        </h3>
        <div class="cards">
          {#each cards as row (row.id)}
            <Tile {row} {titled} {shown} href={href?.(row)} {group} from={l} dragging={drag.carrying(group, row.id)} icon={mark?.(row)} />
          {/each}
        </div>
      </section>
    {/each}
  </div>
{/snippet}

{#if swimlane}
  <div class="swimlanes">
    {#each swimlanes as s (s)}
      {const of = $derived(rows.filter((r) => laid(r) === s))}
      <section class="swimlane">
        <Group by={swimlane} row={of[0] ?? {}} value={s} count={of.length} collapsed={collapsed?.has(s) ?? false} oncollapse={oncollapse && (() => oncollapse(s))} />
        {#if !collapsed?.has(s)}
          {@render columns(of, `board-${s}`)}
        {/if}
      </section>
    {/each}
  </div>
{:else}
  {@render columns(rows, 'board')}
{/if}

<style>
  .swimlanes {
    display: grid;
    gap: var(--space-4);
  }
  .swimlane {
    display: grid;
    gap: var(--space-2);
  }
  .board {
    display: grid;
    grid-auto-flow: column;
    grid-auto-columns: minmax(15rem, 1fr);
    gap: var(--space-1);
    overflow-x: auto;
    align-items: stretch;
  }
  /* A column is a faint band off the page, a few percent of the text's
     own colour over it, so it reads alike in light and dark; the gutters
     between are narrow. */
  .lane {
    display: grid;
    gap: var(--space-2);
    align-content: start;
    padding: var(--space-2);
    grid-template-columns: minmax(0, 1fr);
    background: color-mix(in oklab, var(--text) 1.5%, transparent);
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
  h3 {
    display: flex;
    gap: var(--space-2);
    align-items: baseline;
    padding: var(--space-1) var(--space-2) 0;
    font-family: var(--font-ui);
    font-size: var(--text-sm);
    font-weight: 500;
  }
  h3 span:first-child::first-letter {
    text-transform: uppercase;
  }
  h3 span:first-child {
    display: inline-block;
  }
  .count {
    color: var(--text-muted);
    font-weight: 400;
  }
  .cards {
    display: grid;
    gap: var(--space-2);
    grid-template-columns: minmax(0, 1fr);
    min-height: 2.5rem;
  }
</style>
