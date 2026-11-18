<script lang="ts">
  import type { Snippet } from 'svelte'
  import Plus from 'phosphor-svelte/lib/Plus'
  import { drawn, keyOf, landed, listed, described, renamed, spell, unkeyed, type Lifted } from '../models/arrange.ts'
  import { placing } from '../attachments/placing.ts'
  import { useArrange } from '../hooks/useArrange.ts'
  import { useDrag } from '../hooks/useDrag.ts'
  import DragHandle from './DragHandle.svelte'
  import Icon from './Icon.svelte'
  import Who from './Who.svelte'

  // An arrangement, a setting's field where it declares its choices: the
  // tree of those on show, in their order, each at the top level or in an
  // accordion, and under it the choices not shown. Where a choice sits is
  // all there is to say of it: it is dragged into an accordion or out of
  // one, along the tree, or among those not shown, and an accordion is
  // dragged as a whole, by the pointer or by the keyboard (`placing`).
  // An accordion's name is its heading, which renames it; New accordion
  // makes an empty one to drag choices into. Its value is one listing
  // (`models/arrange.ts`), handed back by `onchange` once a drop lands.
  // `grouped`, every choice on show sits in an accordion, called a group:
  // none lands at the top level, a group is never named blank, and those
  // not shown are not enabled. How to drag is an icon's tooltip.
  let {
    label,
    value,
    choices,
    onchange,
    hint,
    grouped = false,
  }: {
    label: string
    value: string
    choices: { value: string; label: string }[]
    onchange: (value: string) => void
    // What the setting says beside its label, as who changes it.
    hint?: Snippet
    grouped?: boolean
  } = $props()

  const id = $props.id()
  const list = `arrange-${id}`
  const drag = useDrag()
  const state = useArrange()
  const items = $derived(listed(value))
  const lifted = $derived(drag.placing(list) ? unkeyed(drag.key) : null)
  const layout = $derived(drawn(items, lifted, state.empty, grouped))
  const off = $derived(choices.filter((c) => !items.some((p) => p.value === c.value)))
  const groups = $derived([...new Set(items.flatMap((p) => (p.group === null ? [] : [p.group])))])
  const named = (v: string) => choices.find((c) => c.value === v)?.label ?? v
  const noun = $derived(grouped ? 'group' : 'accordion')
  const called = (l: Lifted) => (l.kind === 'choice' ? named(l.value) : `the ${l.group} ${noun}`)
  const how = $derived(
    grouped
      ? 'Drag a feature by its grip, or press Space on it and move it with the arrow keys: into another group, along its group, or down to those not enabled. Drag a group by its grip to move it with its features; its name renames it.'
      : 'Drag a feature by its grip, or press Space on it and move it with the arrow keys: into an accordion or out of one, along the list, or down to those not shown.',
  )

  // A group renamed, or an accordion, as its name changes or on Enter,
  // which the setting holding it takes for its commit; a group named blank
  // keeps its name.
  function rename(group: string, empty: boolean, input: HTMLInputElement) {
    if (grouped && !input.value.trim()) {
      input.value = group
      return
    }
    if (empty) {
      state.rename(group, input.value)
    } else {
      onchange(spell(renamed(items, group, input.value)))
    }
  }

  function lift(key: string) {
    const l = unkeyed(key)!
    const d = drawn(items, l, state.empty, grouped)
    return { from: d.from, length: d.targets.length, label: called(l) }
  }

  function describe(to: number) {
    const l = lifted
    const t = l && layout.targets[to]
    return l && t ? described(items, l, t, named) : ''
  }

  function onplace(key: string, to: number) {
    const l = unkeyed(key)!
    const t = drawn(items, l, state.empty, grouped).targets[to]
    if (!t) {
      return
    }
    if (t.kind === 'at' && t.group !== null) {
      state.filled(t.group)
    }
    onchange(spell(landed(items, l, t)))
  }

  const offAt = $derived(layout.targets.length - 1)
</script>

<fieldset
  class="arrange"
  aria-describedby="{id}-how"
  {@attach placing(drag, { list, lift, describe, onplace })}
