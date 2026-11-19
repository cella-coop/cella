<script lang="ts">
  import CaretDown from 'phosphor-svelte/lib/CaretDown'
  import CaretRight from 'phosphor-svelte/lib/CaretRight'
  import Plus from 'phosphor-svelte/lib/Plus'
  import { closed, type Column } from '../models/view.ts'
  import { toneOf } from '../models/status.ts'
  import { monthName, show } from '../models/format.ts'
  import { groupTint } from '../models/query.ts'
  import { inked } from '../models/ink.ts'
  import { useShell } from '../hooks/useShell.ts'
  import Icon from './Icon.svelte'
  import Value from './Value.svelte'

  // The header over a group of a list's, a table's or a
  // gallery's rows, as Linear's: a solid bar across its width. A closed
  // set's (`closed`: a state, a priority, a boolean, whose values the code
  // declares and are a handful) keeps its colour: a subtle gradient in its
  // tone, or in an ink seeded by its value where the tone has none
  // (`groupTint`), the value drawn as `Value` draws it. An open set's (a
  // circle's, a person's, a record's, any other the data holds) is a plain
  // grey bar, its value its `Chip`, a circle's icon in its ink inside it,
  // a person's avatar; a date's month and None are the grey bar and their
  // words. Then how many rows the group holds across every page, as a
  // board's column says; a chevron that collapses it where `oncollapse`
  // is given, and a + that creates in it where `oncreate` is. `row` is
  // one of them, which the value and its tone are read from; `value` is
  // the group's, as the rows are grouped by it, a date's `YYYY-MM`.
  // `compact`, a calendar's legend, draws the value and its count alone,
  // beside its own swatch.
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
  // The bar's ink is the one `Value` gives the state's dot: seeded by what
  // it draws, so the two always agree.
  const drawn = $derived.by(() => {
    if (value === '') return ''
    const text = show(by.value(row), by.kind)
    return by.kind === 'circle' ? (shell.circle(text) ?? text) : text
  })
  const shut = $derived(closed(by.kind, by.record))
  // A status's bar wears its category's tone, never an ink of its word.
  const tone = $derived(by.kind === 'status' && by.states && value !== '' ? toneOf(by.states, by.value(row)) : by.kind === 'badge' && shut ? by.tone?.(row) : undefined)
  const tint = $derived(groupTint(by, drawn, month, tone))
</script>

{#snippet inner()}
  {#if value === ''}
    <span class="none">None</span>
  {:else if month}
    <span>{monthName(value)}</span>
  {:else}
    <Value value={by.value(row)} kind={by.kind} tone={by.tone?.(row)} states={by.states} record={by.record} chip={!shut && !compact} />
  {/if}
  <span class="count">{count}</span>
{/snippet}

{#if compact}
  <span class="group">{@render inner()}</span>
{:else}
  <div class="bar" class:inked={tint !== null} data-tone={tint === null ? tone : undefined} style={tint !== null ? inked(tint) : undefined}>
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
    --surface: var(--raised);
    background: var(--surface);
  }
  /* A state with a tone of its own: the same faint breath as an ink's,
     of its soft tone, fading into the plain ground. Mixed in oklab, never
     oklch, whose hue would travel the wheel between the tone and the
     ground's and tint an amber bar green. */
  .bar[data-tone='positive'] {
    background: linear-gradient(to right, color-mix(in oklab, var(--positive-soft) 50%, var(--raised)), var(--raised) 60%);
  }
  .bar[data-tone='negative'] {
    background: linear-gradient(to right, color-mix(in oklab, var(--negative-soft) 50%, var(--raised)), var(--raised) 60%);
  }
  .bar[data-tone='warning'] {
    background: linear-gradient(to right, color-mix(in oklab, var(--warning-soft) 50%, var(--raised)), var(--raised) 60%);
  }
  /* A state's group whose tone has no colour of its own: a faint breath
     of its ink at the start, fading into the plain ground (the operator,
     16 Nov: much more subtle). The name keeps the usual text colour; its
     dot carries the ink. An open set's bar wears none (the operator,
     19 Nov): its chip names it. */
  .bar.inked {
    background: linear-gradient(to right, color-mix(in oklab, var(--wash) 30%, var(--raised)), var(--raised) 60%);
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
