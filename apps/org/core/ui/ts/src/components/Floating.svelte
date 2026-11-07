<script lang="ts">
  import type { Snippet } from 'svelte'

  // Something that floats at a point rather than from a trigger: a menu
  // at the caret, a toolbar over a selection. In the top layer, as the
  // Popover is (native `popover`, opened manually, since what opens it is
  // typing and not a click), so nothing clips it; kept inside the
  // viewport. Its buttons are a toolbar's or a menu's options, the chosen
  // one `aria-selected`; a press on it never takes the focus, so the
  // caret stays where it was.
  let {
    x,
    y,
    label,
    role = 'dialog',
    children,
  }: {
    x: number
    y: number
    label: string
    role?: 'dialog' | 'listbox' | 'toolbar' | 'menu'
    children: Snippet
  } = $props()

  const margin = 8
  const open = (el: HTMLElement) => {
    el.showPopover()
    return () => {
      if (el.matches(':popover-open')) {
        el.hidePopover()
      }
    }
  }
  const left = $derived(typeof window === 'undefined' ? x : Math.max(margin, Math.min(x, window.innerWidth - margin - 240)))
  const top = $derived(typeof window === 'undefined' ? y : Math.max(margin, Math.min(y, window.innerHeight - margin - 48)))
</script>

<div
  class="floating {role}"
  popover="manual"
  {role}
  aria-label={label}
  style:left="{left}px"
  style:top="{top}px"
  onmousedown={(e) => {
    if ((e.target as HTMLElement).closest('button')) {
      e.preventDefault()
    }
  }}
  {@attach open}
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
