<script lang="ts">
  import Rows from 'phosphor-svelte/lib/Rows'
  import TableIcon from 'phosphor-svelte/lib/Table'
  import ChartBar from 'phosphor-svelte/lib/ChartBar'
  import SquaresFour from 'phosphor-svelte/lib/SquaresFour'
  import Kanban from 'phosphor-svelte/lib/Kanban'
  import CalendarDots from 'phosphor-svelte/lib/CalendarDots'
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
  import Widgets from './Widgets.svelte'

  // The drawer's View card, the same for every collection: the text
  // filter, the conditions on the rows, the layout and, in a table, its
  // columns, in a gallery or on a board, its cards' fields, in a
  // calendar, its date, its span and its cards' fields, in a dashboard,
  // its widgets; then saving what is shown as
  // the viewer's own view, or, on one of theirs, its name, its changes
  // and its removal. A change hands the whole spec on to the collection,
  // which puts it in the address.
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
    custom?: Custom
    dirty: boolean
    onchange: (spec: Spec) => void
    onsave: (view: Custom) => void
    onremove: () => void
  } = $props()

  const state = useCollection()
  const views = useViews(() => name)

  const groups = $derived(fields.filter((f) => f.type === 'enum'))
  // A board only where a field enumerates what it groups by, a calendar
  // only where one is a date.
  const layouts: { id: Layout; label: string; icon: typeof Rows }[] = $derived(
    [
      { id: 'list' as const, label: 'List', icon: Rows },
      { id: 'table' as const, label: 'Table', icon: TableIcon },
      { id: 'gallery' as const, label: 'Gallery', icon: SquaresFour },
      { id: 'board' as const, label: 'Board', icon: Kanban },
      { id: 'calendar' as const, label: 'Calendar', icon: CalendarDots },
      { id: 'dashboard' as const, label: 'Dashboard', icon: ChartBar },
    ].filter((l) => (l.id !== 'board' || groups.length > 0) && (l.id !== 'calendar' || dates.length > 0)),
  )
  const enums = $derived(fields.filter((f) => f.type === 'enum' && (values[f.key]?.length ?? 0) > 1))
  const showing = $derived(new Set(shown.map((c) => c.key)))

  function card(key: string, on: boolean) {
    const keys = columns.filter((c) => c !== titled && (c.key === key ? on : showing.has(c.key))).map((c) => c.key)
    onchange({ ...spec, q: state.filter, cards: keys })
  }
  const dates = $derived(fields.filter((f) => f.type === 'date'))
  const hidden = $derived(new Set(spec.hide))
  const ordered = $derived(arranged(columns, spec.order))
  const drag = useDrag()

  const on = (key: string) => spec.where.find((w) => w.field === key)
  const kept = (key: string, v: string) => {
    const w = on(key)
    return !!w && 'is' in w && w.is.includes(v)
  }
  const within = (key: string) => {
    const w = on(key)
    return w && 'within' in w ? w.within : ''
  }

  function where(key: string, w: Where | undefined) {
    const rest = spec.where.filter((x) => x.field !== key)
    onchange({ ...spec, q: state.filter, where: w ? [...rest, w] : rest })
  }

  function toggle(key: string, v: string) {
    const w = on(key)
    const is = w && 'is' in w ? w.is : []
    const next = is.includes(v) ? is.filter((x) => x !== v) : [...is, v]
    where(key, next.length ? { field: key, is: next } : undefined)
  }

  function hide(key: string, off: boolean) {
    const keys = new Set(hidden)
    if (off) {
      keys.add(key)
    } else {
      keys.delete(key)
    }
    onchange({ ...spec, q: state.filter, hide: [...keys] })
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
  <div class="filter">
    <input bind:this={state.search} bind:value={state.filter} placeholder="Filter" aria-label="Filter" />
    <kbd>/</kbd>
  </div>

  {#each enums as f (f.key)}
    <fieldset class="where">
      <legend class="label">{f.label}</legend>
      <div class="chips">
        {#each values[f.key] as v (v)}
          <button class="chip" class:on={kept(f.key, v)} aria-pressed={kept(f.key, v)} onclick={() => toggle(f.key, v)}>{v}</button>
        {/each}
      </div>
    </fieldset>
  {/each}
  {#each dates as f (f.key)}
    <label class="option">
      <span class="label">{f.label}</span>
      <select
        value={within(f.key)}
        onchange={(e) => {
          const v = e.currentTarget.value
          where(f.key, v === 'month' || v === 'year' ? { field: f.key, within: v } : undefined)
        }}
      >
        <option value="">any time</option>
        <option value="month">this month</option>
        <option value="year">this year</option>
      </select>
    </label>
  {/each}

  <div class="option">
    <span class="label">Layout</span>
    <div class="views" role="group" aria-label="Layout">
      {#each layouts as l (l.id)}
        <button
          class:on={spec.layout === l.id}
          aria-pressed={spec.layout === l.id}
          aria-label={l.label}
          title={l.label}
          onclick={() => onchange({ ...spec, q: state.filter, layout: l.id })}
        >
          <Icon icon={l.icon} />
        </button>
      {/each}
    </div>
  </div>

  {#if spec.layout === 'table'}
    <fieldset class="columns">
      <legend class="label">Columns</legend>
      <ul
        {@attach sortable(drag, {
          list: 'columns',
          label: (i) => ordered[i]?.label ?? 'column',
          onmove: (from, to) => onchange({ ...spec, q: state.filter, order: reorder(ordered, from, to).map((c) => c.key) }),
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
  {:else if spec.layout === 'gallery' || spec.layout === 'board'}
    {#if spec.layout === 'board'}
      <label class="option">
        <span class="label">Group by</span>
        <select value={grouped} onchange={(e) => onchange({ ...spec, q: state.filter, by: e.currentTarget.value })}>
          {#each groups as f (f.key)}<option value={f.key}>{f.label}</option>{/each}
        </select>
      </label>
    {/if}
    {@render cards()}
  {:else if spec.layout === 'calendar'}
    <label class="option">
      <span class="label">Date</span>
      <select value={placing} onchange={(e) => onchange({ ...spec, q: state.filter, on: e.currentTarget.value })}>
        {#each dates as f (f.key)}<option value={f.key}>{f.label}</option>{/each}
      </select>
    </label>
    <div class="option">
      <span class="label">Span</span>
      <div class="views" role="group" aria-label="Span">
        {#each spans as s (s)}
          <button class="span" class:on={spec.span === s} aria-pressed={spec.span === s} onclick={() => onchange({ ...spec, q: state.filter, span: s })}>
            {s === 'month' ? 'Month' : 'Week'}
          </button>
        {/each}
      </div>
    </div>
    {@render cards()}
  {:else if spec.layout === 'dashboard' && dashboard}
    <Widgets
      widgets={dashboard.widgets}
      {fields}
      {values}
      custom={dashboard.custom}
      onchange={(ws) => onchange({ ...spec, q: state.filter, widgets: ws })}
    />
  {/if}

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
  .option {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--space-3);
  }
  .option select,
  .option input {
    width: auto;
    max-width: 11rem;
  }
  .label {
    font-size: var(--text-sm);
    color: var(--text-muted);
  }
  fieldset {
    margin: 0;
    padding: 0;
    border: none;
    display: grid;
    gap: var(--space-1);
  }
  legend {
    padding: 0 0 var(--space-1);
  }
  .chips {
    display: flex;
    flex-wrap: wrap;
    gap: var(--space-1);
  }
  .chip {
    border: none;
    border-radius: var(--radius-pill);
    padding: 0 var(--space-2);
    line-height: 1.6rem;
    font-size: var(--text-xs);
    background: var(--sunk);
    color: var(--text-muted);
    cursor: pointer;
    max-width: 100%;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .chip:hover {
    color: var(--text);
  }
  .chip.on {
    background: var(--accent-soft);
    color: var(--accent-text);
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
    width: 2rem;
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
  .views button.span {
    width: auto;
    padding: 0 var(--space-2);
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