>
  <legend class="label"><span>{label}</span>{@render hint?.()}<Who who={{ kind: 'help', label: `How to arrange ${label.toLowerCase()}`, text: how }} /></legend>
  <p class="visually-hidden" id="{id}-how">{how}</p>
  <ul class="tree" aria-label="{label} on show">
    {#each layout.rows as row, i (row.kind === 'place' ? `p${row.at}` : row.kind === 'head' ? `h:${row.group}` : `c:${row.placed.value}`)}
      {#if row.kind === 'place'}
        <li class="place" class:inner={row.depth === 1} class:on={drag.aiming(list, row.at)} data-drop-place={row.at} aria-hidden="true"></li>
      {:else if row.kind === 'head'}
        {const group = $derived(row.group)}
        <li
          class="row head"
          data-drag-item={row.empty ? undefined : list}
          data-drag-key={row.empty ? undefined : keyOf({ kind: 'accordion', group })}
          class:lifted={drag.holding(list, keyOf({ kind: 'accordion', group }))}
        >
          {#if !row.empty}<DragHandle label="the {group} {noun}" />{:else}<span class="grip"></span>{/if}
          <input
            class="name"
            aria-label="Name of the {group} {noun}"
            value={group}
            onchange={(e) => rename(group, row.empty, e.currentTarget)}
            onkeydown={(e) => e.key === 'Enter' && !e.isComposing && rename(group, row.empty, e.currentTarget)}
          />
          {#if row.empty}<span class="hollow">Empty: drag a feature here</span>{/if}
        </li>
      {:else}
        {const v = $derived(row.placed.value)}
        <li
          class="row choice"
          class:inner={row.depth === 1}
          class:lifted={drag.holding(list, keyOf({ kind: 'choice', value: v })) || (lifted?.kind === 'accordion' && lifted.group === row.placed.group)}
          data-drag-item={list}
          data-drag-key={keyOf({ kind: 'choice', value: v })}
         
        >
          <DragHandle label={named(v)} />
          <span class="text">{named(v)}</span>
          {#if row.placed.group}<span class="visually-hidden">, in {row.placed.group}</span>{/if}
        </li>
      {/if}
    {:else}
      <li class="none">None on show: drag a feature up here.</li>
    {/each}
  </ul>
  <button type="button" class="make" onclick={() => state.make(groups, noun)}><Icon icon={Plus} /> New {noun}</button>
  <div class="off" class:on={drag.aiming(list, offAt)} data-drop-zone={lifted ? offAt : undefined}>
    <p class="caption" id="{id}-off">{grouped ? 'Not enabled' : 'Not shown'}</p>
    {#if off.length}
      <ul aria-labelledby="{id}-off">
        {#each off as c (c.value)}
          <li class="row choice" data-drag-item={list} data-drag-key={keyOf({ kind: 'choice', value: c.value })} class:lifted={drag.holding(list, keyOf({ kind: 'choice', value: c.value }))}>
            <DragHandle label={c.label} />
            <span class="text">{c.label}</span>
          </li>
        {/each}
      </ul>
    {:else}
      <p class="none">{grouped ? 'Every feature is enabled.' : 'Every feature is on show.'}</p>
    {/if}
  </div>
</fieldset>

<style>
  .arrange {
    display: grid;
    gap: var(--space-2);
    margin: 0;
    padding: 0;
    border: none;
    min-width: 0;
  }
  .label {
    display: flex;
    align-items: center;
    gap: var(--space-1);
    padding: 0;
    font-size: var(--text-xs);
    color: var(--text-muted);
  }
  .none,
  .hollow {
    margin: 0;
    font-size: var(--text-xs);
    color: var(--text-subtle);
  }
  ul {
    list-style: none;
    margin: 0;
    padding: 0;
    display: grid;
  }
  .row {
    display: flex;
    align-items: center;
    gap: var(--space-2);
    min-height: 2rem;
    padding-inline: var(--space-1);
    border-radius: var(--radius-control);
    font-size: var(--text-sm);
    background: var(--surface, transparent);
  }
  .row:hover {
    background: var(--hover);
  }
  .row.inner {
    margin-inline-start: var(--space-4);
    padding-inline-start: var(--space-2);
    border-inline-start: 1px solid var(--line);
    border-radius: 0 var(--radius-control) var(--radius-control) 0;
  }
  .row.lifted {
    opacity: 0.4;
  }
  .head .name {
    flex: 1;
    min-width: 0;
    padding: 2px var(--space-1);
    border: 1px solid transparent;
    border-radius: var(--radius-control);
    background: none;
    font: inherit;
    font-weight: 600;
    color: var(--text);
  }
  .head .name:hover {
    border-color: var(--line);
  }
  .grip {
    width: 1.25rem;
  }
  .text {
    flex: 1;
    min-width: 0;
  }
  /* A place a lifted thing may land: no room until it is the one aimed
     at, then the one line, indented as deep as it would sit. */
  .place {
    height: 0;
    margin: 0;
    position: relative;
  }
  .place.on::after {
    content: '';
    position: absolute;
    inset-inline: 0;
    top: -1px;
    height: 2px;
    border-radius: var(--radius-pill);
    background: var(--accent-border);
  }
  .place.inner {
    margin-inline-start: var(--space-4);
  }
  .make {
    justify-self: start;
    display: inline-flex;
    align-items: center;
    gap: var(--space-1);
    padding: 2px var(--space-2);
    border: none;
    border-radius: var(--radius-control);
    background: none;
    font-size: var(--text-xs);
    color: var(--text-muted);
    cursor: pointer;
  }
  .make:hover {
    background: var(--hover);
    color: var(--text);
  }
  .off {
    display: grid;
    gap: var(--space-1);
    padding: var(--space-2);
    border: 1px dashed var(--line);
    border-radius: var(--radius-control);
  }
  .off.on {
    border-color: var(--accent-border);
    background: var(--hover);
  }
  .caption {
    margin: 0;
    font-size: var(--text-xs);
    font-weight: 600;
    color: var(--text-muted);
  }
</style>
