<script lang="ts">
  import type { Prop } from '../models/view.ts'
  import Cell from './Cell.svelte'

  let { items }: { items: Prop[] } = $props()
</script>

<dl class="props">
  {#each items as p}
    <dt>{p.label}</dt>
    <dd>
      {#if p.href}
        <a href={p.href}><Cell value={p.value} kind={p.kind} tone={p.tone} /></a>
      {:else}
        <Cell value={p.value} kind={p.kind} tone={p.tone} />
      {/if}
    </dd>
  {/each}
</dl>

<style>
  .props {
    display: grid;
    grid-template-columns: minmax(6rem, auto) 1fr;
    gap: var(--space-1) var(--space-3);
    margin: 0;
    font-size: var(--text-sm);
    align-items: baseline;
  }
  dt {
    color: var(--text-muted);
  }
  dd {
    margin: 0;
    min-width: 0;
    display: flex;
  }
  a:hover {
    text-decoration: underline;
    text-decoration-color: var(--accent-border);
  }
</style>
