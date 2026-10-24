<script lang="ts">
  import type { Link } from '../models/view.ts'

  let { items }: { items: Link[] } = $props()
</script>

<ul class="related">
  {#each items as l}
    <li>
      <a href={l.href}>
        <span class="label">{l.label}</span>
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
  a:hover {
    background: var(--hover);
  }
  .sub {
    color: var(--text-muted);
    font-size: var(--text-xs);
  }
</style>
