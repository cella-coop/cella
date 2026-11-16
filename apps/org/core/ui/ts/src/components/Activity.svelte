<script lang="ts">
  import type { Event } from '../models/view.ts'
  import { date, relative } from '../models/format.ts'
  import Person from './Person.svelte'

  // What happened to a record, a compact timeline, oldest first; a
  // comment is its line with what it says under it. Enough of them
  // crowd a flat line, so they group by day, each day's heading once.
  let { items }: { items: Event[] } = $props()

  const crowded = 6
  const groups = $derived.by(() => {
    if (items.length <= crowded) {
      return [{ day: null as string | null, items }]
    }
    const out: { day: string | null; items: Event[] }[] = []
    for (const e of items) {
      const day = String(e.at).slice(0, 10)
      const last = out.at(-1)
      if (last?.day === day) {
        last.items.push(e)
      } else {
        out.push({ day, items: [e] })
      }
    }
    return out
  })
</script>

<div class="activity">
  {#each groups as g (g.items[0]?.at ?? g.day)}
    {#if g.day}<h3 class="day">{date(g.day)}</h3>{/if}
    <ol class="line">
      {#each g.items as e}
        <li class:said={e.body}>
          <span class="dot"></span>
          <span class="text">{#if e.who}<b><Person address={e.who} /></b>{' '}{/if}{e.text}<time>{relative(e.at)}</time></span>
          {#if e.body}<p class="body">{e.body}</p>{/if}
        </li>
      {/each}
    </ol>
  {/each}
</div>

<style>
  .activity {
    display: grid;
    gap: var(--space-2);
    font-size: var(--text-sm);
  }
  .day {
    font-family: var(--font-ui);
    font-size: var(--text-xs);
    font-weight: 500;
    color: var(--text-subtle);
    margin: 0;
  }
  .line {
    position: relative;
    list-style: none;
    margin: 0;
    padding: 0;
    display: grid;
    gap: var(--space-3);
  }
  /* The thread through every dot, behind them. */
  .line::before {
    content: '';
    position: absolute;
    left: 2.5px;
    top: 6px;
    bottom: 6px;
    width: 1px;
    background: var(--line);
  }
  li {
    position: relative;
    display: flex;
    flex-wrap: wrap;
    align-items: baseline;
    gap: var(--space-2);
    padding-inline-start: var(--space-4);
  }
  .dot {
    position: absolute;
    left: 0;
    top: 0.5em;
    width: 6px;
    height: 6px;
    border-radius: 50%;
    background: var(--accent-border);
    transform: translateY(-50%);
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
    margin-inline-start: var(--space-2);
  }
  /* A comment's words, under its line, set apart by a hairline. */
  .said {
    align-items: flex-start;
    padding-block-end: var(--space-2);
  }
  .body {
    flex-basis: 100%;
    margin: 0;
    margin-inline-start: calc(-1 * var(--space-4));
    padding-inline-start: calc(var(--space-4) + var(--space-3));
    border-inline-start: 1px solid var(--line);
    color: var(--text);
    white-space: pre-wrap;
    overflow-wrap: anywhere;
  }
</style>
