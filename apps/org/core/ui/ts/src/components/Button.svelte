<script lang="ts">
  import type { Snippet } from 'svelte'

  let {
    tone = 'quiet',
    type = 'button',
    href,
    title,
    kbd,
    onclick,
    children,
  }: {
    tone?: 'primary' | 'quiet' | 'danger'
    type?: 'button' | 'submit'
    href?: string
    title?: string
    kbd?: string
    onclick?: (e: MouseEvent) => void
    children: Snippet
  } = $props()
</script>

{#if href}
  <a class="button {tone}" {href} {title}>{@render children()}{#if kbd}<kbd>{kbd}</kbd>{/if}</a>
{:else}
  <button class="button {tone}" {type} {title} {onclick}>{@render children()}{#if kbd}<kbd>{kbd}</kbd>{/if}</button>
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
  .quiet {
    background: var(--sunk);
    color: var(--text);
  }
  .quiet:hover {
    background: var(--hover);
  }
  .primary {
    background: var(--accent-fill);
    color: var(--on-accent);
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
