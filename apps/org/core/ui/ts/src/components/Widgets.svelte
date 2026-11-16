<script lang="ts">
  import PencilSimple from 'phosphor-svelte/lib/PencilSimple'
  import X from 'phosphor-svelte/lib/X'
  import Plus from 'phosphor-svelte/lib/Plus'
  import { numeric, ops, type Field, type Widget } from '../models/query.ts'
  import { reorder } from '../models/drag.ts'
  import { sortable } from '../attachments/sortable.ts'
  import { useDashboard } from '../hooks/useDashboard.ts'
  import type { Draft } from '../hooks/DashboardState.svelte.ts'
  import { useDrag } from '../hooks/useDrag.ts'
  import Button from './Button.svelte'
  import Checkbox from './Checkbox.svelte'
  import Dialog from './Dialog.svelte'
  import DragHandle from './DragHandle.svelte'
  import DropIndicator from './DropIndicator.svelte'
  import Icon from './Icon.svelte'
  import Select from './Select.svelte'

  // The dashboard's part of the View panel, its Display popover: its
  // widgets in order, each dragged into place, edited or removed in the
  // shared Dialog, and a new one added the same way. A change hands the
  // whole list on, which the collection puts in the address; null goes
  // back to the defaults.
  let {
    widgets,
    fields,
    values,
    custom,
    onchange,
  }: {
    widgets: Widget[]
    fields: Field[]
    values: Record<string, string[]>
    custom: boolean
    onchange: (ws: Widget[] | null) => void
  } = $props()

  const id = $props.id()
  const state = useDashboard()
  const drag = useDrag()
  const numbers = $derived(fields.filter(numeric))
  const groups = $derived(fields.filter((f) => f.type === 'enum' || f.type === 'date'))
  const on = $derived(fields.find((f) => f.key === state.draft.on))
  const as = (fs: Field[], month = false) => fs.map((f) => ({ value: f.key, label: `${f.label}${month && f.type === 'date' ? ', by month' : ''}` }))

  function save(e: SubmitEvent) {
    e.preventDefault()
    const w = state.widget(fields)
    const ws = [...widgets]
    if (state.editing === -1) {
      ws.push(w)
    } else if (state.editing !== null) {
      ws[state.editing] = w
    }
    state.close()
    onchange(ws)
  }
</script>

