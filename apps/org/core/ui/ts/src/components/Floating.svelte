<script lang="ts">
  import type { Snippet } from 'svelte'
  import { fit } from '../models/menu.ts'

  // Something that floats at a point rather than from a trigger: a menu
  // at the caret or at the pointer, a toolbar over a selection. In the
  // top layer, as the Popover is (native `popover`, opened manually,
  // since what opens it is typing or a press and not a trigger), so
  // nothing clips it; kept inside the viewport by its own measured size,
  // and drawn above `above` where below `y` it would pass the window's
  // bottom, and ending at `before` where from `x` it would pass its right
  // edge, as a submenu flips to its parent's other side. Its buttons are a
  // toolbar's or a menu's options, the chosen one `aria-selected`; a
  // press on it never takes the focus, so the caret stays where it was.
  // As a `menu` it fades and grows in from where it opens.
  let {
    x,
    y,
    above,
    before,
    label,
    role = 'dialog',
    id,
    children,
  }: {
    x: number
    y: number
    // Where its bottom goes when it is drawn above, as over the caret.
    above?: number
    // Where its right edge goes when it is drawn leftward.
    before?: number
    label: string
    role?: 'dialog' | 'listbox' | 'toolbar' | 'menu'
    id?: string
    children: Snippet
  } = $props()

  const open = (el: HTMLElement) => {
    el.showPopover()
    return () => {
      if (el.matches(':popover-open')) {
        el.hidePopover()
      }
    }
  }
  // Placed again as its point moves or its size changes.
  const place = (el: HTMLElement) => {
    const at = { x, y, above, before }
    const put = () => {
      const { left, top } = fit(at, el.offsetWidth, el.offsetHeight, window.innerWidth, window.innerHeight)
      el.style.left = `${left}px`
      el.style.top = `${top}px`
      el.style.transformOrigin = `${left < at.x ? 'right' : 'left'} ${top < at.y ? 'bottom' : 'top'}`
    }
    put()
    const seen = new ResizeObserver(put)
    seen.observe(el)
    return () => seen.disconnect()
  }
</script>

<div
  class="floating {role}"
  popover="manual"
  {id}
  {role}
  aria-label={label}
  onmousedown={(e) => {
    if ((e.target as HTMLElement).closest('button')) {
      e.preventDefault()
    }
  }}
  {@attach open}
  {@attach place}
>
  {@render children()}
</div>

<style>
  .floating {
    position: fixed;
    inset: auto;
    margin: 0;
    padding: var(--space-1);
    border: 1px solid var(--line);
    border-radius: var(--radius-float);
    background: var(--float);
    color: var(--text);
    box-shadow: var(--shadow-float);
    font-family: var(--font-ui);
    font-size: var(--text-md);
  }
  .floating:popover-open {
    display: flex;
  }
  .listbox:popover-open,
  .menu:popover-open,
  .dialog:popover-open {
    flex-direction: column;
    min-width: 14rem;
    max-height: 18rem;
    overflow: auto;
  }
  /* A menu: compact, as tall as the window lets it, fading and growing in
     from where it opens, quickly. */
  .menu:popover-open {
    min-width: 12rem;
    max-width: 20rem;
    max-height: calc(100dvh - 16px);
    gap: 1px;
    opacity: 1;
    scale: 1;
    transition:
      opacity var(--fast) var(--ease),
      scale var(--fast) var(--ease);
  }
  @starting-style {
    .menu:popover-open {
      opacity: 0;
      scale: 0.96;
    }
  }
  .toolbar {
    gap: 2px;
    padding: 2px;
    border-radius: var(--radius-control);
  }
  .floating :global(button) {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: var(--space-4);
    min-width: 2rem;
    min-height: 1.9rem;
    padding: var(--space-1) var(--space-2);
    border: none;
    border-radius: var(--radius-control);
    background: none;
    color: inherit;
    text-align: left;
    cursor: pointer;
  }
  .floating :global(button:hover),
  .floating :global([aria-selected='true']),
  .floating :global([aria-pressed='true']) {
    background: var(--hover);
  }
  .floating :global(.hint),
  .floating :global(.none) {
    color: var(--text-subtle);
    font-family: var(--font-mono);
    font-size: var(--text-xs);
  }
  .floating :global(.none) {
    padding: var(--space-1) var(--space-2);
  }
  .floating :global(.bold) {
    font-weight: 700;
  }
  .floating :global(.italic) {
    font-style: italic;
  }
  .floating :global(.code) {
    font-family: var(--font-mono);
    font-size: var(--text-xs);
  }
</style>
