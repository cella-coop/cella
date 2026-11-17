<script lang="ts">
  import MagnifyingGlass from 'phosphor-svelte/lib/MagnifyingGlass'
  import Check from 'phosphor-svelte/lib/Check'
  import X from 'phosphor-svelte/lib/X'
  import { show } from '../models/format.ts'
  import { filtering, type Field, type Spec, type Where } from '../models/query.ts'
  import { useCollection } from '../hooks/useCollection.ts'
  import { useShell } from '../hooks/useShell.ts'
  import Button from './Button.svelte'
  import Icon from './Icon.svelte'
  import Person from './Person.svelte'
  import Popover from './Popover.svelte'
  import Select from './Select.svelte'

  // The collection's filter bar: on the line above its rows once a
  // condition or a search holds, or, while neither does, folded into the
  // header as Search and + Filter alone. Chips on the left, a condition
  // each (its popover the same one the View panel opened, field, then,
  // for a date, the month or the year, else the values it offers; click
  // edits it, its own x removes it at once) and, once it holds text or is
  // being typed, the search's; Search and + Filter on the right, then,
  // while the view differs from what it opened as, Save (through the
  // same save the View panel's own went through) and Reset (back to what
  // the view opened as). A chip the open view's own saved form already
  // held draws plain; one this page added or changed since carries a
  // small dot.
  let {
    compact = false,
    spec,
    base,
    fields,
    values,
    dirty,
    onchange,
    onsave,
    onreset,
  }: {
    // Folded into the header: no chip to show, so only Search and
    // + Filter, as plain icon buttons.
    compact?: boolean
    spec: Spec
    // What the open view (a preset or the viewer's own) shows before this
    // page's own changes: a chip's dot, and what Reset returns to.
    base: Spec
    fields: Field[]
    values: Record<string, string[]>
    dirty: boolean
    onchange: (spec: Spec) => void
    onsave: () => void
    onreset: () => void
  } = $props()

  const state = useCollection()
  const shell = useShell()

  // The fields already conditioned, and the one a field was just chosen
  // for, before its popover has picked a value.
  const conditioned = $derived([...spec.where.map((w) => w.field), ...(state.adding && !spec.where.some((w) => w.field === state.adding) ? [state.adding] : [])])
  const offered = $derived(fields.filter((f) => filtering(f, values[f.key]) && !conditioned.includes(f.key)))
  const typed = (key: string) => fields.find((f) => f.key === key)
  const conditions = $derived(conditioned.map(typed).filter((f) => f !== undefined))

  const on = (key: string) => spec.where.find((w) => w.field === key)
  const kept = (key: string, v: string) => {
    const w = on(key)
    return !!w && 'is' in w && w.is.includes(v)
  }
  const within = (key: string) => {
    const w = on(key)
    return w && 'within' in w ? w.within : ''
  }
  // A value as a condition names it: a person and a circle by name, an
  // amount of money in euros, a date as a day, else as the row holds it.
  const named = (key: string, v: string) => {
    const t = typed(key)?.type
    return t === 'person' ? (shell.name(v) ?? v) : t === 'circle' ? (shell.circle(v) ?? v) : show(v, t)
  }
  const said = (key: string) => {
    const w = on(key)
    return !w ? 'any' : 'is' in w ? w.is.map((v) => named(key, v)).join(', ') : w.within === 'month' ? 'this month' : 'this year'
  }

  const same = (a: unknown, b: unknown) => JSON.stringify(a ?? null) === JSON.stringify(b ?? null)
  // Whether a condition, or the search, differs from the view's own
  // saved form: the dot a chip wears once it does.
  const changed = (key: string) => !same(on(key), base.where.find((w) => w.field === key))
  const qChanged = $derived(spec.q !== base.q)

  // A condition added keeps its chip while the address catches up; one
  // taken away takes it.
  function where(key: string, w: Where | undefined) {
    if (!w && state.adding === key) {
      state.adding = null
    }
    onchange({ ...spec, q: state.filter, where: [...spec.where.filter((x) => x.field !== key), ...(w ? [w] : [])] })
  }

  function toggle(key: string, v: string) {
    const w = on(key)
    const is = w && 'is' in w ? w.is : []
    const next = is.includes(v) ? is.filter((x) => x !== v) : [...is, v]
    where(key, next.length ? { field: key, is: next } : undefined)
  }

  // A field chosen to filter on: a date keeps this month at once, any
  // other opens its chip's popover to pick the values it keeps.
  function add(key: string) {
    if (typed(key)?.type === 'date') {
      where(key, { field: key, within: 'month' })
    } else {
      state.adding = key
    }
  }

  const as = (fs: { key: string; label: string; type?: string }[]) => fs.map((f) => ({ value: f.key, label: f.type === 'date' ? `${f.label}, by month` : f.label }))

  function openSearch() {
    state.searching = true
  }

  // A blur commits the typed text as the chip, or, with none, folds the
  // search back to the magnifier.
  function closeSearch() {
    state.searching = false
  }

  // Removing the search clears it at once, rather than waiting on the
  // typing's debounce.
  function clearSearch() {
    state.filter = ''
    state.searching = false
    onchange({ ...spec, q: '' })
  }

  const focusOnMount = (node: HTMLInputElement) => {
    node.focus()
  }

  // The + Filter trigger, handed to the collection's state so "F" can
  // open it, wherever this bar is mounted.
  const captureAdder = (node: HTMLElement) => {
    state.adder = node.querySelector<HTMLButtonElement>('button.trigger') ?? undefined
    return () => {
      state.adder = undefined
    }
  }
