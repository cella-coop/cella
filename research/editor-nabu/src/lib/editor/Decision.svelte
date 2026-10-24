<script lang="ts">
  import { decisions } from '../decisions.ts'
  import type { DecisionBlock } from './decision.svelte.ts'

  let { block }: { block: DecisionBlock } = $props()

  const d = $derived(decisions[block.ref])
  const objections = $derived(d?.votes.filter((v) => v.stance === 'object').length ?? 0)

  function remove() {
    block.nabu.tree.delete(block.node.id)
    block.nabu.commit()
  }
</script>

<div
  bind:this={block.element}
  class="decision"
  class:selected={block.selected}
  data-block-id={block.id}
  data-block-type="decision"
  data-nabu-inert
  contenteditable="false"
>
  <div class="head">
    <span class="eyebrow">Decision <span class="ref">{block.ref}</span></span>
    <button type="button" class="remove" data-nabu-ui aria-label="Remove decision" onmousedown={(e) => { e.preventDefault(); remove() }}>×</button>
  </div>
  {#if d}
    <div class="title">{d.title}</div>
    <div class="meta">
      <span>{d.circle}</span>
      <span>{d.rule}</span>
      <span>closes {d.deadline}</span>
      <span class:objection={objections > 0}>{d.votes.length} votes · {objections} objection{objections === 1 ? '' : 's'}</span>
    </div>
  {:else}
    <div class="title">Unknown decision</div>
  {/if}
</div>

<style>
  .decision {
    user-select: none;
    margin: var(--space-3) 0;
    padding: var(--space-3) var(--space-4);
    background: var(--raised);
    border: 1px solid var(--line);
    border-left: 3px solid var(--accent-fill);
    border-radius: var(--radius-control);
    font-family: var(--font-ui);
    white-space: normal;
  }
  .selected {
    box-shadow: var(--focus);
  }
  .head {
    display: flex;
    justify-content: space-between;
    align-items: center;
  }
  .eyebrow {
    font-size: var(--text-2xs);
    letter-spacing: var(--eyebrow-tracking);
    text-transform: uppercase;
    color: var(--accent-text);
  }
  .ref {
    text-transform: none;
    letter-spacing: 0;
    font-family: var(--font-mono);
  }
  .title {
    font-family: var(--font-display);
    font-size: var(--text-lg);
    margin: var(--space-1) 0;
  }
  .meta {
    display: flex;
    flex-wrap: wrap;
    gap: var(--space-3);
    font-size: var(--text-sm);
    color: var(--text-muted);
  }
  .objection {
    color: var(--negative-text);
  }
  .remove {
    border: none;
    background: transparent;
    color: var(--text-subtle);
    cursor: pointer;
    font-size: var(--text-lg);
    line-height: 1;
  }
</style>
