<script lang="ts">
  import CaretDown from 'phosphor-svelte/lib/CaretDown'
  import CaretRight from 'phosphor-svelte/lib/CaretRight'
  import Plus from 'phosphor-svelte/lib/Plus'
  import type { Column } from '../models/view.ts'
  import { monthName, show } from '../models/format.ts'
  import { groupTint } from '../models/query.ts'
  import { inked } from '../models/ink.ts'
  import { useShell } from '../hooks/useShell.ts'
  import Cell from './Cell.svelte'
  import Icon from './Icon.svelte'

  // The header over a group of a list's, a table's or a
  // gallery's rows, as Linear's: a solid bar across its width, a subtle
  // gradient in the value's own ink where it names a record
  // (`groupTint`, its icon the same ink), kept at an enumeration's tone
  // instead, a date's month, or None where they hold none; the value, a
  // person's chip or a circle's name as `Cell` draws it, and how many
  // rows the group holds across every page, as a board's column says; a
  // chevron that collapses it where `oncollapse` is given, and a + that
  // creates in it where `oncreate` is. `row` is one of them, which the
  // value and its tone are read from; `value` is the group's, as the
  // rows are grouped by it, a date's `YYYY-MM`. `compact`, a calendar's
  // legend, draws the value and its count alone, beside its own swatch.
  let {
    by,
    row,
    value,
    month = false,
    count,
    collapsed = false,
    oncollapse,
    oncreate,
    compact = false,
  }: {
    by: Column
    row: any
    value: string
    month?: boolean
    count: number
    collapsed?: boolean
    oncollapse?: () => void
    oncreate?: () => void
    compact?: boolean
  } = $props()

  const label = $derived(value === '' ? 'None' : month ? monthName(value) : String(by.value(row) ?? value))
  const shell = useShell()
  // The bar's ink is the one `Cell` gives the value's icon: seeded by what
  // it draws, a circle's name rather than its id, so the two always agree.
  const drawn = $derived.by(() => {
    if (value === '') return ''
    const text = show(by.value(row), by.kind)
    return by.kind === 'circle' ? (shell.circle(text) ?? text) : text
  })
  const tint = $derived(groupTint(by, drawn, month))
  const tone = $derived(by.kind === 'badge' ? by.tone?.(row) : undefined)
</script>

{#snippet inner()}
  {#if value === ''}
    <span class="none">None</span>
  {:else if month}
    <span>{monthName(value)}</span>
  {:else}
    <Cell value={by.value(row)} kind={by.kind} tone={by.tone?.(row)} record={by.record} />
  {/if}
  <span class="count">{count}</span>
{/snippet}

{#if compact}
  <span class="group">{@render inner()}</span>
{:else}
  <div class="bar" class:inked={tint !== null} data-tone={tone} style={tint !== null ? inked(tint) : undefined}>
    {#if oncollapse}
      <button type="button" class="chevron" aria-expanded={!collapsed} aria-label="{collapsed ? 'Show' : 'Hide'} {label}" onclick={oncollapse}>
        <Icon icon={collapsed ? CaretRight : CaretDown} size="0.8rem" />
      </button>
    {/if}
    <span class="group">{@render inner()}</span>
    {#if oncreate}
      <button type="button" class="create" onclick={oncreate} title="Create in {label}" aria-label="Create in {label}">
        <Icon icon={Plus} size="0.8rem" />
      </button>
    {/if}
  </div>
{/if}

<style>
  .bar {
    display: flex;
    align-items: center;
    gap: var(--space-2);
    width: 100%;
    padding: var(--space-1) var(--space-2);
    border-radius: var(--radius-control);
    background: var(--raised);
  }
  /* An enumeration keeps its tone, a soft fill of it, never an ink. */
  .bar[data-tone='accent'] {
    background: var(--accent-soft);
  }
  .bar[data-tone='positive'] {
    background: var(--positive-soft);
  }
  .bar[data-tone='negative'] {
    background: var(--negative-soft);
  }
  .bar[data-tone='warning'] {
    background: var(--warning-soft);
  }
  /* A record's group: solid in its ink through the name, fading toward
     the plain ground where the count and the controls sit, so their
     usual quiet colours keep their own contrast. */
  .bar.inked {
    background: linear-gradient(to right, var(--wash) 45%, var(--raised) 90%);
  }
  .bar.inked .group {
    color: var(--on-wash);
  }
  .chevron,
  .create {
    display: grid;
    place-items: center;
    flex: none;
    width: 1.5rem;
    height: 1.5rem;
    padding: 0;
    border: none;
    border-radius: var(--radius-control);
    background: none;
    color: var(--text-muted);
    cursor: pointer;
  }
  .chevron:hover,
  .create:hover {
    background: var(--hover);
    color: var(--text);
  }
  .group {
    display: inline-flex;
    flex: 1 1 auto;
    align-items: center;
    gap: var(--space-2);
    min-width: 0;
    font-family: var(--font-ui);
    font-size: var(--text-sm);
    font-weight: 500;
    color: var(--text);
  }
  .none {
    color: var(--text-muted);
  }
  .count {
    color: var(--text-muted);
    font-weight: 400;
  }
</style>
