<script lang="ts">
  import type { Link } from '../models/view.ts'
  import { record } from '../models/drawer.ts'
  import { useShell } from '../hooks/useShell.ts'
  import { useRelated } from '../hooks/useRelated.ts'
  import { inked, inkOf } from '../models/ink.ts'
  import Icon from './Icon.svelte'

  // The records a page links to, and its jumps, each one line of the
  // drawer's rows' height: its collection's icon, its name, ending in an
  // ellipsis where it runs out, and at its end how many rows a jump
  // holds, or what a record is to this one (`sub`), quiet. A record
  // wears its collection's icon in its own ink, its collection read from
  // its link where it names none. A long list shows its first few and
  // Show N more.
  let { items }: { items: Link[] } = $props()
  const shell = useShell()
  const state = useRelated()

  const few = 5
  const long = $derived(items.length > few + 2)
  const shown = $derived(long && !state.all ? items.slice(0, few) : items)
</script>

<ul class="related">
  {#each shown as l}
    {const jump = $derived(l.count !== undefined)}
    {const icon = $derived(shell.icon(l.collection ?? record(l.href)))}
    <li>
      <a href={l.href} class:jump title={l.sub ? `${l.label}, ${l.sub}` : l.label}>
        <span class="mark" class:inked={!jump} style={jump ? undefined : inked(inkOf(l.label))} aria-hidden="true">{#if icon}<Icon {icon} size="1em" />{/if}</span>
        <span class="label">{l.label}</span>
        {#if jump}
          <span class="count">{l.count}</span>
        {:else if l.sub}
          <span class="sub"><span class="visually-hidden">, </span>{l.sub}</span>
        {/if}
      </a>
    </li>
  {/each}
  {#if long}
    <li>
      <button type="button" class="more" aria-expanded={state.all} onclick={() => state.toggle()}>
        <span class="mark" aria-hidden="true"></span>
        <span class="label">{state.all ? 'Show fewer' : `Show ${items.length - few} more`}</span>
      </button>
    </li>
  {/if}
</ul>

<style>
  /* Each line as the drawer's Properties draw theirs: one height, its
     icon in a column of one width, bleeding past the heading's edge by
     its padding so its hover fill does while its text lines up. */
  .related {
    list-style: none;
    display: grid;
    gap: 2px;
    margin: 0 calc(-1 * var(--space-2));
    padding: 0;
    font-size: var(--text-sm);
  }
  a,
  .more {
    display: flex;
    align-items: center;
    gap: var(--space-2);
    min-width: 0;
    min-height: 1.875rem;
    padding: 0 var(--space-2);
    border-radius: var(--radius-control);
    line-height: 1.4;
    color: var(--text);
  }
  a:hover,
  .more:hover {
    background: var(--hover);
  }
  .more {
    width: 100%;
    border: none;
    background: none;
    font: inherit;
    color: var(--text-muted);
    text-align: start;
    cursor: pointer;
  }
  .label {
    flex: 1;
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .mark {
    display: inline-flex;
    flex: none;
    justify-content: center;
    width: 1rem;
    color: var(--text-muted);
  }
  .mark.inked {
    color: var(--mark);
  }
  .count,
  .sub {
    flex: none;
    color: var(--text-muted);
    font-variant-numeric: tabular-nums;
  }
  .sub {
    max-width: 45%;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    color: var(--text-subtle);
  }
</style>
