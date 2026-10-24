<script lang="ts">
  import type { Event } from '../models/view.ts'
  import { date } from '../models/format.ts'

  let { items }: { items: Event[] } = $props()
</script>

<ol class="activity">
  {#each items as e}
    <li>
      <span class="dot"></span>
      <span class="text">{#if e.who}<b>{e.who}</b>{' '}{/if}{e.text}</span>
      <time>{date(e.at)}</time>
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
</style>
