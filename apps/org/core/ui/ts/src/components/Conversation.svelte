<script lang="ts">
  import type { Snippet } from 'svelte'
  import { CheckCircle } from '../icons.ts'
  import Icon from './Icon.svelte'

  // A thread: one quiet card under a record's Activity, its messages
  // (`Message`) in it apart by space, its replies set in under their
  // root, and at its foot the box that replies. A resolved thread folds to
  // one quiet line saying so, which opens it to read.
  let {
    resolved = null,
    children,
    reply,
  }: {
    // What its fold says, as `Resolved on 3 March`; none while it is open.
    resolved?: string | null
    children: Snippet
    reply?: Snippet
  } = $props()
</script>

{#if resolved}
  <details class="card resolved" data-conversation>
    <summary><Icon icon={CheckCircle} /> {resolved}</summary>
    <div class="messages">{@render children()}</div>
    {#if reply}<div class="reply">{@render reply()}</div>{/if}
  </details>
{:else}
  <section class="card" data-conversation>
    <div class="messages">{@render children()}</div>
    {#if reply}<div class="reply">{@render reply()}</div>{/if}
  </section>
{/if}

<style>
  .card {
    display: grid;
    gap: var(--space-3);
    padding: var(--space-3);
    border: 1px solid color-mix(in oklab, var(--text) 5%, transparent);
    border-radius: var(--radius-panel);
    --surface: var(--raised);
    background: var(--surface);
  }
  .messages {
    display: grid;
    gap: var(--space-4);
  }
  .resolved {
    padding-block: var(--space-2);
  }
  .resolved[open] {
    padding-block: var(--space-3);
  }
  summary {
    display: flex;
    align-items: center;
    gap: var(--space-2);
    list-style: none;
    color: var(--text-subtle);
    font-size: var(--text-sm);
    cursor: pointer;
  }
  summary::-webkit-details-marker {
    display: none;
  }
  summary:hover {
    color: var(--text-muted);
  }
</style>
