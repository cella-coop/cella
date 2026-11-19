<script lang="ts">
  import type { Component } from 'svelte'
  import type { Column, Total } from '../models/view.ts'
  import { opens, under, type Grouping } from '../models/query.ts'
  import { focused, scroller } from '../models/keys.ts'
  import { inked, inkOf } from '../models/ink.ts'
  import { useSection } from '../hooks/useSection.ts'
  import SortAscending from 'phosphor-svelte/lib/SortAscending'
  import SortDescending from 'phosphor-svelte/lib/SortDescending'
  import Cell from './Cell.svelte'
  import Empty from './Empty.svelte'
  import Group from './Group.svelte'
  import Icon from './Icon.svelte'

  // A table of rows; with none, `Empty` in their place, named for the
  // section it sits in unless `empty` says otherwise, and no headers. Its
  // first column's text starts at the inset of what it sits in. `dense`,
  // as inside a panel, sets its rows closer, their text flush with the
  // panel's content edge and a row's hover reaching a little past it.
  // `totals` are ruled off under the rows, each figure under the last
  // column, a total heavier under its own rule; a table of totals alone
  // draws them with no headers, as a payslip's pay.
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
    mark,
    dense = false,
    totals = [],
  }: {
    columns: Column[]
    rows: any[]
    dense?: boolean
    totals?: Total[]
    href?: (row: any) => string | undefined
    active?: number
    stop?: number
    onfocusrow?: (i: number) => void
    sorted?: { key: string; dir: 'ascending' | 'descending' } | null
    onsort?: (key: string) => void
    empty?: string
    group?: Grouping
    // A row's own icon, in place of the title column's first cell's;
    // none draws none.
    mark?: (row: any) => Component<any> | undefined
  } = $props()

  const section = useSection()
  const none = $derived(empty ?? (section ? `No ${section().toLowerCase()}` : 'Nothing here yet.'))
  const end = (c: Column) => c.kind === 'money' || c.kind === 'number'
</script>

{#if rows.length === 0 && totals.length === 0}
  <Empty text={none} />
{:else}
  <div class="scroll" class:dense {@attach scroller(section?.() ?? 'Table')}>
    <table>
      <thead class:none={!rows.length}>
        <tr>
          {#each columns as c (c.key)}
            <th class:end={end(c)} class:titled={c.kind === 'title'} aria-sort={sorted?.key === c.key ? sorted.dir : undefined}>
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
          {const value = $derived(group ? under(row, group.by.key, group.month) : '')}
          {#if group && opens(rows, i, group.by.key, group.month)}
            <tr class="group">
              <th colspan={columns.length} scope="colgroup">
                <Group
                  by={group.by}
                  {row}
                  {value}
                  month={group.month}
                  count={group.counts[value] ?? 0}
                  collapsed={group.collapsed.has(value)}
                  oncollapse={() => group.oncollapse(value)}
                  oncreate={group.oncreate}
                />
              </th>
            </tr>
          {/if}
          {#if !group || !group.collapsed.has(value)}
            <tr
              class:active={i === active}
              class:linked={link}
              tabindex={stop < 0 ? undefined : i === stop ? 0 : -1}
              onfocusin={() => onfocusrow?.(i)}
              {@attach focused(i === active)}
            >
              {#each columns as c, j (c.key)}
                {const rowIcon = $derived(c.role === 'title' ? mark?.(row) : undefined)}
                <td class:end={end(c)} class:titled={c.kind === 'title'}>
                  {#if link && j === 0}
                    <a href={link} class="stretched" tabindex={stop < 0 ? undefined : -1}>
                      {#if rowIcon}<span class="mark" style={inked(inkOf(String(c.value(row))))}><Icon icon={rowIcon} /></span>{/if}
                      <Cell value={c.value(row)} kind={c.kind} tone={c.tone?.(row)} record={c.record} />
                    </a>
                  {:else}
                    {#if rowIcon}<span class="mark" style={inked(inkOf(String(c.value(row))))}><Icon icon={rowIcon} /></span>{/if}
                    <Cell value={c.value(row)} kind={c.kind} tone={c.tone?.(row)} record={c.record} />
                  {/if}
                </td>
              {/each}
            </tr>
          {/if}
        {/each}
      </tbody>
      {#if totals.length}
        <tfoot class:ruled={rows.length > 0}>
          {#each totals as t (t.label)}
            <tr class:total={t.total}>
              <th scope="row" colspan={Math.max(1, columns.length - 1)}>{t.label}</th>
              <td class="end"><Cell value={t.value} kind={t.kind ?? 'money'} tone={t.tone} /></td>
            </tr>
          {/each}
        </tfoot>
      {/if}
    </table>
  </div>
{/if}

<style>
  /* The first column's text starts at the inset of what the table sits
     in, a section's or the content's; a dense table's rows reach a
     little past it, so their text is flush with a panel's content edge
     and a row's hover fill bleeds into the panel's padding. */
  .scroll {
    --edge: var(--inset, var(--space-3));
    overflow-x: auto;
  }
  .dense {
    --edge: var(--space-2);
    margin-inline: calc(-1 * var(--space-2));
  }
  .dense td {
    height: 2rem;
    padding-inline: var(--space-2);
  }
  .dense th {
    padding-inline: var(--space-2);
  }
  /* In a panel the title column gives way first, its text ending in an
     ellipsis, so the figures and the totals under them stay in view on a
     narrow screen. */
  .dense .titled {
    width: 100%;
    max-width: 0;
  }
  td:first-child,
  th:first-child {
    padding-inline-start: var(--edge);
  }
  td:last-child,
  th:last-child {
    padding-inline-end: var(--edge);
  }
  /* A table of totals alone keeps its columns for assistive technology
     and shows no headers: hidden visually, not from the accessibility
     tree, so a screen reader still has the column names for its row. */
  thead.none {
    position: absolute;
    width: 1px;
    height: 1px;
    overflow: hidden;
    clip-path: inset(50%);
    white-space: nowrap;
  }
  tfoot th {
    text-align: start;
    font-size: var(--text-sm);
    font-weight: 400;
    color: var(--text-muted);
    white-space: normal;
  }
  tfoot td,
  tfoot th {
    height: 1.875rem;
    padding-block: 0;
  }
  tfoot.ruled tr:first-child > * {
    border-block-start: 1px solid var(--line);
  }
  tfoot tr.total > * {
    border-block-start: 1px solid var(--line);
    font-weight: 600;
    color: var(--text);
  }
  tfoot tr > * {
    border-radius: 0;
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
    --surface: var(--hovered);
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
  .mark {
    display: inline-flex;
    flex: none;
    vertical-align: middle;
    margin-inline-end: var(--space-1);
    color: var(--mark);
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
