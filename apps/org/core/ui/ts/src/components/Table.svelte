<script lang="ts">
  import type { Column } from '../models/view.ts'
  import { focused, scroller } from '../models/keys.ts'
  import { useSection } from '../hooks/useSection.ts'
  import Cell from './Cell.svelte'

  // A table of rows; with none, one quiet line in their place, named for
  // the section it sits in unless `empty` says otherwise, and no headers.
  // Where the keyboard roves its rows, `stop` is the one row in the tab
  // order, the keyboard's row (`active`) takes the focus and a row
  // focused otherwise is reported (`onfocusrow`); `sorted` is the column
  // the rows are ordered by, which its header says.
  let {
    columns,
    rows,
    href,
    active = -1,
    stop = -1,
    onfocusrow,
    sorted = null,
    empty,
  }: {
    columns: Column[]
    rows: any[]
    href?: (row: any) => string | undefined
    active?: number
    stop?: number
    onfocusrow?: (i: number) => void
    sorted?: { key: string; dir: 'ascending' | 'descending' } | null
    empty?: string
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
            <th class:end={end(c)} aria-sort={sorted?.key === c.key ? sorted.dir : undefined}>{c.label}</th>
          {/each}
        </tr>
      </thead>
      <tbody>
        {#each rows as row, i (row.id)}
          {const link = $derived(href?.(row))}
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
                  <a href={link} class="stretched" tabindex={stop < 0 ? undefined : -1}><Cell value={c.value(row)} kind={c.kind} tone={c.tone?.(row)} /></a>
                {:else}
                  <Cell value={c.value(row)} kind={c.kind} tone={c.tone?.(row)} />
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
  tbody tr:hover,
  tr.active {
    background: var(--hover);
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
