<script lang="ts">
  import type { Link } from '../models/view.ts'
  import { useShell } from '../hooks/useShell.ts'
  import Icon from './Icon.svelte'

  // The records a page links to, and its jumps: each collection holding
  // rows that name the record, by its icon and name, and how many.
  let { items }: { items: Link[] } = $props()
  const shell = useShell()
</script>

<ul class="related">
  {#each items as l}
    {const icon = $derived(l.collection ? shell.icon(l.collection) : undefined)}
    <li>
      <a href={l.href} class:jump={l.count !== undefined}>
        {#if icon}<span class="mark"><Icon {icon} size="1em" /></span>{/if}
        <span class="label">{l.label}</span>
        {#if l.count !== undefined}<span class="count">{l.count}</span>{/if}
        {#if l.sub}<span class="sub">{l.sub}</span>{/if}
      </a>
    </li>
  {/each}
</ul>

<style>
  .related {
    list-style: none;
    margin: 0 calc(-1 * var(--space-2));
    padding: 0;
    font-size: var(--text-sm);
  }
  a {
    display: grid;
    padding: var(--space-1) var(--space-2);
    border-radius: var(--radius-control);
    line-height: 1.3;
  }
  a.jump {
    grid-template-columns: auto 1fr auto;
    align-items: center;
    gap: var(--space-2);
  }
  a:hover {
    background: var(--hover);
  }
  .mark {
    display: inline-flex;
    color: var(--text-muted);
  }
  .count {
    color: var(--text-muted);
    font-variant-numeric: tabular-nums;
  }
  .sub {
    color: var(--text-muted);
    font-size: var(--text-xs);
  }
</style>
