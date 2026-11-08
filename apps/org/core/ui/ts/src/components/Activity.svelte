<script lang="ts">
  import type { Event } from '../models/view.ts'
  import { date } from '../models/format.ts'
  import Person from './Person.svelte'

  // What happened to a record, a line each in the order given; a comment
  // is its line with what it says under it.
  let { items }: { items: Event[] } = $props()
</script>

<ol class="activity">
  {#each items as e}
    <li class:said={e.body}>
      <span class="dot"></span>
      <span class="text">{#if e.who}<b><Person address={e.who} /></b>{' '}{/if}{e.text}</span>
      <time>{date(e.at)}</time>
      {#if e.body}<p class="body">{e.body}</p>{/if}
    </li>
  {/each}
</ol>

<style>
  .activity {
    list-style: none;
    margin: 0;
    padding: 0;
    display: grid;
    gap: var(--space-2);
    font-size: var(--text-sm);
  }
  li {
    display: grid;
    grid-template-columns: auto 1fr auto;
    gap: var(--space-2);
    align-items: baseline;
  }
  .dot {
    width: 6px;
    height: 6px;
    border-radius: 50%;
    background: var(--accent-border);
    transform: translateY(-1px);
  }
  b {
    font-weight: 500;
  }
  .text {
    color: var(--text-muted);
  }
  time {
    color: var(--text-subtle);
    font-size: var(--text-xs);
    white-space: nowrap;
  }
  /* A comment's words, under its line, set apart by a hairline. */
  .said {
    padding-block: var(--space-2);
  }
  .body {
    grid-column: 2 / -1;
    margin: 0;
    padding-inline-start: var(--space-3);
    border-inline-start: 1px solid var(--line);
    color: var(--text);
    white-space: pre-wrap;
    overflow-wrap: anywhere;
  }
</style>
