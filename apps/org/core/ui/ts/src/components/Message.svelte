<script lang="ts">
  import type { Snippet } from 'svelte'
  import { date } from '../models/format.ts'

  // One message of a thread: who wrote it and when, over what it says,
  // set in by how deep a reply it is, with its writes at its foot.
  let {
    who,
    at,
    depth = 0,
    marked = false,
    children,
    actions,
  }: {
    who: Snippet
    at: string
    depth?: number
    // The message a reply being written answers.
    marked?: boolean
    children: Snippet
    actions?: Snippet
  } = $props()
</script>

<article class="message" class:marked style:--depth={Math.min(depth, 4)}>
  <header>
    <span class="who">{@render who()}</span>
    <time datetime={at}>{date(at)}</time>
  </header>
  <p class="body">{@render children()}</p>
  {#if actions}
    <footer>{@render actions()}</footer>
  {/if}
</article>

<style>
  .message {
    display: grid;
    gap: var(--space-1);
    margin-inline-start: calc(var(--depth) * var(--space-5));
    padding: var(--space-2) var(--space-3);
    border-inline-start: 2px solid var(--accent-soft);
    border-radius: 0 var(--radius-control) var(--radius-control) 0;
    background: var(--raised);
  }
  .marked {
    border-inline-start-color: var(--accent-border);
  }
  header {
    display: flex;
    gap: var(--space-2);
    align-items: baseline;
    font-size: var(--text-sm);
  }
  .who {
    font-weight: 500;
  }
  /* The author is named, not mentioned: their chip reads as their name. */
  .who :global(.mention) {
    padding: 0;
    background: none;
    color: var(--text);
  }
  time {
    color: var(--text-subtle);
    font-size: var(--text-xs);
  }
  .body {
    margin: 0;
    font-size: var(--text-md);
    line-height: 1.5;
    white-space: pre-wrap;
    overflow-wrap: anywhere;
  }
  footer {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: var(--space-2);
  }
</style>
