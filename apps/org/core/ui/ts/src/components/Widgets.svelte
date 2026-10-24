<script lang="ts">
  import ArrowUp from 'phosphor-svelte/lib/ArrowUp'
  import ArrowDown from 'phosphor-svelte/lib/ArrowDown'
  import PencilSimple from 'phosphor-svelte/lib/PencilSimple'
  import X from 'phosphor-svelte/lib/X'
  import Plus from 'phosphor-svelte/lib/Plus'
  import { numeric, ops, type Field, type Widget } from '../models/query.ts'
  import { useDashboard } from '../hooks/useDashboard.ts'
  import Button from './Button.svelte'
  import Icon from './Icon.svelte'

  // The dashboard's part of the View card: its widgets in order, each to
  // edit, move or remove, and a new one to add. A change hands the whole
  // list on, which the collection puts in the address; null goes back to
  // the defaults.
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

  const state = useDashboard()
  const numbers = $derived(fields.filter(numeric))
  const groups = $derived(fields.filter((f) => f.type === 'enum' || f.type === 'date'))
  const on = $derived(fields.find((f) => f.key === state.draft.on))

  function move(i: number, by: number) {
    const ws = [...widgets]
    const [w] = ws.splice(i, 1)
    ws.splice(i + by, 0, w)
    onchange(ws)
  }

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
  <ol>
    {#each widgets as w, i (i)}
      <li>
        <span class="title">{w.title}</span>
        <span class="kind">{w.kind === 'kpi' ? 'figure' : 'chart'}</span>
        <button title="Move up" aria-label="Move {w.title} up" disabled={i === 0} onclick={() => move(i, -1)}><Icon icon={ArrowUp} /></button>
        <button title="Move down" aria-label="Move {w.title} down" disabled={i === widgets.length - 1} onclick={() => move(i, 1)}><Icon icon={ArrowDown} /></button>
        <button title="Edit" aria-label="Edit {w.title}" onclick={() => state.open(i, w, fields)}><Icon icon={PencilSimple} /></button>
        <button title="Remove" aria-label="Remove {w.title}" onclick={() => onchange(widgets.filter((_, j) => j !== i))}><Icon icon={X} /></button>
      </li>
    {/each}
  </ol>

  {#if state.editing !== null}
    <form class="editor" onsubmit={save}>
      <label>Title <input bind:value={state.draft.title} placeholder={state.draft.kind === 'kpi' ? 'Owed' : 'Amounts by month'} /></label>
      <label>
        Shows
        <select bind:value={state.draft.kind}>
          <option value="kpi">a figure</option>
          <option value="chart">a chart</option>
        </select>
      </label>
      <label>
        Measure
        <select bind:value={state.draft.op}>
          {#each ops as op (op)}
            <option value={op} disabled={op !== 'count' && !numbers.length}>{op}</option>
          {/each}
        </select>
      </label>
      {#if state.draft.op !== 'count'}
        <label>
          Of
          <select bind:value={state.draft.field}>
            {#each numbers as f (f.key)}<option value={f.key}>{f.label}</option>{/each}
          </select>
        </label>
      {/if}
      {#if state.draft.kind === 'chart'}
        <label>
          By
          <select bind:value={state.draft.by}>
            {#each groups as f (f.key)}<option value={f.key}>{f.label}{f.type === 'date' ? ', by month' : ''}</option>{/each}
          </select>
        </label>
      {/if}
      <label>
        Where
        <select bind:value={state.draft.on}>
          <option value="">every row</option>
          {#each groups as f (f.key)}<option value={f.key}>{f.label}</option>{/each}
        </select>
      </label>
      {#if on?.type === 'enum'}
        <fieldset class="values">
          <legend class="hidden">{on.label} is</legend>
          {#each values[on.key] ?? [] as v (v)}
            <label class="check"><input type="checkbox" checked={state.draft.is.includes(v)} onchange={() => state.toggle(v)} />{v}</label>
          {/each}
        </fieldset>
      {:else if on?.type === 'date'}
        <label>
          Within
          <select bind:value={state.draft.within}>
            <option value="month">this month</option>
            <option value="year">this year</option>
          </select>
        </label>
      {/if}
      <div class="buttons">
        <Button tone="primary" type="submit">{state.editing === -1 ? 'Add' : 'Save'}</Button>
        <Button onclick={() => state.close()}>Cancel</Button>
      </div>
    </form>
  {:else}
    <div class="buttons">
      <Button onclick={() => state.open(-1, undefined, fields)}><Icon icon={Plus} />Add widget</Button>
      {#if custom}
        <Button onclick={() => onchange(null)}>Reset</Button>
      {/if}
    </div>
  {/if}
</div>

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
  li button:hover:not(:disabled) {
    background: var(--hover);
    color: var(--text);
  }
  li button:disabled {
    opacity: 0.35;
    cursor: default;
  }
  .editor {
    display: grid;
    gap: var(--space-2);
    padding: var(--space-2);
    border-radius: var(--radius-control);
    background: var(--panel);
  }
  .editor > label {
    display: grid;
    gap: 2px;
    font-size: var(--text-xs);
    color: var(--text-muted);
  }
  .editor input,
  .editor select {
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
  .check {
    display: flex;
    align-items: center;
    gap: var(--space-1);
    font-size: var(--text-sm);
  }
  .check input {
    width: auto;
    min-height: 0;
    margin: 0;
    accent-color: var(--accent-fill);
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
