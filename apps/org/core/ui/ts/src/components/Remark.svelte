<script lang="ts">
  import type { Snippet } from 'svelte'
  import { X } from '../icons.ts'
  import Icon from './Icon.svelte'

  // The box that comments on a text, always there under its Activity:
  // its fields, and above them, where the comment is on a quote, what it
  // is on, quietly, and the quote set apart and read-only, with a small ×
  // that drops it, as Escape inside the box does. Attaching a quote puts
  // the focus in the first text area.
  let {
    on,
    quote = null,
    ondrop,
    children,
  }: {
    on?: string
    quote?: string | null
    ondrop?: () => void
    children: Snippet
  } = $props()

  const focus = (el: HTMLElement) => {
    if (quote) {
      el.querySelector('textarea')?.focus()
    }
  }
  const escape = (el: HTMLElement) => {
    const key = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && quote) {
        ondrop?.()
      }
    }
    el.addEventListener('keydown', key)
    return () => el.removeEventListener('keydown', key)
  }
</script>

<div class="remark" role="group" aria-label="Comment" {@attach focus} {@attach escape}>
  {#if quote}
    {#if on}<span class="on">{on}</span>{/if}
    <div class="quoted">
      <blockquote class="quote">{quote}</blockquote>
      {#if ondrop}
        <button type="button" class="drop" aria-label="Drop the quote" title="Drop the quote" onclick={ondrop}><Icon icon={X} /></button>
      {/if}
    </div>
  {/if}
  {@render children()}
</div>

<style>
  .remark {
    display: grid;
    gap: var(--space-2);
    padding-inline: var(--inset, 0);
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
    background: var(--sunk);
    color: var(--text);
  }
</style>
