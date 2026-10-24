<script lang="ts">
  import type { Snippet } from 'svelte'
  import { place } from '../models/place.ts'

  // The one popover: what a trigger opens, in the top layer, so no
  // sidebar or panel clips it. Native `popover`: Escape and a click
  // outside close it, and closing returns focus to the trigger. Anchored
  // to its trigger by CSS anchor positioning, flipped to stay in the
  // viewport; where a browser lacks it, placed by hand on opening. As a
  // menu, it focuses its first item on opening, and the arrow keys, Home
  // and End move among its items.
  let {
    label,
    trigger,
    children,
    side = 'bottom',
    menu = true,
    wide = false,
    button = false,
  }: {
    // The trigger's name for assistive technology.
    label: string
    trigger: Snippet
    children: Snippet
    side?: 'bottom' | 'top'
    menu?: boolean
    wide?: boolean
    // The trigger reads as a quiet button, as wide as its text, as on a
    // page; otherwise it fills its row, as in the sidebar.
    button?: boolean
  } = $props()

  const id = $props.id()
  const items = (pop: HTMLElement) => [...pop.querySelectorAll<HTMLElement>('[role^="menuitem"]:not([disabled])')]

  function ontoggle(e: ToggleEvent) {
    const pop = e.currentTarget as HTMLElement
    if (e.newState !== 'open') {
      return
    }
    const anchor = document.querySelector<HTMLElement>(`[popovertarget="${id}"]`)
    if (anchor && !CSS.supports('position-anchor', '--a')) {
      place(pop, anchor, side)
    }
    if (menu) {
      const on = pop.querySelector<HTMLElement>('[role^="menuitem"][aria-checked="true"]')
      ;(on ?? items(pop)[0])?.focus()
    }
  }

  function onkeydown(e: KeyboardEvent) {
    if (!menu) {
      return
    }
    const list = items(e.currentTarget as HTMLElement)
    const at = list.indexOf(document.activeElement as HTMLElement)
    const to =
      e.key === 'ArrowDown' ? (at + 1) % list.length
      : e.key === 'ArrowUp' ? (at - 1 + list.length) % list.length
      : e.key === 'Home' ? 0
      : e.key === 'End' ? list.length - 1
      : -1
    if (to >= 0 && list.length) {
      e.preventDefault()
      list[to].focus()
    }
  }
</script>

<button class="trigger" class:button popovertarget={id} aria-haspopup={menu ? 'menu' : 'dialog'} aria-label={label} style:anchor-name="--{id}">
  {@render trigger()}
</button>
<div
  {id}
  popover="auto"
  class="popover {side}"
  class:wide
  role={menu ? 'menu' : 'dialog'}
  aria-label={label}
  style:position-anchor="--{id}"
  {ontoggle}
  {onkeydown}
>
  {@render children()}
</div>

<style>
  .trigger {
    display: flex;
    align-items: center;
    gap: var(--space-2);
    width: 100%;
    padding: var(--space-1);
    border: none;
    border-radius: var(--radius-control);
    background: none;
    text-align: start;
    cursor: pointer;
  }
  .trigger:hover {
    background: var(--hover);
  }
  .button {
    width: auto;
    height: 2rem;
    padding: 0 var(--space-3);
    background: var(--sunk);
    color: var(--text);
    font-size: var(--text-sm);
    font-weight: 500;
    white-space: nowrap;
    justify-self: start;
    align-self: end;
  }
  .popover {
    margin: 0;
    width: 16rem;
    max-width: calc(100vw - 2 * var(--space-2));
    max-height: calc(100dvh - 2 * var(--space-2));
    overflow-y: auto;
    padding: var(--space-2);
    border: none;
    border-radius: var(--radius-float);
    background: var(--float);
    color: var(--text);
    box-shadow: var(--shadow-float);
    position-try-fallbacks: flip-block, flip-inline;
  }
  .wide {
    width: 18rem;
  }
  .popover:popover-open {
    display: grid;
    gap: var(--space-1);
  }
  .bottom {
    position-area: bottom span-right;
    margin-top: var(--space-1);
  }
  .top {
    position-area: top span-right;
    margin-bottom: var(--space-1);
  }
</style>
