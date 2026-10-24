<script lang="ts">
  import type { Column } from '../models/view.ts'
  import Cell from './Cell.svelte'

  let {
    columns,
    rows,
    href,
    active = -1,
  }: {
    columns: Column[]
    rows: any[]
    href?: (row: any) => string | undefined
    active?: number
  } = $props()

  const end = (c: Column) => c.kind === 'money' || c.kind === 'number'
</script>

<div class="scroll">
  <table>
    <thead>
      <tr>
        {#each columns as c (c.key)}
          <th class:end={end(c)}>{c.label}</th>
        {/each}
      </tr>
    </thead>
    <tbody>
      {#each rows as row, i (row.id)}
        {const link = $derived(href?.(row))}
        <tr class:active={i === active} class:linked={link} data-row={i}>
          {#each columns as c, j (c.key)}
            <td class:end={end(c)}>
              {#if link && j === 0}
                <a href={link} tabindex="-1"><Cell value={c.value(row)} kind={c.kind} tone={c.tone?.(row)} /></a>
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

<style>
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
    font-size: var(--text-2xs);
    font-weight: 600;
    letter-spacing: var(--eyebrow-tracking);
    text-transform: uppercase;
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
  tr.linked {
    cursor: pointer;
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