</script>

<div class="bar" class:compact>
  {#if !compact && (conditions.length || spec.q)}
    <ul class="chips">
      {#each conditions as f (f.key)}
        <li>
          <span class="chip" class:added={changed(f.key)}>
            <Popover
              label="Condition on {f.label}"
              open={state.adding === f.key}
              onclose={() => {
                if (state.adding === f.key) {
                  state.adding = null
                }
              }}
            >
              {#snippet trigger()}<span class="said">{f.label}: {said(f.key)}</span>{#if changed(f.key)}<span class="dot" aria-hidden="true"></span><span class="visually-hidden">, changed</span>{/if}{/snippet}
              {#if f.type === 'date'}
                {#each ['month', 'year'] as const as w (w)}
                  <button role="menuitemradio" class="item" aria-checked={within(f.key) === w} onclick={() => where(f.key, { field: f.key, within: w })}>
                    {w === 'month' ? 'This month' : 'This year'}{#if within(f.key) === w}<Icon icon={Check} />{/if}
                  </button>
                {/each}
              {:else}
                {#each values[f.key] ?? [] as v (v)}
                  <button role="menuitemcheckbox" class="item" aria-checked={kept(f.key, v)} data-value={v} onclick={() => toggle(f.key, v)}>
                    {#if f.type === 'person'}<Person address={v} />{:else}<span class="said">{named(f.key, v)}</span>{/if}{#if kept(f.key, v)}<Icon icon={Check} />{/if}
                  </button>
                {/each}
              {/if}
            </Popover>
            <button type="button" class="remove" aria-label="Remove the {f.label} filter" onclick={() => where(f.key, undefined)}><Icon icon={X} /></button>
          </span>
        </li>
      {/each}
      {#if spec.q && !state.searching}
        <li>
          <span class="chip" class:added={qChanged}>
            <button type="button" class="said-trigger" onclick={openSearch}>
              <span class="said">Search: "{spec.q}"</span>{#if qChanged}<span class="dot" aria-hidden="true"></span><span class="visually-hidden">, changed</span>{/if}
            </button>
            <button type="button" class="remove" aria-label="Remove the search" onclick={clearSearch}><Icon icon={X} /></button>
          </span>
        </li>
      {/if}
    </ul>
  {/if}

  <div class="controls">
    {#if state.searching}
      <input
        class="search"
        bind:this={state.search}
        {@attach focusOnMount}
        bind:value={state.filter}
        onblur={closeSearch}
        placeholder="Search"
        aria-label="Search"
      />
    {:else}
      <button type="button" class="icon" aria-label="Search" title="Search  /" onclick={openSearch}><Icon icon={MagnifyingGlass} /></button>
    {/if}
    <span class="adder" {@attach captureAdder}>
      <Select fit label="Filter" placeholder="+ Filter" options={as(offered)} disabled={offered.length === 0} bind:value={() => '', (key) => key && add(key)} />
    </span>
    {#if dirty}
      <Button tone="primary" onclick={onsave}>Save</Button>
      <Button onclick={onreset}>Reset</Button>
    {/if}
  </div>
</div>

<style>
  .bar {
    display: flex;
    align-items: center;
    gap: var(--space-2);
    min-width: 0;
  }
  /* Above the rows, the bar spans the content; folded into the header it
     is only as wide as its two controls. */
  .bar:not(.compact) {
    width: 100%;
  }
  .chips {
    display: flex;
    flex-wrap: nowrap;
    align-items: center;
    gap: var(--space-1);
    margin: 0;
    padding: 0;
    list-style: none;
    min-width: 0;
    flex: 1 1 auto;
    overflow-x: auto;
    scrollbar-width: none;
  }
  .chips li {
    flex: none;
  }
  .chip {
    display: flex;
    align-items: center;
    flex: none;
    max-width: 16rem;
    border-radius: var(--radius-pill);
    background: var(--accent-soft);
    color: var(--accent-text);
  }
  .chip :global(.trigger) {
    width: auto;
    min-width: 0;
    max-width: 100%;
    padding: 0 0 0 var(--space-2);
    border-radius: 0;
    background: none;
    line-height: 1.6rem;
    font-size: var(--text-xs);
  }
  .said-trigger {
    display: flex;
    align-items: center;
    gap: var(--space-1);
    padding-inline-start: var(--space-2);
    border: none;
    background: none;
    line-height: 1.6rem;
    font-size: var(--text-xs);
    color: inherit;
    cursor: pointer;
  }
  .said {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    min-width: 0;
  }
  .dot {
    flex: none;
    width: 0.4rem;
    height: 0.4rem;
    border-radius: 50%;
    background: currentColor;
  }
  .remove {
    display: grid;
    place-items: center;
    flex: none;
    width: 1.6rem;
    height: 1.6rem;
    margin-inline-end: 2px;
    padding: 0;
    border: none;
    border-radius: 50%;
    background: none;
    color: inherit;
    opacity: 0.7;
    cursor: pointer;
  }
  .remove:hover {
    opacity: 1;
    background: oklch(0% 0 0 / 10%);
  }
  .item {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--space-2);
    width: 100%;
    padding: var(--space-1) var(--space-2);
    border: none;
    border-radius: var(--radius-control);
    background: none;
    font-size: var(--text-sm);
    color: var(--text);
    text-align: start;
    cursor: pointer;
  }
  .item:hover,
  .item:focus-visible {
    background: var(--hover);
  }
  .controls {
    display: flex;
    align-items: center;
    gap: var(--space-1);
    flex: none;
  }
  .icon {
    display: grid;
    place-items: center;
    width: 1.75rem;
    height: 1.75rem;
    border: none;
    border-radius: var(--radius-control);
    background: none;
    color: var(--text-muted);
    cursor: pointer;
  }
  .icon:hover {
    background: var(--hover);
    color: var(--text);
  }
  .search {
    width: 11rem;
    height: 1.9rem;
    padding: 0 var(--space-2);
    border: 1px solid var(--line);
    border-radius: var(--radius-control);
    background: var(--sunk);
    color: var(--text);
    font-size: var(--text-sm);
  }
  .adder :global(.select) {
    width: auto;
  }
</style>
