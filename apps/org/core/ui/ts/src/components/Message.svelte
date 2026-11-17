<script lang="ts">
  import type { Snippet } from 'svelte'
  import { useShell } from '../hooks/useShell.ts'
  import { date, relative } from '../models/format.ts'
  import Avatar from './Avatar.svelte'
  import Person from './Person.svelte'

  // One message of a thread, as `Conversation` holds it: a small avatar,
  // its author's name and a quiet relative time on one line, what it says
  // under them at body size, and under that its `foot`, as its reactions.
  // Its `actions`, small icon buttons, sit at its top right, shown on
  // hover or focus, always where there is no hover. A reply is set in by
  // how deep it is. `who` draws the name where a slice draws people its
  // own way; else it is the person's name as the co-op knows it.
  let {
    author,
    name,
    who,
    at,
    depth = 0,
    marked = false,
    children,
    actions,
    foot,
  }: {
    // Its author's address.
    author: string
    // Their name, where the slice knows it; else the shell's.
    name?: string | null
    who?: Snippet
    at: string
    depth?: number
    // The message a reply being written answers.
    marked?: boolean
    children: Snippet
    actions?: Snippet
    foot?: Snippet
  } = $props()

  const shell = useShell()
  const known = $derived(name ?? shell.name(author) ?? author)
</script>

<article class="message" class:marked style:--depth={Math.min(depth, 4)}>
  <header>
    <Avatar name={known} size="1.25rem" />
    <span class="who">{#if who}{@render who()}{:else if name}{name}{:else}<Person address={author} />{/if}</span>
    <time datetime={at} title={date(at)}>{relative(at)}</time>
    {#if actions}
      <span class="actions">{@render actions()}</span>
    {/if}
  </header>
  <div class="body">{@render children()}</div>
  {#if foot}
    <footer>{@render foot()}</footer>
  {/if}
</article>

<style>
  .message {
    display: grid;
    gap: var(--space-1);
    margin-inline-start: calc(var(--depth) * var(--space-5));
  }
  header {
    display: flex;
    align-items: center;
    gap: var(--space-2);
    min-height: 1.75rem;
    font-size: var(--text-sm);
  }
  .who {
    font-weight: 500;
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
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
    white-space: nowrap;
  }
  .actions {
    display: flex;
    gap: 2px;
    margin-inline-start: auto;
    opacity: 0;
    transition: opacity var(--fast) var(--ease);
  }
  .message:hover .actions,
  .message:focus-within .actions {
    opacity: 1;
  }
  @media (hover: none) {
    .actions {
      opacity: 1;
    }
  }
  /* The text lines up with the name, past the avatar. */
  .body,
  footer {
    padding-inline-start: calc(1.25rem + var(--space-2));
  }
  .body {
    font-size: var(--text-md);
    line-height: 1.55;
    overflow-wrap: anywhere;
  }
  .marked .body {
    box-shadow: inset 2px 0 0 var(--accent-border);
  }
  footer {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: var(--space-2);
  }
</style>
