<script lang="ts">
  import type { Snippet } from 'svelte'
  import { place } from '../models/place.ts'

  // The one popover: what a trigger opens, in the top layer, so no
  // sidebar or panel clips it. Native `popover`: Escape and a click
  // outside close it, and closing returns focus to the trigger. Anchored
  // to its trigger by CSS anchor positioning, flipped to stay in the
  // viewport; where a browser lacks it, placed by hand on opening. As a
  // menu, it focuses its first item on opening, and the arrow keys, Home
  // and End move among its items. `open` opens it once it is drawn, as a
  // condition just added opens to pick its values; `onclose` hears it
  // close.
  let {
    label,
    trigger,
    children,
    side = 'bottom',
    menu = true,
    wide = false,
    button = false,
    chip = false,
    open = false,
    onclose,
  }: {
    // What the trigger opens: the popover's name, and the trigger's
    // description beside the name its visible text gives it, so a voice
    // naming what it sees reaches it.
    label: string
    trigger: Snippet
    children: Snippet
    side?: 'bottom' | 'top'
    menu?: boolean
    wide?: boolean
    // The trigger reads as a quiet button, as wide as its text, as on a
    // page; otherwise it fills its row, as in the sidebar.
    button?: boolean
    // The trigger reads as a chip, as a condition on a collection's rows.
    chip?: boolean
    open?: boolean
    onclose?: () => void
  } = $props()

  const id = $props.id()
  const opening = (pop: HTMLElement) => {
    if (open && !pop.matches(':popover-open')) {
      pop.showPopover()
    }
  }
  const items = (pop: HTMLElement) => [...pop.querySelectorAll<HTMLElement>('[role^="menuitem"]:not([disabled])')]

  function ontoggle(e: ToggleEvent) {
    const pop = e.currentTarget as HTMLElement
    if (e.newState !== 'open') {
      onclose?.()
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

  // A link chosen in it leaves the page, so it closes as it goes.
  function onclick(e: MouseEvent) {
    if ((e.target as HTMLElement).closest('a[href]')) {
      ;(e.currentTarget as HTMLElement).hidePopover()
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

<button class="trigger" class:button class:chip popovertarget={id} aria-haspopup={menu ? 'menu' : 'dialog'} aria-describedby="{id}-about" style:anchor-name="--{id}">
  {@render trigger()}
  <span id="{id}-about" hidden>{label}</span>
</button>
<div
  {@attach opening}
  {id}
  popover="auto"
  class="popover {side}"
  class:wide
  role={menu ? 'menu' : 'dialog'}
  aria-label={label}
  style:position-anchor="--{id}"
  {ontoggle}
  {onclick}
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
  .chip {
    width: auto;
    max-width: 100%;
    padding: 0 var(--space-2);
    border-radius: var(--radius-pill);
    line-height: 1.6rem;
    font-size: var(--text-xs);
    background: var(--accent-soft);
    color: var(--accent-text);
  }
  .chip:hover {
    background: var(--accent-soft);
    color: var(--text);
  }
  .popover {
    margin: 0;
    width: 16rem;
    max-width: calc(100vw - 2 * var(--space-2));
    max-height: calc(100dvh - 2 * var(--space-2));
    overflow-y: auto;
    padding: var(--space-2);
    /* A hairline edge, so the float stands off what it lies over in dark
       as well as in light. */
    border: 1px solid var(--line);
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
