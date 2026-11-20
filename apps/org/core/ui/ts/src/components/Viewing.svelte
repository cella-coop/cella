<script lang="ts">
  import Rows from 'phosphor-svelte/lib/Rows'
  import TableIcon from 'phosphor-svelte/lib/Table'
  import ChartBar from 'phosphor-svelte/lib/ChartBar'
  import SquaresFour from 'phosphor-svelte/lib/SquaresFour'
  import Kanban from 'phosphor-svelte/lib/Kanban'
  import CalendarDots from 'phosphor-svelte/lib/CalendarDots'
  import SortAscending from 'phosphor-svelte/lib/SortAscending'
  import SortDescending from 'phosphor-svelte/lib/SortDescending'
  import PushPin from 'phosphor-svelte/lib/PushPin'
    import type { Column } from '../models/view.ts'
  import { spans } from '../models/calendar.ts'
  import { arranged, groupable, laned, type Custom, type Field, type Layout, type Pin, type Result, type Spec, type Widget } from '../models/query.ts'
  import { marks } from '../marks.ts'
  import { useCollection } from '../hooks/useCollection.ts'
  import { useShell } from '../hooks/useShell.ts'
  import { usePinned } from '../hooks/usePinned.ts'
  import { useViews } from '../hooks/useViews.ts'
  import { Plus } from '../icons.ts'
  import Button from './Button.svelte'
  import { verb } from '../verbs.ts'
  import Checkbox from './Checkbox.svelte'
  import Chip from './Chip.svelte'
  import Card from './Card.svelte'
  import Icon from './Icon.svelte'
  import Popover from './Popover.svelte'
  import Segmented from './Segmented.svelte'
  import Select from './Select.svelte'
  import Widgets from './Widgets.svelte'

  // The drawer's View panel, of one shape for every collection, as
  // Linear's display menu: the layout on top, then the same rows in the
  // same order, each a label and a dropdown, Group by, Order by and
  // Display, a popover of what is shown, and Circles, whether the view
  // reads the lens's circle or every circle the reader reads; then, on one of
  // the viewer's own, its name and its removal; the pin of the open view
  // under Pinned is an icon in the corner. Dashboard is not a layout it
  // offers. Filtering, and Save, are the filter bar's,
  // on the line above the collection (`FilterBar`). What the collection
  // offers lives only inside the dropdowns and popovers, and a row the
  // layout has no use for is disabled, never dropped. A change hands the
  // whole spec on to the collection, which puts it in the address.
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
    swimlane,
    placing,
    declared = null,
    opened,
    custom,
    pin = null,
    whole = false,
    onchange,
    onsave,
    onremove,
    changed = false,
    keep,
    discard,
  }: {
    name: string
    spec: Spec
    fields: Field[]
    columns: Column[]
    titled: Column
    // Each field's values, over every row: a dashboard widget's choices
    // over an enumeration (the filter bar reads the same values for its
    // own conditions).
    values: Record<string, string[]>
    dashboard: { custom: boolean; widgets: Widget[]; results: Result[]; errors: string[] } | null
    // The fields the layout shows, a list's or its cards', and
    // those Display offers; and the board's enumeration, person or circle.
    shown: Column[]
    choices: Column[]
    // A board's columns: the enumeration, person or circle its rows are
    // drawn under; always resolved, even where the view names none of
    // its own, migrated from `by` (`grouping`).
    grouped?: string
    // A board's swimlanes: the field its rows group by, resolved, or
    // undefined for a single lane.
    swimlane?: string
    // The date a calendar places the rows by.
    placing?: string
    // The field the collection's read orders by first, and which way,
    // and what the view showed as it was opened: Order by's default.
    declared?: { key: string; dir: 'ascending' | 'descending' } | null
    opened?: Spec
    custom?: Custom
    // The open view as Pinned holds it, and whether the lens leaves the
    // collection whole, its rows naming no circle that owns them.
    pin?: Pin | null
    whole?: boolean
    onchange: (spec: Spec) => void
    onsave: (view: Custom) => void
    onremove: () => void
    // Whether this page has changed the open view since it was opened (a
    // filter, a search, a layout), and what keeps or drops those changes:
    // the view's own Save and Reset, here rather than in the filter bar.
    changed?: boolean
    keep?: () => void
    discard?: () => void
  } = $props()

  const id = $props.id()
  const state = useCollection()
  const views = useViews(() => name)
  const shell = useShell()
  const pinned = usePinned()

  const groups = $derived(fields.filter((f) => groupable(f, values[f.key] ?? [])))
  const lanes = $derived(fields.filter((f) => laned(f, values[f.key] ?? [])))
  const dates = $derived(fields.filter((f) => f.type === 'date'))
  // Dashboard is not offered; a view already laid out as one keeps it
  // shown, and keeps rendering as it does.
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
    ].filter((l) => (l.id !== 'dashboard' || spec.layout === 'dashboard') && (l.id !== 'board' || lanes.length > 0) && (l.id !== 'calendar' || dates.length > 0)),
  )
  const showing = $derived(new Set(shown.map((c) => c.key)))
  const hidden = $derived(new Set(spec.hide))
  const ordered = $derived(arranged(columns, spec.order))

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

  // What Fields shows: the fields drawn, a table's columns or the
  // fields of a list's line or a card, as chips in their order, each
  // removable but a table's title; and those not drawn, which its + adds.
  // A table's columns reorder in its own header (`Table`'s `onmove`).
  // A dashboard's widgets keep their own popover.
  const picks = $derived(
    spec.layout === 'table'
      ? { shown: ordered.filter((c) => c === titled || !hidden.has(c.key)), rest: ordered.filter((c) => c !== titled && hidden.has(c.key)), noun: 'Columns' }
      : spec.layout === 'list' || spec.layout === 'gallery' || spec.layout === 'board' || spec.layout === 'calendar'
        ? { shown: choices.filter((c) => showing.has(c.key)), rest: choices.filter((c) => !showing.has(c.key)), noun: spec.layout === 'list' ? 'Fields' : 'Card fields' }
        : null,
  )
  const widgets = $derived(spec.layout === 'dashboard' && dashboard ? `${dashboard.widgets.length} widgets` : null)

  // A field shown or hidden: a table's by its hidden columns, any other
  // layout's by the fields it shows.
  function shows(key: string, on: boolean) {
    if (spec.layout === 'table') {
      hide(key, !on)
    } else {
      card(key, on)
    }
  }

  const change = (s: Partial<Spec>) => onchange({ ...spec, q: state.filter, ...s })

  // Fields and columns as a select's options; a date groups by its
  // month.
  const as = (fs: { key: string; label: string; type?: string }[]) => fs.map((f) => ({ value: f.key, label: f.type === 'date' ? `${f.label}, by month` : f.label }))
  const none = { value: '', label: 'None' }

  // A board's columns, chosen for the first time: `by` still read as
  // them (`grouped`, `grouping`), so choosing frees it, Grouping opening
  // on None rather than inheriting whatever it named.
  function columned(key: string) {
    change({ columns: key, ...(spec.columns === null ? { by: null } : {}) })
  }

  // A board's swimlane, chosen for the first time, while `columns` is
  // still unset: locks it at what already draws (`grouped`), so it
  // keeps drawing once `by` means the swimlane instead.
  function swimlaned(key: string) {
    change({ by: key || null, ...(key && spec.columns === null ? { columns: grouped ?? null } : {}) })
  }

  function card(key: string, on: boolean) {
    change({ cards: choices.filter((c) => (c.key === key ? on : showing.has(c.key))).map((c) => c.key) })
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

<Card title="View">
  {#snippet actions()}
    {#if pin}
      {const on = $derived(pinned.pinned(pin.collection, pin.view))}
      <button
        type="button"
        class="pin"
        aria-pressed={on}
        aria-label={on ? 'Unpin this view' : 'Pin this view'}
        title={on ? 'Unpin this view' : 'Pin this view'}
        onclick={() => pin && (on ? pinned.unpin(pin.collection, pin.view) : pinned.pin(pin))}
      >
        <Icon icon={PushPin} weight={on ? 'fill' : 'regular'} />
      </button>
    {/if}
  {/snippet}
  <Segmented label="Layout" options={layouts.map((l) => ({ value: l.id, label: l.label, icon: l.icon }))} value={spec.layout} onchange={(id) => change({ layout: id as Layout })} />

  <div class="rows">
    {#if spec.layout === 'board'}
      <!-- A board's columns, above its Grouping, as Linear's: the
           enumeration, person or circle its cards stand in, always
           chosen, never None. -->
      <span class="label" id="{id}-columns">Columns</span>
      <div class="control">
        <Select fit labelledby="{id}-columns" options={as(lanes)} bind:value={() => grouped ?? '', (v) => columned(v)} />
      </div>
    {/if}

    {#if spec.layout === 'calendar'}
      <!-- A calendar groups nothing: it places its rows by a date, shows
           a month or a week, and colours its entries by a field. -->
      <span class="label" id="{id}-date">Date</span>
      <div class="control">
        <Select fit labelledby="{id}-date" options={dates.map((f) => ({ value: f.key, label: f.label }))} bind:value={() => placing ?? '', (v) => change({ on: v })} />
      </div>
      <span class="label" id="{id}-span">Show</span>
      <div class="control">
        <Select
          fit
          labelledby="{id}-span"
          options={spans.map((s) => ({ value: s, label: s === 'month' ? 'Month' : 'Week' }))}
          bind:value={() => spec.span ?? '', (v) => change({ span: v as Spec['span'] })}
        />
      </div>
      <span class="label" id="{id}-colour">Colour by</span>
      <div class="control">
        <Select fit labelledby="{id}-colour" options={[none, ...as(lanes)]} bind:value={() => spec.by ?? '', (v) => change({ by: v || null })} />
      </div>
    {:else}
    <span class="label" id="{id}-group">{spec.layout === 'board' ? 'Grouping' : 'Group by'}</span>
    <div class="control">
      {#if spec.layout === 'board'}
        <!-- None splits the board into a single lane, as it always
             drew; a field splits it into a swimlane per value, each
             holding the whole set of columns. -->
        <Select fit labelledby="{id}-group" options={[none, ...as(lanes)]} bind:value={() => swimlane ?? '', (v) => swimlaned(v)} />
      {:else if spec.layout === 'dashboard'}
        <Select fit labelledby="{id}-group" options={[none]} disabled />
      {:else}
        <Select fit labelledby="{id}-group" options={[none, ...as(groups)]} bind:value={() => spec.by ?? '', (v) => change({ by: v || null })} />
      {/if}
    </div>
    {/if}

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

    {#if !picks}
      <span class="label" id="{id}-display">Display</span>
      <div class="control">
        {#if widgets && dashboard}
          <Popover label="Display" menu={false} wide button>
            {#snippet trigger()}{widgets}{/snippet}
            <Widgets widgets={dashboard.widgets} {fields} {values} custom={dashboard.custom} onchange={(ws) => change({ widgets: ws })} />
          </Popover>
        {:else}
          <Select fit labelledby="{id}-display" options={[{ value: '', label: 'As listed' }]} disabled />
        {/if}
      </div>
    {/if}

  </div>

  {#if picks}
    <!-- Fields, a block of its own under the rows: its label on its own
         line, the fields drawn as chips at the panel's end, wrapping as
         they grow, and Add after the last (the operator, 19 and 20 Nov). -->
    <div class="fields">
      <span class="label" id="{id}-display">Fields</span>
      <ul class="chips" aria-labelledby="{id}-display">
        {#each picks.shown as c (c.key)}
          <li>
            <Chip label={c.label} remove={c === titled ? undefined : { label: `Hide ${c.label}`, onclick: () => shows(c.key, false) }} />
          </li>
        {/each}
        <!-- Add, after the last chip, wrapping as a chip would. -->
        {#if picks.rest.length}
          <li class="add">
            <Popover label="Add a field" menu={false} align="start">
              {#snippet trigger()}<Icon icon={Plus} size="1em" />Add{/snippet}
              <fieldset class="columns">
                <legend class="label">{picks.noun}</legend>
                <ul>
                  {#each picks.rest as c (c.key)}
                    <li>
                      <Checkbox checked={false} onchange={(on) => shows(c.key, on)}>{c.label}</Checkbox>
                    </li>
                  {/each}
                </ul>
              </fieldset>
            </Popover>
          </li>
        {/if}
      </ul>
    </div>
  {/if}

  <!-- The foot, one row: Pin, which pins the open view under Pinned in
       the sidebar, or unpins it; and, on a view of the viewer's own, its
       removal. Its name edits above them; Save is the filter bar's. -->
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
        <div class="buttons" data-run>
          <Button lead={verb('Cancel')} onclick={() => (views.naming = false)}>Cancel</Button>
          <Button lead={verb('Save view')} tone="primary" type="submit">Save view</Button>
        </div>
      </form>
    {:else}
      <div class="foot">
        {#if custom}
          <span class="end"><Button lead={verb('Delete')} tone="danger" onclick={onremove}>Delete</Button></span>
        {/if}
      </div>
    {/if}
  </div>
  {#if changed && keep && discard}
    <div class="unsaved" role="status">
      <span>Unsaved changes</span>
      <span class="keep" data-run>
        <Button lead={verb('Reset')} onclick={discard}>Reset</Button>
        <Button lead={verb('Save')} tone="primary" onclick={keep}>Save</Button>
      </span>
    </div>
  {/if}
</Card>

<style>
  /* The rows, a label and its dropdown each, aligned in two columns. */
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
  /* Fields: its label over the chips, a little apart, which stand at
     the panel's end, as the rows' controls do, and wrap leftward into
     even rows as they grow. */
  .fields {
    display: grid;
    gap: var(--space-2);
  }
  .chips {
    list-style: none;
    margin: 0;
    padding: 0;
    display: flex;
    flex-wrap: wrap;
    justify-content: flex-end;
    align-items: center;
    gap: var(--space-1);
    min-width: 0;
  }
  .chips > li {
    display: inline-flex;
    align-items: center;
    min-width: 0;
  }
  /* Add, a peer of the chips: a chip's height, type, radius and fill
     (`Chip.svelte`), its + before its word, hovered as a quiet button. */
  .add :global(.trigger) {
    width: auto;
    gap: 0.3em;
    padding: 0 0.5em 0 0.3em;
    line-height: 1.65;
    font-size: inherit;
    background: color-mix(in oklab, var(--text) var(--lift), var(--surface));
    color: var(--text);
  }
  .add :global(.trigger:hover) {
    background: var(--hover);
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
  /* Changes this page made to the open view: one quiet line at the panel's
     foot, under a hairline, what keeps or drops them at its end. */
  .unsaved {
    margin-top: var(--space-2);
    padding-top: var(--space-3);
    border-top: 1px solid var(--line);
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--space-2);
    font-size: var(--text-sm);
    color: var(--text-muted);
  }
  .unsaved .keep {
    display: flex;
    gap: var(--space-1);
  }
  /* The pin: icon only, quiet, in the card's top-right corner. */
  .pin {
    display: grid;
    place-items: center;
    width: 1.5rem;
    height: 1.5rem;
    padding: 0;
    border: none;
    border-radius: var(--radius-control);
    background: none;
    color: oklch(var(--shade-5) var(--tone-base));
    cursor: pointer;
  }
  /* Quiet even pinned: its fill says so; hover brings it up. */
  .pin[aria-pressed='true'] {
    color: var(--text-muted);
  }
  .pin:hover {
    color: var(--text);
  }
  .pin:hover {
    background: var(--hover);
  }
  /* The foot's one row: a view's Delete at its end. */
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
