<script lang="ts">
  import type { Snippet } from 'svelte'

  let {
    tone = 'quiet',
    type = 'button',
    href,
    download,
    title,
    kbd,
    busy = false,
    disabled = false,
    onclick,
    icon = false,
    'aria-label': ariaLabel,
    children,
  }: {
    // Its icon alone, small and square, with no fill until hovered, as a
    // comment's Reply; it is named by `aria-label` and `title`.
    icon?: boolean
    tone?: 'primary' | 'quiet' | 'danger' | 'subtle'
    type?: 'button' | 'submit'
    href?: string
    // A link that saves what it points to under this name, as an export.
    download?: string
    title?: string
    kbd?: string
    // Its action is under way: it keeps focus but reads as unavailable.
    busy?: boolean
    // Nothing to do yet, as a form with nothing changed.
    disabled?: boolean
    onclick?: (e: MouseEvent) => void
    // An icon-only button's name, where its words say nothing of it.
    'aria-label'?: string
    children: Snippet
  } = $props()
</script>

{#if href}
  <a class="button {tone}" class:icon {href} {download} {title} {onclick} aria-label={ariaLabel}>{@render children()}{#if kbd}<kbd>{kbd}</kbd>{/if}</a>
{:else}
  <button class="button {tone}" class:icon {type} {title} {onclick} {disabled} aria-busy={busy} aria-disabled={busy} aria-label={ariaLabel}>
    {@render children()}{#if kbd}<kbd>{kbd}</kbd>{/if}
  </button>
{/if}

<style>
  .button {
    display: inline-flex;
    align-items: center;
    gap: var(--space-2);
    height: 2rem;
    padding: 0 var(--space-3);
    border: 1px solid transparent;
    border-radius: var(--radius-control);
    font-size: var(--text-sm);
    font-weight: 500;
    cursor: pointer;
    white-space: nowrap;
    transition: background var(--fast) var(--ease);
  }
  .button.icon {
    justify-content: center;
    width: 1.75rem;
    height: 1.75rem;
    padding: 0;
    background: none;
    color: var(--text-muted);
    font-size: var(--text-md);
  }
  .button.icon:hover {
    background: var(--hover);
    color: var(--text);
  }
  .button:disabled {
    opacity: 0.5;
    cursor: default;
  }
  .button[aria-busy='true'] {
    opacity: 0.6;
    cursor: progress;
  }
  .quiet {
    background: var(--sunk);
    color: var(--text);
  }
  .quiet:hover {
    background: var(--hover);
  }
  /* A secondary way somewhere, as the sidebar's More…: no fill and
     text-subtle, the dimmest that still clears AA, until hovered, so it
     never competes with what it follows. */
  .subtle {
    background: none;
    color: var(--text-subtle);
  }
  .subtle:hover {
    background: var(--hover);
    color: var(--text);
  }
  /* The one primary action, the site's own ink
     (`styles/base.css`'s `--primary-fill`, the ink specimen's lead). */
  .primary {
    background: var(--primary-fill);
    color: var(--primary-text);
  }
  .primary:hover {
    filter: brightness(0.94);
  }
  .danger {
    background: var(--negative-soft);
    color: var(--negative-text);
  }
  .danger:hover {
    filter: brightness(0.96);
  }
  kbd {
    font-family: var(--font-ui);
    font-size: var(--text-2xs);
    opacity: 0.7;
    padding: 0 0.3em;
    border-radius: 4px;
    background: oklch(0.5 0 0 / 12%);
  }
</style>
