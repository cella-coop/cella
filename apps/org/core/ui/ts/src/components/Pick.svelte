<script lang="ts">
  import Check from 'phosphor-svelte/lib/Check'
  import { useQuery } from '../hooks/useQuery.ts'
  import type { Option } from '../models/select.ts'
  import Avatar from './Avatar.svelte'
  import Icon from './Icon.svelte'

  // What a property's popover offers, as Linear's does: a search box over
  // the options, each with its icon, its tone's dot or its avatar, the
  // chosen ones wearing a check. One choice closes it as it is made; with
  // `multi` each press toggles and it stays open. Typing filters; the
  // arrows move among the options, Enter on the search takes the first
  // one left, and Escape closes it, the focus back on its trigger. `none`
  // adds a choice that clears.
  let {
    options,
    value,
    multi = false,
    none,
    label,
    heading,
    stay = false,
    onpick,
  }: {
    options: Option[]
    value: string | string[]
    multi?: boolean
    none?: string
    label: string
    // A quiet heading over it, where a popover holds several.
    heading?: string
    // A single choice leaves the popover open, as one of several does.
    stay?: boolean
    onpick: (value: string | string[]) => void
  } = $props()

  const uid = $props.id()
  const q = useQuery()
  let list: HTMLElement
  const chosen = $derived(new Set(Array.isArray(value) ? value : value ? [value] : []))
  const all = $derived(none ? [{ value: '', label: none } as Option, ...options] : options)
  const shown = $derived(all.filter((o) => o.label.toLowerCase().includes(q.text.trim().toLowerCase())))
  const on = (o: Option) => (o.value === '' ? chosen.size === 0 : chosen.has(o.value))
  const buttons = () => [...list.querySelectorAll<HTMLElement>('[role="option"]:not([disabled])')]

  function pick(e: Event | null, o: Option) {
    if (multi && o.value !== '') {
      const next = new Set(chosen)
      next.has(o.value) ? next.delete(o.value) : next.add(o.value)
      onpick([...next])
      return
    }
    onpick(multi ? [] : o.value)
    if (stay) {
      return
    }
    ;(list.closest('[popover]') as HTMLElement | null)?.hidePopover()
  }

  function onkeydown(e: KeyboardEvent) {
    if (e.key === 'Enter' && e.target instanceof HTMLInputElement) {
      e.preventDefault()
      const first = shown.find((o) => !o.disabled)
      if (first) {
        pick(null, first)
      }
      return
    }
    const moves = buttons()
    const at = moves.indexOf(document.activeElement as HTMLElement)
    const to = e.key === 'ArrowDown' ? at + 1 : e.key === 'ArrowUp' ? at - 1 : -1
    if (to >= -1 && (e.key === 'ArrowDown' || e.key === 'ArrowUp')) {
      e.preventDefault()
      if (to < 0) {
        list.querySelector<HTMLInputElement>('input')?.focus()
      } else {
        moves[Math.min(to, moves.length - 1)]?.focus()
      }
    }
  }
</script>

<div class="pick" bind:this={list} role="presentation" {onkeydown}>
  {#if heading}<h3 class="heading">{heading}</h3>{/if}
  <!-- svelte-ignore a11y_autofocus -->
  <input type="text" class="search" placeholder="Type to filter…" aria-label="Filter {label}" bind:value={q.text} autocomplete="off" autofocus={!stay} />
  <div role="listbox" aria-label={label} aria-multiselectable={multi} class="options">
    {#each shown as o (o.value)}
      <button type="button" role="option" class="option" aria-selected={on(o)} disabled={o.disabled} onclick={(e) => pick(e, o)}>
        {#if o.who}
          <Avatar name={o.who} size="1.25rem" />
        {:else if o.icon}
          <span class="mark"><Icon icon={o.icon} size="1em" /></span>
        {:else if o.tone}
          <span class="dot {o.tone}" aria-hidden="true"></span>
        {/if}
        <span class="text">{o.label}</span>
        {#if on(o)}<span class="check"><Icon icon={Check} size="1em" /></span>{/if}
      </button>
    {:else}
      <p class="empty" id="{uid}-empty">Nothing named “{q.text}”.</p>
    {/each}
  </div>
</div>

<style>
  .pick {
    display: grid;
    gap: var(--space-1);
  }
  .heading {
    margin: 0;
    padding: 0 var(--space-2);
    font-family: var(--font-ui);
    font-size: var(--text-xs);
    font-weight: 500;
    color: var(--text-subtle);
  }
  .search {
    border: none;
    border-bottom: 1px solid var(--line);
    border-radius: 0;
    background: none;
    color: var(--text);
    font: inherit;
    font-size: var(--text-sm);
    padding: var(--space-1) var(--space-2) var(--space-2);
  }
  .search:focus-visible {
    box-shadow: var(--focus);
  }
  .options {
    display: grid;
    max-height: 16rem;
    overflow-y: auto;
  }
  .option {
    display: flex;
    align-items: center;
    gap: var(--space-2);
    padding: var(--space-1) var(--space-2);
    border: none;
    border-radius: var(--radius-control);
    background: none;
    color: var(--text);
    font: inherit;
    font-size: var(--text-sm);
    text-align: start;
    cursor: pointer;
  }
  .option:hover,
  .option:focus-visible {
    background: var(--hover);
  }
  .text {
    flex: 1;
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .mark,
  .check {
    display: inline-flex;
    flex: none;
    color: var(--text-muted);
  }
  .dot {
    flex: none;
    width: 0.5rem;
    height: 0.5rem;
    margin: 0 0.25rem;
    border-radius: 50%;
    background: var(--neutral-text);
  }
  .dot.accent {
    background: var(--accent-text);
  }
  .dot.positive {
    background: var(--positive-text);
  }
  .dot.negative {
    background: var(--negative-text);
  }
  .dot.warning {
    background: var(--warning-text);
  }
  .empty {
    margin: 0;
    padding: var(--space-2);
    font-size: var(--text-sm);
    color: var(--text-muted);
  }
</style>
