<script lang="ts">
  import type { Snippet } from 'svelte'
  import type { Attachment } from 'svelte/attachments'
  import CaretRight from 'phosphor-svelte/lib/CaretRight'
  import DotsThree from 'phosphor-svelte/lib/DotsThree'
  import { ruled, type Entry } from '../models/menu.ts'
  import type { Point } from '../hooks/MenuState.svelte.ts'
  import { useMenu } from '../hooks/useMenu.ts'
  import { verb } from '../verbs.ts'
  import Floating from './Floating.svelte'
  import Icon from './Icon.svelte'
  import Tick from './Tick.svelte'

  // A target's context menu, as Linear's: what can be done to a chip, a
  // row, a card, built from `items` as data (`models/menu.ts`). It opens
  // on a right click, a long press on touch, the Menu key or Shift+F10
  // where the target has the focus, and from the ⋯ the target shows on
  // hover and on focus, so a menu is never reached by a right click
  // alone. It floats at the pointer, or under what opened it, in the top
  // layer (`Floating`), flipped to stay in the window, each submenu
  // beside its item. The keyboard moves with the arrows, Home and End and
  // the first letters of an item, opens a submenu with the right arrow,
  // Enter or Space and leaves it with the left arrow or Escape, chooses
  // with Enter or Space; Escape on the menu shuts it, the focus back on
  // the target. A press outside, a scroll, a resize or leaving the window
  // shuts it too. An item without an icon wears its verb's (`verb`).
  let {
    label,
    items,
    children,
    block = false,
    always = false,
  }: {
    // What the menu is of, which names it and its ⋯: "View Open".
    label: string
    items: Entry[]
    children: Snippet
    // The target is a block, as a row, rather than a run of a line, as a
    // chip.
    block?: boolean
    // Its ⋯ always shown, as a view chip's (the operator, 20 Nov), rather
    // than on hover and focus alone.
    always?: boolean
  } = $props()

  const id = $props.id()
  const menu = useMenu(() => items)
  // The target's wrapper and its ⋯, read by the handlers alone.
  let wrap: HTMLElement | undefined
  let more: HTMLElement | undefined

  // What the focus goes back to: the target's control the event is on, or
  // its first.
  const focusable = 'a[href], button, input, [tabindex]:not([tabindex="-1"])'
  const control = (from: EventTarget | null) => ((from as Element | null)?.closest?.(focusable) as HTMLElement | null) ?? wrap?.querySelector<HTMLElement>(focusable) ?? null

  const under = (el: Element): Point => {
    const r = el.getBoundingClientRect()
    return { x: r.left, y: r.bottom + 4, above: r.top - 4, before: r.right }
  }
  // A submenu, beside its item: at the menu's right edge, level with the
  // item, or at its left where the right has no room.
  const beside = (item: Element): Point => {
    const r = item.getBoundingClientRect()
    const p = (item.closest('.floating') ?? item).getBoundingClientRect()
    return { x: p.right - 2, y: r.top - 5, before: p.left + 2, above: r.bottom + 5 }
  }

  function oncontextmenu(e: MouseEvent) {
    e.preventDefault()
    if (menu.open && menu.keyed) {
      return
    }
    const from = control(e.target)
    // A context menu the keyboard asked for, where the browser sends one
    // for Shift+F10 or the Menu key, comes at no point.
    if (e.clientX === 0 && e.clientY === 0 && from) {
      menu.show(under(from), from, true)
    } else {
      menu.show({ x: e.clientX, y: e.clientY, above: e.clientY, before: e.clientX }, from, false)
    }
  }

  function onkeydown(e: KeyboardEvent) {
    if (e.key === 'ContextMenu' || (e.key === 'F10' && e.shiftKey)) {
      const from = control(e.target)
      if (from) {
        e.preventDefault()
        menu.show(under(from), from, true)
      }
    }
  }

  function onclick(e: MouseEvent) {
    if (menu.swallow()) {
      e.preventDefault()
      e.stopPropagation()
    }
  }

  function toggle(e: MouseEvent) {
    e.stopPropagation()
    e.preventDefault()
    if (menu.open) {
      menu.close()
    } else if (more) {
      // A click from the keyboard comes at no point, and starts on the
      // first item.
      menu.show(under(more), more, e.detail === 0)
    }
  }

  const ours = (t: EventTarget | null) => {
    const el = t as Element | null
    return !!el?.closest?.(`[id^="${id}-m"]`) || (!!more && !!el && more.contains(el))
  }

  function key(e: KeyboardEvent, k: number, i: number) {
    if (e.ctrlKey || e.metaKey || e.altKey) {
      return
    }
    const on = menu.levels[k]?.active ?? -1
    const el = e.currentTarget as HTMLElement
    if (e.key === 'ArrowDown') {
      menu.move(1)
    } else if (e.key === 'ArrowUp') {
      menu.move(-1)
    } else if (e.key === 'Home' || e.key === 'PageUp') {
      menu.to('first')
    } else if (e.key === 'End' || e.key === 'PageDown') {
      menu.to('last')
    } else if (e.key === 'ArrowRight') {
      if (on === i) {
        menu.enter(beside(el))
      }
    } else if (e.key === 'ArrowLeft') {
      menu.leave()
    } else if (e.key === 'Escape') {
      if (!menu.leave()) {
        menu.close()
      }
    } else if (e.key === 'Enter' || e.key === ' ') {
      if (on === i) {
        menu.choose(k, i, beside(el))
      }
    } else if (e.key === 'Tab') {
      menu.close()
      return
    } else if (e.key.length === 1 && e.key !== ' ') {
      menu.type(e.key)
    } else {
      return
    }
    e.preventDefault()
    e.stopPropagation()
  }

  // The item holding the focus takes it, as the keyboard or the pointer
  // moves it, once its menu is shown. Opened by the pointer, that is the
  // first item, unmarked, so the keyboard has somewhere to start.
  const focus =
    (k: number, i: number): Attachment<HTMLElement> =>
    (el) => {
      if (k === menu.depth && i === menu.focus(k)) {
        queueMicrotask(() => {
          if (el.isConnected && document.activeElement !== el) {
            el.focus({ preventScroll: true })
            el.scrollIntoView({ block: 'nearest' })
          }
        })
      }
    }

  // Whether a menu's entries lead with a mark, an icon or a check, so
  // their labels line up in a column after it.
  const marked = (es: Entry[]) => es.some((e) => !ruled(e) && (e.icon || verb(e.label)))
