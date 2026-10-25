<script lang="ts">
  import { goto } from '$app/navigation'
  import { page } from '$app/state'
  import SlidersHorizontal from 'phosphor-svelte/lib/SlidersHorizontal'
  import X from 'phosphor-svelte/lib/X'
  import { repin, type Field, type Pin, type Result } from '../models/query.ts'
  import { reorder } from '../models/drag.ts'
  import { sortable } from '../attachments/sortable.ts'
  import { useDrag } from '../hooks/useDrag.ts'
  import Card from './Card.svelte'
  import Dashboard from './Dashboard.svelte'
  import DragHandle from './DragHandle.svelte'
  import DropIndicator from './DropIndicator.svelte'
  import Frame from './PageFrame.svelte'
  import Icon from './Icon.svelte'
  import Widgets from './Widgets.svelte'

  // The co-op's home: one dashboard of widgets pinned from many
  // collections, each a standard widget over its collection's fields, run
  // by the server over that collection's rows as the acting member sees
  // them. The drawer's View card orders and removes them, and edits one
  // collection's with the standard widget editor. The viewer's own are in
  // the address (`w`), the collection being edited beside them (`c`).
  let {
    title,
    caption,
    results,
    errors = [],
    pins,
    custom,
    collections,
    editing,
    values,
  }: {
    title: string
    caption?: string
    results: Result[]
    errors?: string[]
    pins: Pin[]
    custom: boolean
    // The collections a widget may run over, with their fields.
    collections: { name: string; title: string; fields: Field[] }[]
    editing: string
    // The values of the edited collection's enumerations.
    values: Record<string, string[]>
  } = $props()

  const drag = useDrag()
  const named = (name: string) => collections.find((c) => c.name === name)
  const edited = $derived(named(editing))
  const mine = $derived(pins.filter((p) => p.collection === editing))

  function go(next: { w?: Pin[] | null; c?: string }) {
    const q = new URLSearchParams(page.url.search)
    if (next.w === null) {
      q.delete('w')
    } else if (next.w) {
      q.set('w', JSON.stringify(next.w))
    }
    if (next.c) {
      q.set('c', next.c)
    }
    goto(`?${q}`, { reset: false })
  }
</script>

{#snippet viewing()}
  <Card title="View">
    <div class="home">
      <p class="label">On the home</p>
      <ol
        {@attach sortable(drag, {
          list: 'pins',
          label: (i) => pins[i]?.title ?? 'widget',
          onmove: (from, to) => go({ w: reorder(pins, from, to) }),
        })}
      >
        {#each pins as p, i (i)}
          <DropIndicator show={drag.before('pins', i)} />
          <li data-drag-item="pins" data-drag-index={i}>
            <DragHandle label={p.title} />
            <button class="title" onclick={() => go({ c: p.collection })} title="Edit {named(p.collection)?.title ?? p.collection}’s widgets">
              {p.title}<span class="from">{named(p.collection)?.title ?? p.collection}</span>
            </button>
            <button title="Remove" aria-label="Remove {p.title}" onclick={() => go({ w: pins.filter((_, j) => j !== i) })}><Icon icon={X} /></button>
          </li>
        {/each}
        <DropIndicator show={drag.before('pins', pins.length)} />
      </ol>
      <label class="option">
        <span class="label">Widgets of</span>
        <select value={editing} onchange={(e) => go({ c: e.currentTarget.value })}>
          {#each collections as c (c.name)}<option value={c.name}>{c.title}</option>{/each}
        </select>
      </label>
    </div>
    {#if edited}
      {#key editing}
        <Widgets widgets={mine} fields={edited.fields} {values} {custom} onchange={(ws) => go({ w: ws === null ? null : repin(pins, editing, ws) })} />
      {/key}
    {/if}
  </Card>
{/snippet}

<Frame {title} {caption} panels={[{ id: 'view', label: 'View', icon: SlidersHorizontal, body: viewing }]}>
  <div class="content">
    <Dashboard {results} {errors} />
  </div>
</Frame>

<style>
  .content {
    padding: var(--space-4);
  }
  .home {
    display: grid;
    gap: var(--space-2);
  }
  .label {
    font-size: var(--text-xs);
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
    display: grid;
    grid-template-columns: auto 1fr auto;
    align-items: center;
    gap: var(--space-1);
    font-size: var(--text-sm);
  }
  li button {
    border: 0;
    background: none;
    color: var(--text-muted);
    cursor: pointer;
    border-radius: var(--radius-control);
    padding: var(--space-1);
  }
  li button:hover {
    background: var(--hover);
    color: var(--text);
  }
  .title {
    display: flex;
    justify-content: space-between;
    gap: var(--space-2);
    text-align: start;
    color: var(--text);
  }
  .from {
    color: var(--text-subtle);
    font-size: var(--text-xs);
  }
  .option {
    display: grid;
    grid-template-columns: auto 1fr;
    align-items: center;
    gap: var(--space-2);
    margin-top: var(--space-2);
  }
  select {
    font: inherit;
    font-size: var(--text-sm);
    padding: var(--space-1) var(--space-2);
    border: 0;
    border-radius: var(--radius-control);
    background: var(--sunk);
    color: var(--text);
  }
</style>
