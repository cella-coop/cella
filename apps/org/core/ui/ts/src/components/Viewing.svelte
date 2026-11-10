<script lang="ts">
  import Rows from 'phosphor-svelte/lib/Rows'
  import TableIcon from 'phosphor-svelte/lib/Table'
  import ChartBar from 'phosphor-svelte/lib/ChartBar'
  import SquaresFour from 'phosphor-svelte/lib/SquaresFour'
  import Kanban from 'phosphor-svelte/lib/Kanban'
  import CalendarDots from 'phosphor-svelte/lib/CalendarDots'
  import ClockCounterClockwise from 'phosphor-svelte/lib/ClockCounterClockwise'
  import Check from 'phosphor-svelte/lib/Check'
  import type { Column } from '../models/view.ts'
  import { spans } from '../models/calendar.ts'
  import { arranged, type Custom, type Field, type Layout, type Result, type Spec, type Where, type Widget } from '../models/query.ts'
  import { reorder } from '../models/drag.ts'
  import { marks } from '../marks.ts'
  import { sortable } from '../attachments/sortable.ts'
  import { useCollection } from '../hooks/useCollection.ts'
  import { useDrag } from '../hooks/useDrag.ts'
  import { useViews } from '../hooks/useViews.ts'
  import Button from './Button.svelte'
  import Card from './Card.svelte'
  import DragHandle from './DragHandle.svelte'
  import DropIndicator from './DropIndicator.svelte'
  import Icon from './Icon.svelte'
  import Popover from './Popover.svelte'
  import Widgets from './Widgets.svelte'

  // The drawer's View panel, of one shape for every collection, as
  // Linear's display menu: the layout on top, the text filter, then the
  // same rows in the same order, each a label and a dropdown, Group by,
  // Order by and Filter, the conditions under it as chips; then Display,
  // a popover of what is shown; then saving what is shown as the
  // viewer's own view, or, on one of theirs, its name, its changes and
  // its removal. What the collection offers lives only inside the
  // dropdowns and popovers, and a row the layout has no use for is
  // disabled, never dropped. A change hands the whole spec on to the
  // collection, which puts it in the address.
  let {
    name,
    spec,
    fields,
    columns,
    titled,
    values,
    dashboard,
    shown,
    grouped,
    placing,
    sorted = null,
    custom,
    dirty,
    onchange,
    onsave,
    onremove,
  }: {
    name: string
    spec: Spec
    fields: Field[]
    columns: Column[]
    titled: Column
    values: Record<string, string[]>
    dashboard: { custom: boolean; widgets: Widget[]; results: Result[]; errors: string[] } | null
    // The fields a gallery's or a board's cards show, and the board's
    // enumeration.
    shown: Column[]
    grouped?: string
    // The date a calendar places the rows by.
    placing?: string
    // The field the collection's read orders by first, and which way.
    sorted?: { key: string; dir: 'ascending' | 'descending' } | null
    custom?: Custom
    dirty: boolean
    onchange: (spec: Spec) => void
    onsave: (view: Custom) => void
    onremove: () => void
  } = $props()

  const id = $props.id()
  const state = useCollection()
  const views = useViews(() => name)

  const groups = $derived(fields.filter((f) => f.type === 'enum'))
  const dates = $derived(fields.filter((f) => f.type === 'date'))
  // A board only where a field enumerates what it groups by, a calendar
  // only where one is a date, and a feed only where one is and a column
  // is a person.
  const layouts: { id: Layout; label: string; icon: typeof Rows }[] = $derived(
    [
      { id: 'list' as const, label: 'List', icon: Rows },
      { id: 'feed' as const, label: 'Feed', icon: ClockCounterClockwise },
      { id: 'table' as const, label: 'Table', icon: TableIcon },
      { id: 'gallery' as const, label: 'Gallery', icon: SquaresFour },
      { id: 'board' as const, label: 'Board', icon: Kanban },
      { id: 'calendar' as const, label: 'Calendar', icon: CalendarDots },
      { id: 'dashboard' as const, label: 'Dashboard', icon: ChartBar },
    ].filter(
      (l) =>
        (l.id !== 'board' || groups.length > 0) &&
        (l.id !== 'calendar' || dates.length > 0) &&
        (l.id !== 'feed' || (dates.length > 0 && columns.some((c) => c.kind === 'person'))),
    ),
  )
  const showing = $derived(new Set(shown.map((c) => c.key)))
  const hidden = $derived(new Set(spec.hide))
  const ordered = $derived(arranged(columns, spec.order))
  const drag = useDrag()

  // The orders the collection's read offers: its own, a field and its
  // direction where it leads with one.
  const orders = $derived.by(() => {
    const c = sorted && columns.find((c) => c.key === sorted.key)
    return [c ? `${c.label}, ${sorted?.dir}` : 'As kept']
  })

  // What a condition may be put on: an enumeration with a choice of
  // values, or a date; each once.
  const conditioned = $derived([...spec.where.map((w) => w.field), ...(state.adding && !spec.where.some((w) => w.field === state.adding) ? [state.adding] : [])])
  const offered = $derived(fields.filter((f) => (f.type === 'date' || (f.type === 'enum' && (values[f.key]?.length ?? 0) > 1)) && !conditioned.includes(f.key)))
  const typed = (key: string) => fields.find((f) => f.key === key)
  const conditions = $derived(conditioned.map(typed).filter((f) => f !== undefined))

  // What a row of the panel shows in its Display popover, by layout.
  const display = $derived(
    spec.layout === 'table' ? `${columns.filter((c) => c === titled || !hidden.has(c.key)).length} columns`
    : spec.layout === 'gallery' || spec.layout === 'board' || spec.layout === 'calendar' ? `${shown.length} card fields`
    : spec.layout === 'dashboard' && dashboard ? `${dashboard.widgets.length} widgets`
    : null,
  )

  const change = (s: Partial<Spec>) => onchange({ ...spec, q: state.filter, ...s })

  function card(key: string, on: boolean) {
    change({ cards: columns.filter((c) => c !== titled && (c.key === key ? on : showing.has(c.key))).map((c) => c.key) })
  }

  const on = (key: string) => spec.where.find((w) => w.field === key)
  const kept = (key: string, v: string) => {
    const w = on(key)
    return !!w && 'is' in w && w.is.includes(v)
  }
  const within = (key: string) => {
    const w = on(key)
    return w && 'within' in w ? w.within : ''
  }
  const said = (key: string) => {
    const w = on(key)
    return !w ? 'any' : 'is' in w ? w.is.join(', ') : w.within === 'month' ? 'this month' : 'this year'
  }

  // A condition added keeps its chip while the address catches up; one
  // taken away takes it.
  function where(key: string, w: Where | undefined) {
    if (!w && state.adding === key) {
      state.adding = null
    }
    change({ where: [...spec.where.filter((x) => x.field !== key), ...(w ? [w] : [])] })
  }

  function toggle(key: string, v: string) {
    const w = on(key)
    const is = w && 'is' in w ? w.is : []
    const next = is.includes(v) ? is.filter((x) => x !== v) : [...is, v]
    where(key, next.length ? { field: key, is: next } : undefined)
  }

  // A field chosen to filter on: a date keeps this month at once, an
  // enumeration opens its chip's popover to pick what it keeps.
  function add(key: string) {
    if (typed(key)?.type === 'date') {
      where(key, { field: key, within: 'month' })
    } else {
      state.adding = key
    }
  }

  function hide(key: string, off: boolean) {
    const keys = new Set(hidden)
    if (off) {
      keys.add(key)
    } else {
      keys.delete(key)
    }
    change({ hide: [...keys] })
  }

  function save(e: SubmitEvent) {
    e.preventDefault()
    onsave(views.save({ ...spec, q: state.filter }))
  }
