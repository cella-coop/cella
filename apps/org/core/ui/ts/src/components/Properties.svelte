<script lang="ts">
  import type { Prop } from '../models/view.ts'
  import Cell from './Cell.svelte'

  let { items }: { items: Prop[] } = $props()

  // The collection a property's link is a record of, where it is one:
  // `/<collection>/<id>`, whose icon its value wears.
  const record = (href: string | undefined) => href?.match(/^\/([\w-]+)\/[^/?#]+$/)?.[1]
</script>

<dl class="props">
  {#each items as p}
    <dt>{p.label}</dt>
    <dd>
      {#if p.href}
        <a href={p.href}><Cell value={p.value} kind={p.kind} tone={p.tone} record={record(p.href)} /></a>
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
    padding-inline: var(--inset, 0);
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
  /* A long value ends in an ellipsis inside the card, not past its edge. */
  dd > :global(*) {
    min-width: 0;
    max-width: 100%;
  }
  a {
    display: flex;
    min-width: 0;
  }
  a:hover {
    text-decoration: underline;
    text-decoration-color: var(--accent-border);
  }
</style>
