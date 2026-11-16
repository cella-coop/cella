<script lang="ts">
  import CaretDown from 'phosphor-svelte/lib/CaretDown'
  import CaretUp from 'phosphor-svelte/lib/CaretUp'
  import { listed, movable, moved, regrouped, renamed, runs, shiftable, shifted, spell, toggled, type Placed } from '../models/arrange.ts'
  import Checkbox from './Checkbox.svelte'
  import Icon from './Icon.svelte'

  // An arrangement, a setting's field where it declares its choices: every
  // choice with a toggle, those on first in their order, each under its
  // accordion where it has one, and the rest after them. A choice on moves
  // up or down, its accordion is named in a field of its own, and an
  // accordion's heading renames it and moves it as a whole. Its value is
  // one listing (`models/arrange.ts`), handed back by `onchange`.
  let {
    label,
    value,
    choices,
    onchange,
  }: {
    label: string
    value: string
    choices: { value: string; label: string }[]
    onchange: (value: string) => void
  } = $props()

  const id = $props.id()
  const items = $derived(listed(value))
  const shown = $derived(runs(items))
  const off = $derived(choices.filter((c) => !items.some((p) => p.value === c.value)))
  const named = (v: string) => choices.find((c) => c.value === v)?.label ?? v
  const set = (next: Placed[]) => onchange(spell(next))
</script>

{#snippet on(placed: Placed, at: number)}
  {const name = $derived(named(placed.value))}
  <li class="choice">
    <span class="toggle"><Checkbox role="switch" bind:checked={() => true, () => set(toggled(items, placed.value, false))}>{name}</Checkbox></span>
    <input
      class="group"
      aria-label="Accordion of {name}"
      placeholder="No accordion"
      value={placed.group ?? ''}
      onchange={(e) => set(regrouped(items, at, e.currentTarget.value))}
    />
    <span class="moves">
      <button type="button" aria-label="Move {name} up" title="Move {name} up" disabled={!movable(items, at, -1)} onclick={() => set(moved(items, at, -1))}>
        <Icon icon={CaretUp} />
      </button>
      <button type="button" aria-label="Move {name} down" title="Move {name} down" disabled={!movable(items, at, 1)} onclick={() => set(moved(items, at, 1))}>
        <Icon icon={CaretDown} />
      </button>
    </span>
  </li>
{/snippet}

<fieldset class="arrange" aria-describedby="{id}-how">
  <legend class="label">{label}</legend>
  <p class="how" id="{id}-how">Those on show in this order, each under its accordion where it names one.</p>
  {#if items.length}
    <ul class="on">
      {#each shown as run (run.group ?? `-${run.items[0]?.placed.value}`)}
        {#if run.group === null}
          {@render on(run.items[0]!.placed, run.items[0]!.at)}
        {:else}
          {const group = run.group}
          <li class="accordion">
            <div class="head">
              <input class="name" aria-label="Accordion {group}" value={group} onchange={(e) => set(renamed(items, group, e.currentTarget.value))} />
              <span class="moves">
                <button type="button" aria-label="Move the {group} accordion up" title="Move the {group} accordion up" disabled={!shiftable(items, group, -1)} onclick={() => set(shifted(items, group, -1))}>
                  <Icon icon={CaretUp} />
                </button>
                <button type="button" aria-label="Move the {group} accordion down" title="Move the {group} accordion down" disabled={!shiftable(items, group, 1)} onclick={() => set(shifted(items, group, 1))}>
                  <Icon icon={CaretDown} />
                </button>
              </span>
            </div>
            <ul>
              {#each run.items as item (item.placed.value)}
                {@render on(item.placed, item.at)}
              {/each}
            </ul>
          </li>
        {/if}
      {/each}
    </ul>
  {:else}
    <p class="none">None on.</p>
  {/if}
  {#if off.length}
    <ul class="off">
      {#each off as c (c.value)}
        <li class="choice">
          <span class="toggle"><Checkbox role="switch" bind:checked={() => false, () => set(toggled(items, c.value, true))}>{c.label}</Checkbox></span>
        </li>
      {/each}
    </ul>
  {/if}
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
    padding: 0;
    font-size: var(--text-xs);
    color: var(--text-muted);
  }
  .how,
  .none {
    margin: 0;
    font-size: var(--text-xs);
    color: var(--text-subtle);
  }
  ul {
    list-style: none;
    margin: 0;
    padding: 0;
    display: grid;
    gap: 2px;
  }
  .off {
    padding-top: var(--space-2);
    border-top: 1px solid var(--line);
  }
  .accordion {
    display: grid;
    gap: 2px;
  }
  .accordion > ul {
    margin-inline-start: var(--space-3);
    padding-inline-start: var(--space-2);
    border-inline-start: 1px solid var(--line);
  }
  .head,
  .choice {
    display: flex;
    align-items: center;
    gap: var(--space-2);
    min-height: 2rem;
  }
  .toggle {
    flex: 1;
    display: flex;
    align-items: center;
    gap: var(--space-2);
    font-size: var(--text-sm);
    min-width: 0;
  }
  .name {
    flex: 1;
    font-size: var(--text-sm);
    font-weight: 600;
  }
  .group {
    width: 9rem;
    font-size: var(--text-xs);
  }
  .moves {
    display: flex;
  }
  .moves button {
    display: grid;
    place-items: center;
    width: 1.6rem;
    height: 1.6rem;
    padding: 0;
    border: none;
    border-radius: var(--radius-control);
    background: none;
    color: var(--text-muted);
    cursor: pointer;
  }
  .moves button:hover:not(:disabled) {
    background: var(--hover);
    color: var(--text);
  }
  .moves button:disabled {
    opacity: 0.3;
    cursor: default;
  }
</style>