</script>

<!-- The fields a gallery's, a board's or a calendar's cards show. -->
{#snippet cards()}
  <fieldset class="columns">
    <legend class="label">Card fields</legend>
    <ul>
      {#each columns.filter((c) => c !== titled) as c (c.key)}
        <li>
          <label>
            <input type="checkbox" checked={showing.has(c.key)} onchange={(e) => card(c.key, e.currentTarget.checked)} />
            {c.label}
          </label>
        </li>
      {/each}
    </ul>
  </fieldset>
{/snippet}

<Card title="View">
  <div class="views" role="group" aria-label="Layout">
    {#each layouts as l (l.id)}
      <button class:on={spec.layout === l.id} aria-pressed={spec.layout === l.id} aria-label={l.label} title={l.label} onclick={() => change({ layout: l.id })}>
        <Icon icon={l.icon} />
      </button>
    {/each}
  </div>

  <div class="filter">
    <input bind:this={state.search} bind:value={state.filter} placeholder="Filter" aria-label="Filter" />
    <kbd>/</kbd>
  </div>

  <div class="rows">
    <span class="label" id="{id}-group">Group by</span>
    <div class="control">
      {#if spec.layout === 'board'}
        <select aria-labelledby="{id}-group" value={grouped} onchange={(e) => change({ by: e.currentTarget.value })}>
          {#each groups as f (f.key)}<option value={f.key}>{f.label}</option>{/each}
        </select>
      {:else if spec.layout === 'calendar'}
        <select aria-labelledby="{id}-group" value={placing} onchange={(e) => change({ on: e.currentTarget.value })}>
          {#each dates as f (f.key)}<option value={f.key}>{f.label}</option>{/each}
        </select>
        <select aria-label="Span" value={spec.span} onchange={(e) => change({ span: e.currentTarget.value as Spec['span'] })}>
          {#each spans as s (s)}<option value={s}>{s === 'month' ? 'Month' : 'Week'}</option>{/each}
        </select>
      {:else}
        <select aria-labelledby="{id}-group" disabled><option>None</option></select>
      {/if}
    </div>

    <span class="label" id="{id}-order">Order by</span>
    <div class="control">
      <select aria-labelledby="{id}-order" disabled={orders.length < 2 || spec.layout === 'dashboard'}>
        {#each orders as o (o)}<option>{o}</option>{/each}
      </select>
    </div>

    <span class="label" id="{id}-filter">Filter</span>
    <div class="control">
      <select
        aria-labelledby="{id}-filter"
        value=""
        disabled={offered.length === 0}
        onchange={(e) => {
          const key = e.currentTarget.value
          e.currentTarget.value = ''
          if (key) {
            add(key)
          }
        }}
      >
        <option value="">Add a condition</option>
        {#each offered as f (f.key)}<option value={f.key}>{f.label}</option>{/each}
      </select>
    </div>
    {#if conditions.length}
      <div class="chips">
        {#each conditions as f (f.key)}
          <Popover
            label="Condition on {f.label}"
            chip
            open={state.adding === f.key}
            onclose={() => {
              if (state.adding === f.key) {
                state.adding = null
              }
            }}
          >
            {#snippet trigger()}<span class="said">{f.label}: {said(f.key)}</span>{/snippet}
            {#if f.type === 'date'}
              {#each ['month', 'year'] as const as w (w)}
                <button role="menuitemradio" class="item" aria-checked={within(f.key) === w} onclick={() => where(f.key, { field: f.key, within: w })}>
                  {w === 'month' ? 'This month' : 'This year'}{#if within(f.key) === w}<Icon icon={Check} />{/if}
                </button>
              {/each}
            {:else}
              {#each values[f.key] ?? [] as v (v)}
                <button role="menuitemcheckbox" class="item" aria-checked={kept(f.key, v)} onclick={() => toggle(f.key, v)}>
                  <span class="said">{v}</span>{#if kept(f.key, v)}<Icon icon={Check} />{/if}
                </button>
              {/each}
            {/if}
            <hr />
            <button role="menuitem" class="item" onclick={() => where(f.key, undefined)}>Remove</button>
          </Popover>
        {/each}
      </div>
    {/if}

    <span class="label" id="{id}-display">Display</span>
    <div class="control">
      {#if display}
        <Popover label="Display" menu={false} wide={spec.layout === 'dashboard'} button>
          {#snippet trigger()}{display}{/snippet}
          {#if spec.layout === 'table'}
            <fieldset class="columns">
              <legend class="label">Columns</legend>
              <ul
                {@attach sortable(drag, {
                  list: 'columns',
                  label: (i) => ordered[i]?.label ?? 'column',
                  onmove: (from, to) => change({ order: reorder(ordered, from, to).map((c) => c.key) }),
                })}
              >
                {#each ordered as c, i (c.key)}
                  <DropIndicator show={drag.before('columns', i)} />
                  <li data-drag-item="columns" data-drag-index={i}>
                    <DragHandle label={c.label} />
                    <label>
                      <input
                        type="checkbox"
                        checked={c === titled || !hidden.has(c.key)}
                        disabled={c === titled}
                        onchange={(e) => hide(c.key, !e.currentTarget.checked)}
                      />
                      {c.label}
                    </label>
                  </li>
                {/each}
                <DropIndicator show={drag.before('columns', ordered.length)} />
              </ul>
            </fieldset>
          {:else if spec.layout === 'dashboard' && dashboard}
            <Widgets widgets={dashboard.widgets} {fields} {values} custom={dashboard.custom} onchange={(ws) => change({ widgets: ws })} />
          {:else}
            {@render cards()}
          {/if}
        </Popover>
      {:else}
        <select aria-labelledby="{id}-display" disabled><option>As listed</option></select>
      {/if}
    </div>
  </div>

  <div class="saving">
    {#if custom}
      <label class="option">
        <span class="label">Name</span>
        <input value={custom.name} onchange={(e) => views.rename(custom.id, e.currentTarget.value)} aria-label="View name" />
      </label>
      <div class="buttons">
        {#if dirty}
          <Button tone="primary" onclick={() => views.update(custom.id, { ...spec, q: state.filter })}>Save changes</Button>
        {/if}
        <Button onclick={() => (views.naming = true)}>Save as new view</Button>
        <Button tone="danger" onclick={onremove}>Delete view</Button>
      </div>
    {:else if !views.naming}
      <Button onclick={() => (views.naming = true)}>Save as view</Button>
    {/if}
    {#if views.naming}
      <form class="naming" onsubmit={save}>
        <!-- svelte-ignore a11y_autofocus: the form opens to name the view -->
        <input bind:value={views.name} placeholder="Name the view" aria-label="View name" autofocus />
        <div class="marks" role="radiogroup" aria-label="Icon">
          {#each Object.entries(marks) as [key, mark] (key)}
            <button type="button" role="radio" class:on={views.icon === key} aria-checked={views.icon === key} title={key} onclick={() => (views.icon = key)}>
              <Icon icon={mark} />
            </button>
          {/each}
        </div>
        <div class="buttons">
          <Button tone="primary" type="submit">Save view</Button>
          <Button onclick={() => (views.naming = false)}>Cancel</Button>
        </div>
      </form>
    {/if}
  </div>
</Card>

<style>
  .filter {
    position: relative;
  }
  .filter input {
    padding-inline-end: 2rem;
  }
  .filter kbd {
    position: absolute;
    inset-inline-end: var(--space-2);
    top: 50%;
    translate: 0 -50%;
    font-family: var(--font-ui);
    font-size: var(--text-2xs);
    color: var(--text-subtle);
    pointer-events: none;
  }
  /* The rows, a label and its dropdown each, aligned in two columns;
     the conditions' chips span both under Filter. */
  .rows {
    display: grid;
    grid-template-columns: auto minmax(0, 1fr);
    align-items: center;
    gap: var(--space-2) var(--space-3);
  }
  .control {
    display: flex;
    justify-content: flex-end;
    gap: var(--space-1);
    min-width: 0;
  }
  .control select {
    width: auto;
    max-width: 11rem;
    min-width: 0;
  }
  .option {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    justify-content: space-between;
    gap: var(--space-1) var(--space-3);
  }
  .option input {
    width: auto;
    max-width: 11rem;
  }
  .label {
    font-size: var(--text-sm);
    color: var(--text-muted);
  }
  /* A long condition ellipsises in its chip, never pushing the drawer's
     card past its edge. */
  .chips {
    grid-column: 1 / -1;
    display: flex;
    flex-wrap: wrap;
    gap: var(--space-1);
    min-width: 0;
  }
  .said {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    min-width: 0;
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
  hr {
    margin: var(--space-1) 0;
    border: none;
    border-top: 1px solid var(--line);
  }
  fieldset {
    margin: 0;
    padding: 0;
    border: none;
    display: grid;
    grid-template-columns: minmax(0, 1fr);
    gap: var(--space-1);
    min-inline-size: 0;
  }
  legend {
    padding: 0 0 var(--space-1);
  }
  .views {
    display: flex;
    background: var(--sunk);
    border-radius: var(--radius-control);
    padding: 2px;
  }
  .views button {
    display: grid;
    place-items: center;
    flex: 1;
    height: 1.75rem;
    padding: 0;
    border: none;
    border-radius: calc(var(--radius-control) - 2px);
    background: none;
    font-size: var(--text-sm);
    color: var(--text-muted);
    cursor: pointer;
  }
  .views button.on {
    background: var(--selected);
    color: var(--text);
  }
  .columns ul {
    list-style: none;
    margin: 0;
    padding: 0;
    display: grid;
    gap: 2px;
  }
  .columns li {
    display: flex;
    align-items: center;
    gap: var(--space-1);
  }
  .columns label {
    display: flex;
    align-items: center;
    gap: var(--space-2);
    font-size: var(--text-sm);
    cursor: pointer;
  }
  .columns input {
    width: auto;
    min-height: 0;
    margin: 0;
    accent-color: var(--accent-fill);
  }
  .saving,
  .naming {
    display: grid;
    gap: var(--space-2);
  }
  .saving {
    padding-top: var(--space-2);
  }
  .buttons {
    display: flex;
    flex-wrap: wrap;
    gap: var(--space-2);
  }
  .marks {
    display: flex;
    flex-wrap: wrap;
    gap: 2px;
  }
  .marks button {
    display: grid;
    place-items: center;
    width: 1.9rem;
    height: 1.9rem;
    border: none;
    border-radius: var(--radius-control);
    background: none;
    color: var(--text-muted);
    cursor: pointer;
  }
  .marks button:hover {
    background: var(--hover);
  }
  .marks button.on {
    background: var(--sunk);
    color: var(--text);
  }
</style>
