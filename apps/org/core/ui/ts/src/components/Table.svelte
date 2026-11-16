<script lang="ts">
  import type { Column } from '../models/view.ts'
  import { opens, under } from '../models/query.ts'
  import { focused, scroller } from '../models/keys.ts'
  import { useSection } from '../hooks/useSection.ts'
  import SortAscending from 'phosphor-svelte/lib/SortAscending'
  import SortDescending from 'phosphor-svelte/lib/SortDescending'
  import Cell from './Cell.svelte'
  import Group from './Group.svelte'
  import Icon from './Icon.svelte'

  // A table of rows; with none, one quiet line in their place, named for
  // the section it sits in unless `empty` says otherwise, and no headers.
  // Where the keyboard roves its rows, `stop` is the one row in the tab
  // order, the keyboard's row (`active`) takes the focus and a row
  // focused otherwise is reported (`onfocusrow`); `sorted` is the column
  // the rows are ordered by, which its header says; with `onsort`, a
  // header is a button that asks to order by its column. Where the rows
  // are grouped (`group`), a row heads each group's rows with its value
  // and how many rows it holds, `counts`, by value.
  let {
    columns,
    rows,
    href,
    active = -1,
    stop = -1,
    onfocusrow,
    sorted = null,
    onsort,
    empty,
    group,
  }: {
    columns: Column[]
    rows: any[]
    href?: (row: any) => string | undefined
    active?: number
    stop?: number
    onfocusrow?: (i: number) => void
    sorted?: { key: string; dir: 'ascending' | 'descending' } | null
    onsort?: (key: string) => void
    empty?: string
    group?: { by: Column; counts: Record<string, number> }
  } = $props()

  const section = useSection()
  const none = $derived(empty ?? (section ? `No ${section().toLowerCase()}` : 'Nothing here yet.'))
  const end = (c: Column) => c.kind === 'money' || c.kind === 'number'
</script>

{#if rows.length === 0}
  <p class="empty">{none}</p>
{:else}
  <div class="scroll" {@attach scroller(section?.() ?? 'Table')}>
    <table>
      <thead>
        <tr>
          {#each columns as c (c.key)}
            <th class:end={end(c)} aria-sort={sorted?.key === c.key ? sorted.dir : undefined}>
              {#if onsort}
                <button class="sort" onclick={() => onsort(c.key)}>
                  {c.label}{#if sorted?.key === c.key}<Icon icon={sorted.dir === 'ascending' ? SortAscending : SortDescending} />{/if}
                </button>
              {:else}
                {c.label}
              {/if}
            </th>
          {/each}
        </tr>
      </thead>
      <tbody>
        {#each rows as row, i (row.id)}
          {const link = $derived(href?.(row))}
          {#if group && opens(rows, i, group.by.key)}
            {const value = $derived(under(row, group.by.key))}
            <tr class="group">
              <th colspan={columns.length} scope="colgroup"><Group by={group.by} {row} empty={value === ''} count={group.counts[value] ?? 0} /></th>
            </tr>
          {/if}
          <tr
            class:active={i === active}
            class:linked={link}
            tabindex={stop < 0 ? undefined : i === stop ? 0 : -1}
            onfocusin={() => onfocusrow?.(i)}
            {@attach focused(i === active)}
          >
            {#each columns as c, j (c.key)}
              <td class:end={end(c)}>
                {#if link && j === 0}
                  <a href={link} class="stretched" tabindex={stop < 0 ? undefined : -1}><Cell value={c.value(row)} kind={c.kind} tone={c.tone?.(row)} record={c.record} /></a>
                {:else}
                  <Cell value={c.value(row)} kind={c.kind} tone={c.tone?.(row)} record={c.record} />
                {/if}
              </td>
            {/each}
          </tr>
        {/each}
      </tbody>
    </table>
  </div>
{/if}

<style>
  .empty {
    font-size: var(--text-sm);
    color: var(--text-muted);
    padding-inline: var(--space-3);
  }
  .scroll {
    overflow-x: auto;
  }
  table {
    width: 100%;
    border-collapse: collapse;
    font-size: var(--text-sm);
  }
  th {
    text-align: start;
    font-size: var(--text-xs);
    font-weight: 500;
    color: var(--text-subtle);
    padding: var(--space-1) var(--space-3);
    white-space: nowrap;
  }
  /* A header that orders by its column reads as its label, its arrow
     after it where the rows are ordered by it. */
  .sort {
    display: inline-flex;
    align-items: center;
    gap: var(--space-1);
    padding: 0;
    border: none;
    background: none;
    font: inherit;
    color: inherit;
    cursor: pointer;
  }
  .sort:hover {
    color: var(--text);
  }
  td {
    padding: 0 var(--space-3);
    height: var(--row);
    max-width: 24rem;
  }
  td > :global(*) {
    display: inline-flex;
    max-width: 100%;
  }
  .end {
    text-align: end;
  }
  tbody tr {
    border-radius: var(--radius-control);
  }
  tbody tr:not(.group):hover,
  tr.active {
    background: var(--hover);
  }
  /* A group's header, a quiet line over its rows with room above it. */
  tr.group th {
    padding: var(--space-3) var(--space-3) var(--space-1);
  }
  /* A row draws the ring as an outline inside it, since WebKit draws no
     shadow on a table row. */
  tbody tr:focus-visible {
    outline: var(--focus-outline);
    outline-offset: -2px;
  }
  /* The first cell's link covers its row, so the whole row opens it and
     the link is the row's one tab stop. */
  tr.linked {
    position: relative;
  }
  .stretched::after {
    content: '';
    position: absolute;
    inset: 0;
  }
  td:first-child,
  th:first-child {
    border-start-start-radius: var(--radius-control);
    border-end-start-radius: var(--radius-control);
  }
  td:last-child {
    border-start-end-radius: var(--radius-control);
    border-end-end-radius: var(--radius-control);
  }
</style>
