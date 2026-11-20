<script lang="ts">
  import type { Snippet } from 'svelte'
  import { useForm } from '../hooks/useForm.ts'
  import Select from './Select.svelte'

  // A grid of figures to type into, as a week of time: a row per thing,
  // a column per day, each cell showing what it holds and taking what is
  // added to it, with each row's and column's total. Keyboard first: the
  // arrows move between open cells, past the text's ends sideways, and
  // Enter posts the form it sits in. A closed column takes nothing.
  let {
    caption,
    corner,
    columns,
    rows,
    name,
    held,
    pick,
    unit = 'h',
  }: {
    caption: string
    // What heads the rows, in the grid's top corner, as which week it is.
    corner?: Snippet
    columns: { key: string; label: string; sub?: string; open: boolean }[]
    rows: { key: string; label: string }[]
    // A cell's field name in the form.
    name: (row: string, column: string) => string
    // What a cell holds already, if anything.
    held: (row: string, column: string) => number
    // A choice each row makes, in a column of its own after its label, as
    // the circle a row's time is worked for: its heading, its field name
    // in the form and the options a row offers, the first chosen. A row
    // offering none shows none.
    pick?: { label: string; name: (row: string) => string; options: (row: string) => { value: string; label: string }[] }
    unit?: string
  } = $props()

  // The form it sits in, which its cells are named through.
  const form = useForm()
  const shown = (n: number) => (n ? `${Math.round(n * 100) / 100}` : '')
  const across = (row: string) => columns.reduce((s, c) => s + held(row, c.key), 0)
  const down = (column: string) => rows.reduce((s, r) => s + held(r.key, column), 0)
  const all = $derived(rows.reduce((s, r) => s + across(r.key), 0))

  const steps: Record<string, [number, number]> = { ArrowUp: [-1, 0], ArrowDown: [1, 0], ArrowLeft: [0, -1], ArrowRight: [0, 1] }

  // The next open cell in the arrow's direction, if there is one.
  function move(e: KeyboardEvent) {
    const step = steps[e.key]
    const at = e.currentTarget as HTMLInputElement
    if (!step || (e.key === 'ArrowLeft' && at.selectionStart !== 0) || (e.key === 'ArrowRight' && at.selectionEnd !== at.value.length)) {
      return
    }
    const table = at.closest('table')
    let [i, j] = [Number(at.dataset.row), Number(at.dataset.column)]
    for (;;) {
      ;[i, j] = [i + step[0], j + step[1]]
      if (i < 0 || j < 0 || i >= rows.length || j >= columns.length) {
        return
      }
      const next = table?.querySelector<HTMLInputElement>(`input[data-row="${i}"][data-column="${j}"]`)
      if (next && !next.disabled) {
        e.preventDefault()
        next.focus()
        next.select()
        return
      }
    }
  }
</script>

<!-- Wider than where it sits, it scrolls sideways; a dialog holding it
     widens to a week (Dialog). -->
<div class="scroll" data-wide>
  <table class="grid">
    <caption>{caption}</caption>
    <thead>
      <tr>
        <td class="corner">{@render corner?.()}</td>
        {#if pick}<th scope="col" class="pick">{pick.label}</th>{/if}
        {#each columns as c (c.key)}
          <th scope="col" class:closed={!c.open}>{c.label}{#if c.sub}<small>{c.sub}</small>{/if}</th>
        {/each}
        <th scope="col" class="total">Total</th>
      </tr>
    </thead>
    <tbody>
      {#each rows as r, i (r.key)}
        <tr>
          <th scope="row">{r.label}</th>
          {#if pick}
            <td class="pick">
              {#if pick.options(r.key).length}
                <span class="choice"><Select name={form.name(pick.name(r.key))} label="{r.label}: {pick.label}" options={pick.options(r.key)} /></span>
              {/if}
            </td>
          {/if}
          {#each columns as c, j (c.key)}
            <td class:closed={!c.open}>
              <span class="held" aria-hidden="true">{shown(held(r.key, c.key))}</span>
              <input
                name={form.name(name(r.key, c.key))}
                inputmode="decimal"
                autocomplete="off"
                placeholder={c.open ? '+' : ''}
                disabled={!c.open}
                aria-label="{r.label}, {c.label}{c.sub ? ` ${c.sub}` : ''}: add {unit}{held(r.key, c.key) ? `, ${shown(held(r.key, c.key))} ${unit} logged` : ''}"
                data-row={i}
                data-column={j}
                onkeydown={move}
              />
            </td>
          {/each}
          <td class="total">{shown(across(r.key))}</td>
        </tr>
      {/each}
    </tbody>
    <tfoot>
      <tr>
        <th scope="row">Total</th>
        {#if pick}<td></td>{/if}
        {#each columns as c (c.key)}<td class="total">{shown(down(c.key))}</td>{/each}
        <td class="total">{shown(all)}</td>
      </tr>
    </tfoot>
  </table>
</div>

<style>
  .scroll {
    grid-column: 1 / -1;
    min-width: 0;
    max-width: 100%;
    overflow-x: auto;
  }
  .grid {
    width: 100%;
    border-collapse: separate;
    border-spacing: 2px;
    font-size: var(--text-sm);
    font-variant-numeric: tabular-nums;
  }
  caption {
    position: absolute;
    width: 1px;
    height: 1px;
    overflow: hidden;
    clip-path: inset(50%);
  }
  thead th {
    font-weight: 500;
    color: var(--text-muted);
    text-align: center;
    padding: var(--space-1);
  }
  .corner {
    vertical-align: bottom;
    padding-block-end: var(--space-1);
    color: var(--text-muted);
  }
  thead small {
    display: block;
    font-size: var(--text-2xs);
    color: var(--text-subtle);
  }
  tbody th,
  tfoot th {
    text-align: start;
    font-weight: 500;
    padding-inline-end: var(--space-2);
    max-width: 14rem;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  td {
    position: relative;
    padding: 0;
  }
  .held {
    position: absolute;
    inset-block-start: 2px;
    inset-inline-end: 6px;
    font-size: var(--text-2xs);
    color: var(--text-subtle);
    pointer-events: none;
  }
  input {
    width: 100%;
    min-width: 3rem;
    height: 2.2rem;
    padding: 0.6rem var(--space-2) 0;
    border: 1px solid transparent;
    border-radius: var(--radius-control);
    background: var(--sunk);
    color: var(--text);
    font: inherit;
    text-align: center;
  }
  input::placeholder {
    color: var(--text-subtle);
  }
  input:focus {
    border-color: var(--accent-border);
    background: var(--raised);
  }
  .pick {
    padding-inline-end: var(--space-2);
  }
  th.pick {
    text-align: start;
  }
  .choice {
    display: block;
    min-width: 8rem;
    max-width: 12rem;
    font-size: var(--text-sm);
  }
  .closed input {
    background: transparent;
  }
  th.closed {
    color: var(--text-subtle);
  }
  .total {
    text-align: center;
    color: var(--text-muted);
    min-width: 3rem;
  }
  tfoot .total,
  tfoot th {
    padding-block-start: var(--space-1);
    font-weight: 500;
    color: var(--text);
  }
</style>
