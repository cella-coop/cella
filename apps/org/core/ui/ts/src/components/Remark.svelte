<script lang="ts">
  import { X } from '../icons.ts'
  import Icon from './Icon.svelte'

  // The quote a comment answers: what it is on, quietly, and the quote set
  // apart and read-only. Inside a box's top (`RichField`'s `head`) a small
  // × drops it, as Escape in the box does, and attached, it puts the focus
  // in the box's text; above a posted comment it is read.
  let {
    on,
    quote,
    ondrop,
  }: {
    on?: string
    quote: string
    ondrop?: () => void
  } = $props()

  const hold = (el: HTMLElement) => {
    const box = ondrop ? el.closest('[data-box-field]') : null
    box?.querySelector<HTMLElement>('[contenteditable="true"]')?.focus()
    const key = (e: Event) => {
      if ((e as KeyboardEvent).key === 'Escape') {
        ondrop?.()
      }
    }
    box?.addEventListener('keydown', key)
    return () => box?.removeEventListener('keydown', key)
  }
</script>

<div class="remark" {@attach hold}>
  {#if on}<span class="on">{on}</span>{/if}
  <div class="quoted">
    <blockquote class="quote">{quote}</blockquote>
    {#if ondrop}
      <button type="button" class="drop" aria-label="Drop the quote" title="Drop the quote" onclick={ondrop}><Icon icon={X} /></button>
    {/if}
  </div>
</div>

<style>
  .remark {
    display: grid;
    gap: var(--space-1);
  }
  .on {
    font-size: var(--text-xs);
    color: var(--text-subtle);
  }
  .quoted {
    display: flex;
    align-items: flex-start;
    gap: var(--space-2);
  }
  .quote {
    flex: 1;
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
  .drop {
    display: inline-grid;
    place-items: center;
    width: 1.25rem;
    height: 1.25rem;
    padding: 0;
    border: 0;
    border-radius: var(--radius-control);
    background: none;
    color: var(--text-subtle);
    font-size: var(--text-xs);
    cursor: pointer;
  }
  .drop:hover {
    background: var(--hover);
    color: var(--text);
  }
</style>