</script>

<svelte:window
  onpointerdowncapture={(e) => {
    if (menu.open && !ours(e.target)) {
      menu.close(false)
    }
  }}
  onscrollcapture={(e) => {
    if (menu.open && !ours(e.target)) {
      menu.close(false)
    }
  }}
  onresize={() => menu.close(false)}
  onblur={() => menu.close(false)}
/>

<!-- svelte-ignore a11y_no_static_element_interactions: the target's own controls take the keys and the clicks; the span hears what bubbles from them -->
<span
  bind:this={wrap}
  class="target"
  class:block
  class:always
  class:open={menu.open}
  {oncontextmenu}
  {onkeydown}
  onclickcapture={onclick}
  onpointerdown={(e) => menu.hold(e, control(e.target))}
  onpointermove={(e) => menu.drift(e)}
  onpointerup={() => menu.release()}
  onpointercancel={() => menu.release()}
>
  {@render children()}
  <button
    bind:this={more}
    type="button"
    class="more"
    aria-label="Actions for {label}"
    title="Actions"
    aria-haspopup="menu"
    aria-expanded={menu.open}
    aria-controls={menu.open ? `${id}-m0` : undefined}
    onclick={toggle}
  >
    <Icon icon={DotsThree} weight="regular" />
  </button>
</span>

