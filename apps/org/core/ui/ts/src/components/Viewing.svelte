<script lang="ts">
  import Rows from 'phosphor-svelte/lib/Rows'
  import TableIcon from 'phosphor-svelte/lib/Table'
  import ChartBar from 'phosphor-svelte/lib/ChartBar'
  import SquaresFour from 'phosphor-svelte/lib/SquaresFour'
  import Kanban from 'phosphor-svelte/lib/Kanban'
  import CalendarDots from 'phosphor-svelte/lib/CalendarDots'
  import Check from 'phosphor-svelte/lib/Check'
  import SortAscending from 'phosphor-svelte/lib/SortAscending'
  import SortDescending from 'phosphor-svelte/lib/SortDescending'
  import PushPin from 'phosphor-svelte/lib/PushPin'
  import PushPinSlash from 'phosphor-svelte/lib/PushPinSlash'
  import type { Column } from '../models/view.ts'
  import { spans } from '../models/calendar.ts'
  import { show } from '../models/format.ts'
  import { arranged, filtering, groupable, laned, type Custom, type Field, type Layout, type Pin, type Result, type Spec, type Where, type Widget } from '../models/query.ts'
  import { reorder } from '../models/drag.ts'
  import { marks } from '../marks.ts'
  import { sortable } from '../attachments/sortable.ts'
  import { useCollection } from '../hooks/useCollection.ts'
  import { useDrag } from '../hooks/useDrag.ts'
  import { useShell } from '../hooks/useShell.ts'
  import { usePinned } from '../hooks/usePinned.ts'
  import { useViews } from '../hooks/useViews.ts'
  import Button from './Button.svelte'
  import Checkbox from './Checkbox.svelte'
  import Card from './Card.svelte'
  import DragHandle from './DragHandle.svelte'
  import DropIndicator from './DropIndicator.svelte'
  import Icon from './Icon.svelte'
  import Person from './Person.svelte'
  import Popover from './Popover.svelte'
  import Select from './Select.svelte'
  import Widgets from './Widgets.svelte'

  // The drawer's View panel, of one shape for every collection, as
  // Linear's display menu: the layout on top, the text filter, then the
  // same rows in the same order, each a label and a dropdown, Group by,
  // Order by and Filter, the conditions under it as chips; then Display,
  // a popover of what is shown, and Circles, whether the view reads the
  // lens's circle or every circle the reader reads; then saving what is
  // shown as the viewer's own view, or, on one of theirs, its name, its
  // changes and its removal, and pinning the open view under Pinned. What
  // the collection offers lives only inside the dropdowns and popovers,
  // and a row the layout has no use for is disabled, never dropped. A
  // change hands the whole spec on to the collection, which puts it in
  // the address.
  let {
    name,
    spec,
    fields,
    columns,
    titled,
    values,
    dashboard,
    shown,
    choices,
    grouped,
    placing,
    declared = null,
    opened,
    custom,
    dirty,
    pin = null,
    whole = false,
    onchange,
    onsave,
    onremove,
  }: {
    name: string
    spec: Spec
    fields: Field[]
    columns: Column[]
    titled: Column
    // Each field's values: an enumeration's over every row, and
    // another's over the rows the view's other conditions keep, where
    // they number a handful, what Filter offers.
    values: Record<string, string[]>
    dashboard: { custom: boolean; widgets: Widget[]; results: Result[]; errors: string[] } | null
    // The fields the layout shows, a list's or its cards', and
    // those Display offers; and the board's enumeration, person or circle.
    shown: Column[]
    choices: Column[]
    grouped?: string
    // The date a calendar places the rows by.
    placing?: string
    // The field the collection's read orders by first, and which way,
    // and what the view showed as it was opened: Order by's default.
    declared?: { key: string; dir: 'ascending' | 'descending' } | null
    opened?: Spec
    custom?: Custom
    dirty: boolean
    // The open view as Pinned holds it, and whether the lens leaves the
    // collection whole, its rows naming no circle that owns them.
    pin?: Pin | null
    whole?: boolean
    onchange: (spec: Spec) => void
    onsave: (view: Custom) => void
    onremove: () => void
  } = $props()

  const id = $props.id()
  const state = useCollection()
  const views = useViews(() => name)
  const shell = useShell()
  const pinned = usePinned()
  // Circles chooses only where a lens narrows the rows.
  const narrowed = $derived(!!shell.lens && !whole)

  const groups = $derived(fields.filter(groupable))
  const lanes = $derived(fields.filter(laned))
  const dates = $derived(fields.filter((f) => f.type === 'date'))
  // A board only where a field is one it groups by, an enumeration, a
  // person or a circle, a calendar only where one is a date.
  const layouts: { id: Layout; label: string; icon: typeof Rows }[] = $derived(
    [
      { id: 'list' as const, label: 'List', icon: Rows },
      { id: 'table' as const, label: 'Table', icon: TableIcon },
      { id: 'gallery' as const, label: 'Gallery', icon: SquaresFour },
      { id: 'board' as const, label: 'Board', icon: Kanban },
      { id: 'calendar' as const, label: 'Calendar', icon: CalendarDots },
      { id: 'dashboard' as const, label: 'Dashboard', icon: ChartBar },
    ].filter((l) => (l.id !== 'board' || lanes.length > 0) && (l.id !== 'calendar' || dates.length > 0)),
  )
  const showing = $derived(new Set(shown.map((c) => c.key)))
  const hidden = $derived(new Set(spec.hide))
  const ordered = $derived(arranged(columns, spec.order))
  const drag = useDrag()

  // Order by's default, marked quietly in its options: the order the
  // view opened with, else the field the collection's read leads with,
  // else the rows as listed. The select names only the field; the button
  // before it, which way.
  const fallback = $derived(declared && columns.some((c) => c.key === declared.key) ? { field: declared.key, dir: declared.dir === 'descending' ? ('desc' as const) : ('asc' as const) } : null)
  const initial = $derived(opened?.sort ?? null)
  const standing = $derived(initial ?? fallback)
  const sorted = $derived(spec.sort ?? fallback)
  const descending = $derived(sorted?.dir === 'desc')
  const orders = $derived([
    ...(fallback ? [] : [{ value: '', label: 'As listed', default: !standing }]),
    ...columns.map((c) => ({ value: c.key, label: c.label, default: c.key === standing?.field })),
  ])
  // A field chosen keeps the direction the toggle shows; the collection's
  // own order, where the view opened with no sort of its own, is no sort.
  function order(key: string) {
    const dir = sorted?.dir ?? 'asc'
    change({ sort: !key || (!initial && key === fallback?.field && dir === fallback.dir) ? null : { field: key, dir } })
  }

  // What a condition may be put on: a date, or any field with a handful
  // of values to choose from, a person's and a circle's among them; each
  // once.
  const conditioned = $derived([...spec.where.map((w) => w.field), ...(state.adding && !spec.where.some((w) => w.field === state.adding) ? [state.adding] : [])])
  const offered = $derived(fields.filter((f) => filtering(f, values[f.key]) && !conditioned.includes(f.key)))
  const typed = (key: string) => fields.find((f) => f.key === key)
  const conditions = $derived(conditioned.map(typed).filter((f) => f !== undefined))

  // What a row of the panel shows in its Display popover, by layout.
  const display = $derived(
    spec.layout === 'table' ? `${columns.filter((c) => c === titled || !hidden.has(c.key)).length} columns`
    : spec.layout === 'list' ? `${shown.length} fields`
    : spec.layout === 'gallery' || spec.layout === 'board' || spec.layout === 'calendar' ? `${shown.length} card fields`
    : spec.layout === 'dashboard' && dashboard ? `${dashboard.widgets.length} widgets`
    : null,
  )

  const change = (s: Partial<Spec>) => onchange({ ...spec, q: state.filter, ...s })

  // Fields and columns as a select's options; a date groups by its
  // month.
  const as = (fs: { key: string; label: string; type?: string }[]) => fs.map((f) => ({ value: f.key, label: f.type === 'date' ? `${f.label}, by month` : f.label }))
  const none = { value: '', label: 'None' }

  function card(key: string, on: boolean) {
    change({ cards: choices.filter((c) => (c.key === key ? on : showing.has(c.key))).map((c) => c.key) })
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

  // A field chosen to filter on: a date keeps this month at once, any
  // other opens its chip's popover to pick the values it keeps.
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

<!-- The fields a list shows after each row's title, or a
     gallery's, a board's or a calendar's cards. -->
{#snippet cards()}
  <fieldset class="columns">
    <legend class="label">{spec.layout === 'list' ? 'Fields' : 'Card fields'}</legend>
    <ul>
      {#each choices as c (c.key)}
        <li>
          <Checkbox checked={showing.has(c.key)} onchange={(on) => card(c.key, on)}>{c.label}</Checkbox>
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
    <input bind:this={state.search} bind:value={state.filter} placeholder="Search" aria-label="Search" />
    <kbd>/</kbd>
  </div>

  <div class="rows">
    <span class="label" id="{id}-group">Group by</span>
    <div class="control">
      {#if spec.layout === 'board'}
        <Select fit labelledby="{id}-group" options={as(lanes)} bind:value={() => grouped ?? '', (v) => change({ by: v })} />
      {:else if spec.layout === 'calendar'}
        <Select fit labelledby="{id}-group" options={as(dates)} bind:value={() => placing ?? '', (v) => change({ on: v })} />
        <Select
          fit
          label="Span"
          options={spans.map((s) => ({ value: s, label: s === 'month' ? 'Month' : 'Week' }))}
          bind:value={() => spec.span ?? '', (v) => change({ span: v as Spec['span'] })}
        />
        <Select fit label="Colour by" options={[none, ...as(lanes)]} bind:value={() => spec.by ?? '', (v) => change({ by: v || null })} />
      {:else if spec.layout === 'dashboard'}
        <Select fit labelledby="{id}-group" options={[none]} disabled />
      {:else}
        <Select fit labelledby="{id}-group" options={[none, ...as(groups)]} bind:value={() => spec.by ?? '', (v) => change({ by: v || null })} />
      {/if}
    </div>

    <span class="label" id="{id}-order">Order by</span>
    <!-- The direction before the field, so every control ends on the
         panel's one right edge; the two never wrap apart. -->
    <div class="control order">
      <button
        class="direction"
        aria-label={descending ? 'Descending' : 'Ascending'}
        title={descending ? 'Descending' : 'Ascending'}
        disabled={!sorted || spec.layout === 'dashboard'}
        onclick={() => sorted && change({ sort: { field: sorted.field, dir: descending ? 'asc' : 'desc' } })}
      >
        <Icon icon={descending ? SortDescending : SortAscending} />
      </button>
      <Select fit labelledby="{id}-order" options={orders} disabled={spec.layout === 'dashboard'} bind:value={() => sorted?.field ?? '', (key) => order(key)} />
    </div>

    <span class="label" id="{id}-filter">Filter</span>
    <div class="control">
      <!-- An action more than a value: choosing a field adds its condition
           and the select reads Add a condition again. -->
      <Select
        fit
        labelledby="{id}-filter"
        placeholder="Add a condition"
        options={as(offered)}
        disabled={offered.length === 0}
        bind:value={() => '', (key) => key && add(key)}
      />
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
                <button role="menuitemcheckbox" class="item" aria-checked={kept(f.key, v)} data-value={v} onclick={() => toggle(f.key, v)}>
                  {#if f.type === 'person'}<Person address={v} />{:else}<span class="said">{named(f.key, v)}</span>{/if}{#if kept(f.key, v)}<Icon icon={Check} />{/if}
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
                    <Checkbox checked={c === titled || !hidden.has(c.key)} disabled={c === titled} onchange={(on) => hide(c.key, !on)}>{c.label}</Checkbox>
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
        <Select fit labelledby="{id}-display" options={[{ value: '', label: 'As listed' }]} disabled />
      {/if}
    </div>

    <!-- What the view reads: the lens's circle, or every circle's rows
         the reader reads; with no lens, or where the lens leaves the
         collection whole, it already reads every circle. -->
    <span class="label" id="{id}-circles">Circles</span>
    <div class="control">
      <Select
        fit
        labelledby="{id}-circles"
        options={[
          { value: 'this', label: 'This circle' },
          { value: 'every', label: 'Every circle' },
        ]}
        disabled={!narrowed}
        bind:value={() => (narrowed && !spec.across ? 'this' : 'every'), (v) => change({ across: v === 'every' })}
      />
    </div>
  </div>

  <!-- The foot, one row: Save, only once the view differs from what it
       opened as, which keeps a viewer's own view's changes or, on a
       preset, names a new view of the viewer's; then Pin, which pins the
       open view under Pinned in the sidebar, or unpins it; and, on a view
       of the viewer's own, its removal. Its name edits above them. -->
  <div class="saving">
    {#if custom}
      <label class="option">
        <span class="label">Name</span>
        <input value={custom.name} onchange={(e) => views.rename(custom.id, e.currentTarget.value)} aria-label="View name" />
      </label>
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
    {:else}
      <div class="foot">
        {#if dirty}
          <Button tone="primary" onclick={() => (custom ? views.update(custom.id, { ...spec, q: state.filter }) : (views.naming = true))}>Save</Button>
        {/if}
        {#if pin}
          {const on = $derived(pinned.pinned(pin.collection, pin.view))}
          <Button onclick={() => pin && (on ? pinned.unpin(pin.collection, pin.view) : pinned.pin(pin))}>
            <Icon icon={on ? PushPinSlash : PushPin} />{on ? 'Unpin' : 'Pin'}
          </Button>
        {/if}
        {#if custom}
          <span class="end"><Button tone="danger" onclick={onremove}>Delete</Button></span>
        {/if}
      </div>
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
    flex-wrap: wrap;
    justify-content: flex-end;
    gap: var(--space-1);
    min-width: 0;
  }
  /* The direction and the field never wrap apart; the field gives way. */
  .order {
    flex-wrap: nowrap;
  }
  .direction {
    display: grid;
    place-items: center;
    flex: none;
    width: 1.9rem;
    border: 1px solid var(--line);
    border-radius: var(--radius-control);
    background: none;
    color: var(--text-muted);
    cursor: pointer;
  }
  .direction:hover:not(:disabled) {
    background: var(--hover);
    color: var(--text);
  }
  .direction:disabled {
    cursor: default;
    opacity: 0.5;
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
  /* The foot's one row: Save and Pin, and a view's Delete at its end. */
  .foot {
    display: flex;
    align-items: center;
    gap: var(--space-2);
  }
  .end {
    margin-inline-start: auto;
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
