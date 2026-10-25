<script lang="ts">
  import type { SheetRow } from '../models/view.ts'
  import Cell from './Cell.svelte'

  // A financial statement: its rubrics in order, a figure in each column,
  // headings over their lines and totals ruled off. A line with accounts
  // opens on them, each with its figures and a link to its ledger.
  let { columns, rows }: { columns: string[]; rows: SheetRow[] } = $props()

  const tone = (r: SheetRow, a: number | null) => (r.kind === 'total' && a !== null && a < 0 ? 'negative' : undefined)
</script>

<div class="sheet" style:--columns={columns.length}>
  <div class="row head">
    <span></span>
    {#each columns as c (c)}
      <span class="figure">{c}</span>
    {/each}
  </div>
  {#each rows as r (r.id)}
    {#if r.kind === 'heading'}
      <div class="row heading"><span>{r.label}</span></div>
    {:else if r.accounts?.length}
      <details class="opens">
        <summary class="row line">
          <span class="label">{r.label}</span>
          {#each r.amounts as a, i (i)}
            <span class="figure"><Cell value={a} kind="money" /></span>
          {/each}
        </summary>
        {#each r.accounts as a (a.code)}
          <a class="row account" href={a.href}>
            <span class="label"><span class="code">{a.code}</span> {a.label}</span>
            {#each a.amounts as x, i (i)}
              <span class="figure"><Cell value={x} kind="money" /></span>
            {/each}
          </a>
        {/each}
      </details>
    {:else}
      <div class="row {r.kind}">
        <span class="label">{r.label}</span>
        {#each r.amounts as a, i (i)}
          <span class="figure"><Cell value={a} kind="money" tone={tone(r, a)} /></span>
        {/each}
      </div>
    {/if}
  {/each}
</div>

<style>
  .sheet {
    display: grid;
    font-size: var(--text-sm);
    overflow-x: auto;
  }
  .row {
    display: grid;
    grid-template-columns: minmax(12rem, 1fr) repeat(var(--columns), minmax(7.5rem, 9rem));
    gap: var(--space-3);
    align-items: baseline;
    padding: var(--space-1) var(--space-3);
    border-radius: var(--radius-control);
    color: var(--text);
    text-decoration: none;
  }
  .head {
    font-size: var(--text-2xs);
    font-weight: 600;
    letter-spacing: var(--eyebrow-tracking);
    text-transform: uppercase;
    color: var(--text-subtle);
  }
  .heading {
    font-family: var(--font-display);
    font-size: var(--text-md);
    font-weight: 600;
    padding-block-start: var(--space-3);
  }
  .total {
    font-weight: 600;
    border-block-start: 1px solid var(--line);
    border-radius: 0;
    margin-block-end: var(--space-1);
  }
  .figure {
    text-align: end;
  }
  .label {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  summary {
    cursor: pointer;
    list-style: none;
  }
  summary::-webkit-details-marker {
    display: none;
  }
  summary .label::before {
    content: '▸';
    display: inline-block;
    width: 1em;
    color: var(--text-subtle);
    transition: transform var(--fast) var(--ease);
  }
  details[open] > summary .label::before {
    transform: rotate(90deg);
  }
  summary:hover,
  .account:hover {
    background: var(--hover);
  }
  summary:focus-visible,
  .account:focus-visible {
    outline: none;
    box-shadow: var(--focus);
  }
  .account {
    color: var(--text-muted);
    padding-inline-start: calc(var(--space-3) + 1em);
  }
  .code {
    font-family: var(--font-mono);
    font-size: var(--text-xs);
    color: var(--text-subtle);
  }
</style>
