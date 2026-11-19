<script lang="ts">
  import MagnifyingGlass from 'phosphor-svelte/lib/MagnifyingGlass'
  import Funnel from 'phosphor-svelte/lib/Funnel'
  import Tick from './Tick.svelte'
  import X from 'phosphor-svelte/lib/X'
  import { show } from '../models/format.ts'
  import { canon, filtering, type Field, type Spec, type Where } from '../models/query.ts'
  import { useCollection } from '../hooks/useCollection.ts'
  import { useShell } from '../hooks/useShell.ts'
  import Icon from './Icon.svelte'
  import Value from './Value.svelte'
  import Popover from './Popover.svelte'
  import { glyph, glyphs } from '../glyphs.ts'

  // The collection's filter bar: on the line above its rows once a
  // condition or a search holds, or, while neither does, folded into the
  // header as + Filter alone, whose menu opens with Search, then a rule,
  // then each field it can filter by, marked by its kind's icon. Chips on
  // the left, a condition
  // each (its popover the same one the View panel opened, field, then,
  // for a date, the month or the year, else the values it offers; click
  // edits it, its own x removes it at once) and, once it holds text or is
  // being typed, the search's; + Filter on the right, then,
  // while the view differs from what it opened as, Save (through the
  // same save the View panel's own went through) and Reset (back to what
  // the view opened as). A chip the open view's own saved form already
  // held draws plain; one this page added or changed since carries a
  // small dot.
  let {
    spec,
    base,
    fields,
    values,
    onchange,
    lens = null,
  }: {
    spec: Spec
    // What the open view (a preset or the viewer's own) shows before this
    // page's own changes: a chip's dot. Saving or resetting the view is
    // the View panel's (the operator, 17 Nov: "what is this save / reset
    // business? maybe belongs in the view panel?").
    base: Spec
    fields: Field[]
    values: Record<string, string[]>
    onchange: (spec: Spec) => void
    // The circle the sidebar's lens narrows the rows to, where it does:
    // its scope is a chip like any filter's (the operator, 17 Nov: "should
    // this be a filter?"), "Circle is <name>", plain since it comes from
    // where the reader is; removing it reads every circle's rows
    // (`across`), and the Filter menu offers it back.
    lens?: string | null
  } = $props()

  const scoped = $derived(!!lens && !spec.across)
  const scopeChanged = $derived(!!spec.across !== !!base.across)

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
  // A chip reads field, operator, value. The operator is the one the
  // field's kind has by default: "is" for one value and "is any of" for
  // several, "in" for a date's month or year. The query model has no
  // others, so a date's operator word opens the same choice its value
  // does, month or year.
  const op = (key: string) => {
    const w = on(key)
    return !w ? 'is' : 'within' in w ? 'in' : w.is.length > 1 ? 'is any of' : 'is'
  }
  const said = (key: string) => {
    const w = on(key)
    return !w ? 'any' : 'is' in w ? w.is.map((v) => named(key, v)).join(', ') : w.within === 'month' ? 'this month' : 'this year'
  }

  const same = (a: Where | undefined, b: Where | undefined) => JSON.stringify(a && canon(a)) === JSON.stringify(b && canon(b))
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
    if (!w) {
      state.refocus()
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
    }
    state.adding = key
  }

  const labelled = (f: { label: string; type?: string }) => (f.type === 'date' ? `${f.label}, by month` : f.label)

  // A field picked from the menu: it closes, and its condition goes on.
  const shut = (e: MouseEvent) => (e.currentTarget as HTMLElement).closest<HTMLElement>('[popover]')?.hidePopover()

  function pick(e: MouseEvent, key: string) {
    shut(e)
    add(key)
  }

  function openSearch() {
    state.searching = true
  }

  function searchFromMenu(e: MouseEvent) {
    shut(e)
    openSearch()
  }

  // A blur commits the typed text as the chip, or, with none, folds the
  // search away.
  function closeSearch() {
    state.searching = false
  }

  // Removing the search clears it at once, rather than waiting on the
  // typing's debounce.
  function clearSearch() {
    state.filter = ''
    state.searching = false
    onchange({ ...spec, q: '' })
    state.refocus()
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

<div class="bar">
  <div class="lead">
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
    {/if}
  </div>

  <ul class="chips">
    {#if scoped}
      <li>
        <span class="chip" class:added={scopeChanged}>
          <span class="said-trigger"><span class="said">Circle</span> <span class="op">is</span> <span class="said">{lens}</span>{#if scopeChanged}<span class="changed-dot" aria-hidden="true"></span><span class="visually-hidden">, changed</span>{/if}</span>
          <button type="button" class="remove" aria-label="Read every circle's rows" title="Every circle" onclick={() => onchange({ ...spec, across: true })}><Icon icon={X} /></button>
        </span>
      </li>
    {/if}
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
            {#snippet trigger()}<span class="said">{f.label}</span> <span class="op">{op(f.key)}</span> <span class="said">{said(f.key)}</span>{#if changed(f.key)}<span class="changed-dot" aria-hidden="true"></span><span class="visually-hidden">, changed</span>{/if}{/snippet}
            {#if f.type === 'date'}
              {#each ['month', 'year'] as const as w (w)}
                <button role="menuitemradio" class="item" aria-checked={within(f.key) === w} onclick={() => where(f.key, { field: f.key, within: w })}>
                  {w === 'month' ? 'This month' : 'This year'}{#if within(f.key) === w}<Tick />{/if}
                </button>
              {/each}
            {:else}
              {#each values[f.key] ?? [] as v (v)}
                <button role="menuitemcheckbox" class="item" aria-checked={kept(f.key, v)} data-value={v} onclick={() => toggle(f.key, v)}>
                  <Value value={v} kind={f.kind ?? (f.type === 'enum' ? 'badge' : f.type)} record={f.record} />{#if kept(f.key, v)}<Tick />{/if}
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
          <button type="button" class="said-trigger" data-search-trigger onclick={openSearch}>
            <span class="said">Search <span class="op">contains</span> "{spec.q}"</span>{#if qChanged}<span class="changed-dot" aria-hidden="true"></span><span class="visually-hidden">, changed</span>{/if}
          </button>
          <button type="button" class="remove" aria-label="Remove the search" onclick={clearSearch}><Icon icon={X} /></button>
        </span>
      </li>
    {/if}
  </ul>

  <span class="adder" {@attach captureAdder}>
    <Popover label="Filter by a field" button>
      {#snippet trigger()}<Icon icon={Funnel} /><span>Filter</span>{/snippet}
      <button type="button" role="menuitem" class="item field" data-search onclick={searchFromMenu}><Icon icon={MagnifyingGlass} /><span>Search</span><kbd>/</kbd></button>
      <hr />
      {#if lens && !scoped}
        <button type="button" role="menuitem" class="item field" onclick={() => onchange({ ...spec, across: false })}><Icon icon={glyphs.circle} /><span>Circle: {lens}</span></button>
      {/if}
      {#each offered as f (f.key)}
        <button type="button" role="menuitem" class="item field" data-field={f.key} onclick={(e) => pick(e, f.key)}><Icon icon={glyph(f.kind)} /><span>{labelled(f)}</span></button>
      {:else}
        <span class="none">Every field is filtered</span>
      {/each}
    </Popover>
  </span>
</div>

<style>
  .bar {
    --bar-h: 1.75rem;
    display: flex;
    align-items: center;
    gap: var(--space-2);
    min-width: 0;
  }
  /* One line at one height, whether empty, holding chips or searching,
     so nothing under it moves. */
  .bar {
    box-sizing: border-box;
    width: 100%;
    height: calc(var(--bar-h) + 2 * var(--space-1));
    flex: none;
    /* The ends sit where the rows' and the group bars' text does, and the
       line closes up on the header above and the rows below, over the
       content's own padding and gap. */
    padding: var(--space-1) var(--space-3);
    margin-block: calc(-1 * var(--space-2)) calc(var(--space-2) - var(--space-4));
  }
  .chips {
    display: flex;
    height: 100%;
    flex-wrap: nowrap;
    align-items: center;
    gap: var(--space-1);
    margin: 0;
    padding: 0;
    list-style: none;
    min-width: 0;
    flex: 1 1 0;
    overflow-x: auto;
    scrollbar-width: none;
  }
  .chips li {
    flex: none;
  }
  /* The chips sit against the Filter pill, the first taking the room
     left over, which a scrolling row gives up. */
  .chips li:first-child {
    margin-inline-start: auto;
  }
  .chip {
    display: flex;
    align-items: center;
    flex: none;
    height: var(--bar-h);
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
    line-height: var(--bar-h);
    font-size: var(--text-xs);
  }
  .said-trigger {
    display: flex;
    align-items: center;
    gap: var(--space-1);
    padding-inline-start: var(--space-2);
    border: none;
    background: none;
    line-height: var(--bar-h);
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
  .changed-dot {
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
    width: calc(var(--bar-h) - 4px);
    height: calc(var(--bar-h) - 4px);
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
  /* The Filter menu's items: the icon, the name, and Search's key at the
     end. */
  .field {
    justify-content: flex-start;
  }
  .field :global(svg) {
    flex: none;
    color: var(--text-muted);
  }
  .field kbd {
    margin-inline-start: auto;
    padding: 0 0.3em;
    border-radius: 4px;
    background: oklch(0.5 0 0 / 12%);
    font-family: var(--font-ui);
    font-size: var(--text-2xs);
    color: var(--text-muted);
  }
  hr {
    margin: var(--space-1) var(--space-2);
    border: none;
    border-top: 1px solid var(--line);
  }
  /* Search, while typed, at the bar's start; the chips, then the Filter
     pill, at its end. */
  .lead {
    display: flex;
    align-items: center;
    gap: var(--space-1);
    flex: none;
    min-width: 0;
  }
  .lead {
    flex: 0 1 auto;
  }
  .adder {
    flex: none;
  }
  /* Quieter than the field and the value either side of it, never so
     quiet the chip's own accent-text falls under AA. */
  .op {
    opacity: 0.9;
  }
  .search {
    flex: 0 1 11rem;
    min-width: 6rem;
    width: 11rem;
    height: var(--bar-h);
    padding: 0 var(--space-2);
    border: 1px solid var(--line);
    border-radius: var(--radius-control);
    background: var(--sunk);
    color: var(--text);
    font-size: var(--text-sm);
  }
  .adder :global(.trigger) {
    width: auto;
    height: var(--bar-h);
    padding: 0 var(--space-2);
    gap: var(--space-1);
    border: 1px dashed color-mix(in oklab, var(--line) 60%, transparent);
    border-radius: var(--radius-pill);
    background: none;
    color: var(--text-subtle);
    font-size: var(--text-xs);
    cursor: pointer;
  }
  .adder :global(.trigger:hover) {
    background: var(--hover);
    color: var(--text);
  }
  .none {
    padding: var(--space-1) var(--space-2);
    font-size: var(--text-sm);
    color: var(--text-muted);
  }
</style>
