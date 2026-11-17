<script lang="ts">
  import type { Snippet } from 'svelte'
  import Button from './Button.svelte'

  // The box that comments on a quoted text: what it is on, quietly, the
  // quote set apart and read-only, and its fields beneath, with the focus
  // in the first text area. Escape or Cancel closes it.
  let {
    on,
    quote,
    onclose,
    children,
  }: {
    on: string
    quote: string
    onclose: () => void
    children: Snippet
  } = $props()

  const focus = (el: HTMLElement) => el.querySelector('textarea')?.focus()
</script>

<svelte:window
  onkeydown={(e) => {
    if (e.key === 'Escape') {
      onclose()
    }
  }}
/>

<div
  class="remark"
  role="group"
  aria-label="Comment"
  {@attach focus}
>
  <div class="head">
    <span class="on">{on}</span>
    <Button onclick={onclose}>Cancel</Button>
  </div>
  <blockquote class="quote">{quote}</blockquote>
  {@render children()}
</div>

<style>
  .remark {
    display: grid;
    gap: var(--space-3);
    padding-inline: var(--inset, 0);
  }
  .head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--space-2);
  }
  .on {
    font-size: var(--text-xs);
    color: var(--text-subtle);
  }
  .quote {
    margin: 0;
    padding-inline-start: var(--space-3);
    border-inline-start: 2px solid var(--accent-border);
    color: var(--text-muted);
    font-size: var(--text-sm);
    white-space: pre-wrap;
    overflow-wrap: anywhere;
    max-height: 8rem;
    overflow-y: auto;
  }
</style>