<div class="widgets">
  <p class="label">Widgets</p>
  <ol
    {@attach sortable(drag, {
      list: 'widgets',
      label: (i) => widgets[i]?.title ?? 'widget',
      onmove: (from, to) => onchange(reorder(widgets, from, to)),
    })}
  >
    {#each widgets as w, i (i)}
      <DropIndicator show={drag.before('widgets', i)} />
      <li data-drag-item="widgets" data-drag-index={i}>
        <DragHandle label={w.title} />
        <span class="title">{w.title}</span>
        <span class="kind">{w.kind === 'kpi' ? 'figure' : 'chart'}</span>
        <button title="Edit" aria-label="Edit {w.title}" onclick={() => state.open(i, w, fields)}><Icon icon={PencilSimple} /></button>
        <button title="Remove" aria-label="Remove {w.title}" onclick={() => onchange(widgets.filter((_, j) => j !== i))}><Icon icon={X} /></button>
      </li>
    {/each}
    <DropIndicator show={drag.before('widgets', widgets.length)} />
  </ol>

  <div class="buttons">
    <Button onclick={() => state.open(-1, undefined, fields)}><Icon icon={Plus} />Add widget</Button>
    {#if custom}
      <Button onclick={() => onchange(null)}>Reset</Button>
    {/if}
  </div>
</div>

<Dialog bind:dialog={state.dialog} title={state.editing === -1 ? 'Add widget' : 'Edit widget'} oncancel={() => state.close()} onclose={() => state.closed()}>
  {#if state.editing !== null}
    <form class="editor" onsubmit={save}>
      <label>Title <input bind:value={state.draft.title} placeholder={state.draft.kind === 'kpi' ? 'Owed' : 'Amounts by month'} /></label>
      <div class="row">
        <span id="{id}-shows">Shows</span>
        <Select
          labelledby="{id}-shows"
          options={[
            { value: 'kpi', label: 'a figure' },
            { value: 'chart', label: 'a chart' },
          ]}
          bind:value={() => state.draft.kind, (v) => (state.draft.kind = v as Draft['kind'])}
        />
      </div>
      <div class="row">
        <span id="{id}-measure">Measure</span>
        <Select
          labelledby="{id}-measure"
          options={ops.map((op) => ({ value: op, label: op, disabled: op !== 'count' && !numbers.length }))}
          bind:value={() => state.draft.op, (v) => (state.draft.op = v as Draft['op'])}
        />
      </div>
      {#if state.draft.op !== 'count'}
        <div class="row">
          <span id="{id}-of">Of</span>
          <Select labelledby="{id}-of" options={as(numbers)} bind:value={state.draft.field} />
        </div>
      {/if}
      {#if state.draft.kind === 'chart'}
        <div class="row">
          <span id="{id}-by">By</span>
          <Select labelledby="{id}-by" options={as(groups, true)} bind:value={state.draft.by} />
        </div>
      {/if}
      <div class="row">
        <span id="{id}-where">Where</span>
        <Select labelledby="{id}-where" options={[{ value: '', label: 'every row' }, ...as(groups)]} bind:value={state.draft.on} />
      </div>
      {#if on?.type === 'enum'}
        <fieldset class="values">
          <legend class="hidden">{on.label} is</legend>
          {#each values[on.key] ?? [] as v (v)}
            <Checkbox bind:checked={() => state.draft.is.includes(v), () => state.toggle(v)}>{v}</Checkbox>
          {/each}
        </fieldset>
      {:else if on?.type === 'date'}
        <div class="row">
          <span id="{id}-within">Within</span>
          <Select
            labelledby="{id}-within"
            options={[
              { value: 'month', label: 'this month' },
              { value: 'year', label: 'this year' },
            ]}
            bind:value={() => state.draft.within, (v) => (state.draft.within = v as Draft['within'])}
          />
        </div>
      {/if}
      <div class="buttons">
        <Button tone="primary" type="submit">{state.editing === -1 ? 'Add' : 'Save'}</Button>
        <Button onclick={() => state.close()}>Cancel</Button>
      </div>
    </form>
  {/if}
</Dialog>

<style>
  .widgets {
    display: grid;
    gap: var(--space-2);
  }
  .label {
    font-size: var(--text-sm);
    color: var(--text-muted);
  }
  ol {
    list-style: none;
    margin: 0;
    padding: 0;
    display: grid;
    gap: 2px;
  }
  li {
    display: flex;
    align-items: center;
    gap: var(--space-1);
    min-height: 1.9rem;
    font-size: var(--text-sm);
  }
  .title {
    flex: 1;
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .kind {
    font-size: var(--text-xs);
    color: var(--text-muted);
  }
  li button {
    display: grid;
    place-items: center;
    width: 1.6rem;
    height: 1.6rem;
    border: none;
    border-radius: var(--radius-control);
    background: none;
    color: var(--text-muted);
    cursor: pointer;
  }
  li button:hover {
    background: var(--hover);
    color: var(--text);
  }
  .editor {
    display: grid;
    gap: var(--space-2);
  }
  .editor > label,
  .editor > .row {
    display: grid;
    gap: 2px;
    font-size: var(--text-xs);
    color: var(--text-muted);
  }
  .editor input {
    color: var(--text);
    font-size: var(--text-sm);
  }
  .values {
    display: flex;
    flex-wrap: wrap;
    gap: var(--space-1) var(--space-3);
    margin: 0;
    padding: 0;
    border: none;
  }
  .buttons {
    display: flex;
    gap: var(--space-2);
    flex-wrap: wrap;
  }
  .hidden {
    position: absolute;
    width: 1px;
    height: 1px;
    overflow: hidden;
    clip-path: inset(50%);
  }
</style>
