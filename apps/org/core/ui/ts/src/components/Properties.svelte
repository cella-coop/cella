<script lang="ts">
  import type { Prop } from '../models/view.ts'
  import Cell from './Cell.svelte'

  let { items }: { items: Prop[] } = $props()

  // The collection a property's link is a record of, where it is one:
  // `/<collection>/<id>`, whose icon its value wears.
  const record = (href: string | undefined) => href?.match(/^\/([\w-]+)\/[^/?#]+$/)?.[1]

  // Clustered under the subheading a property's `group` names, in the
  // order one first names it; those naming none sit in a group of their
  // own, first and unheaded, as every property does where none of them
  // name one.
  const groups = $derived.by(() => {
    const out: { name: string | null; items: Prop[] }[] = []
    for (const p of items) {
      const name = p.group ?? null
      let g = out.find((g) => g.name === name)
      if (!g) {
        g = { name, items: [] }
        out.push(g)
      }
      g.items.push(p)
    }
    return out
  })
</script>

{#each groups as g (g.name)}
  {#if g.name}<h3 class="group">{g.name}</h3>{/if}
  <dl class="props">
    {#each g.items as p}
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
{/each}

<style>
  .group {
    font-family: var(--font-ui);
    font-size: var(--text-xs);
    font-weight: 500;
    color: var(--text-subtle);
    padding-inline: var(--inset, 0);
    margin: var(--space-3) 0 0;
  }
  .group:first-child {
    margin-top: 0;
  }
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