{#each menu.levels as level, k (k)}
  {const entries = $derived(menu.entries(k))}
  {const lead = $derived(marked(entries))}
  <Floating id="{id}-m{k}" x={level.at.x} y={level.at.y} above={level.at.above} before={level.at.before} label={k === 0 ? label : (menu.entries(k - 1)[menu.levels[k - 1]!.active] as { label: string })?.label ?? label} role="menu">
    {#each entries as e, i (i)}
      {#if ruled(e)}
        <div class="rule" role="separator"></div>
      {:else}
        {const glyph = $derived(e.icon ?? verb(e.label))}
        {const sub = $derived(!!e.items)}
        <button
          type="button"
          class="item"
          class:on={level.active === i}
          class:danger={e.danger}
          class:off={!!e.disabled}
          role={e.checked !== undefined ? 'menuitemradio' : 'menuitem'}
          aria-checked={e.checked}
          aria-disabled={e.disabled ? 'true' : undefined}
          aria-describedby={e.disabled ? `${id}-r${k}-${i}` : undefined}
          aria-haspopup={sub ? 'menu' : undefined}
          aria-expanded={sub ? menu.levels.length > k + 1 && level.active === i : undefined}
          title={e.disabled}
          tabindex={i === menu.focus(k) && k === menu.depth ? 0 : -1}
          onpointermove={(ev) => menu.hover(k, i, sub ? beside(ev.currentTarget) : undefined)}
          onclick={(ev) => menu.choose(k, i, beside(ev.currentTarget))}
          onkeydown={(ev) => key(ev, k, i)}
          {@attach focus(k, i)}
        >
          {#if lead}
            <span class="mark">{#if glyph}<Icon icon={glyph} size="1em" />{/if}</span>
          {/if}
          <span class="label">{e.label}</span>
          {#if e.kbd}<kbd>{e.kbd}</kbd>{/if}
          {#if e.checked}<Tick />{/if}
          {#if sub}<span class="chevron"><Icon icon={CaretRight} size="0.85em" weight="regular" /></span>{/if}
          {#if e.disabled}<span id="{id}-r{k}-{i}" class="visually-hidden">{e.disabled}</span>{/if}
        </button>
      {/if}
    {/each}
  </Floating>
{/each}

<style>
  /* The target: what it holds, and its ⋯ over its end, shown on hover, on
     focus and while its menu is open. A finger held on it opens the menu,
     never the browser's callout. */
  .target {
    position: relative;
    display: inline-flex;
    align-items: center;
    min-width: 0;
    -webkit-touch-callout: none;
  }
  .target.block {
    display: flex;
  }
  .more {
    position: absolute;
    inset-inline-end: 3px;
    top: 50%;
    translate: 0 -50%;
    display: grid;
    place-items: center;
    width: 1rem;
    height: 1rem;
    padding: 0;
    border: none;
    border-radius: var(--radius-pill);
    background: none;
    color: var(--text-muted);
    font-size: var(--text-xs);
    cursor: pointer;
    opacity: 0;
    pointer-events: none;
    transition: opacity var(--fast) var(--ease);
  }
  .target.always .more,
  .target:hover .more,
  .target:focus-within .more,
  .target.open .more {
    opacity: 1;
    pointer-events: auto;
  }
  /* Bare at rest, the ellipsis alone; hovered or open, a round fill
     behind it (the operator, 20 Nov). */
  .more:hover,
  .target.open .more {
    background: var(--hover);
    color: var(--text);
  }
  /* Compact rows, as Linear's: a mark in the muted ink, the label, a
     shortcut's hint and a submenu's chevron at the end; the row the
     pointer or the keyboard is on filled with the hover. Stronger than
     `Floating`'s buttons, which it lays out its own way. */
  :global(.floating) .item {
    display: flex;
    align-items: center;
    justify-content: flex-start;
    gap: var(--space-2);
    min-height: 1.75rem;
    padding: 0 var(--space-2);
    border: none;
    border-radius: var(--radius-control);
    background: none;
    color: var(--text);
    font-size: var(--text-sm);
    text-align: start;
    white-space: nowrap;
    cursor: default;
  }
  :global(.floating) .item:hover,
  :global(.floating) .item.on {
    background: var(--hover);
  }
  .mark {
    display: inline-grid;
    place-items: center;
    flex: none;
    width: 1em;
    color: var(--text-muted);
    font-size: var(--text-md);
  }
  .label {
    flex: 1 1 auto;
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  kbd {
    flex: none;
    margin-inline-start: var(--space-3);
    font-family: var(--font-ui);
    font-size: var(--text-2xs);
    color: var(--text-subtle);
  }
  .chevron {
    display: inline-grid;
    place-items: center;
    flex: none;
    margin-inline-start: var(--space-3);
    margin-inline-end: -2px;
    color: var(--text-muted);
  }
  /* A write that cannot be undone, in the negative ink, its mark too. */
  :global(.floating) .item.danger,
  .danger .mark {
    color: var(--negative-text);
  }
  :global(.floating) .item.danger:hover,
  :global(.floating) .item.danger.on {
    background: var(--negative-soft);
  }
  /* One that cannot be chosen: quiet, its reason on hover and read out. */
  :global(.floating) .item.off,
  .off .mark {
    color: var(--text-subtle);
  }
  :global(.floating) .item.off:hover,
  :global(.floating) .item.off.on {
    background: color-mix(in oklab, var(--hover) 50%, transparent);
  }
  .rule {
    height: 1px;
    margin: var(--space-1) calc(-1 * var(--space-1));
    background: var(--line);
  }
</style>
