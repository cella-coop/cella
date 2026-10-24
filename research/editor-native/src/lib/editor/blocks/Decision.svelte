<script lang="ts">
  import type { View } from '../../hooks/EditorState.svelte.ts'

  let { view }: { view: View } = $props()

  // Mock decisions: the embed reads the decision feat in cella.
  const decisions: Record<string, { title: string; outcome: string; circle: string; date: string }> = {
    'd-2026-011': { title: 'Rate card 2027', outcome: 'Adopted, 7 for, 1 against', circle: 'Coordination', date: '2026-10-20' },
  }
  const id = $derived(view.props.decision ?? 'd-2026-011')
  const d = $derived(decisions[id])
</script>

<div class="card" data-atomic={view.id} contenteditable="false">
  <div class="eyebrow">Decision · {id}</div>
  {#if d}
    <div class="title">{d.title}</div>
    <div class="meta">
      <span class="pill">{d.outcome}</span>
      <span>{d.circle} · {d.date}</span>
    </div>
  {:else}
    <div class="title">Unknown decision</div>
  {/if}
</div>

<style>
  .card {
    background: var(--raised);
    border: 1px solid var(--line);
    border-radius: var(--radius-panel);
    padding: var(--space-3) var(--space-4);
    display: flex;
    flex-direction: column;
    gap: var(--space-1);
    user-select: none;
    cursor: default;
  }

  .eyebrow {
    font-size: var(--text-2xs);
    letter-spacing: var(--eyebrow-tracking);
    text-transform: uppercase;
    color: var(--text-muted);
  }

  .title {
    font-family: var(--font-display);
    font-size: var(--text-lg);
  }

  .meta {
    display: flex;
    gap: var(--space-3);
    align-items: center;
    font-size: var(--text-sm);
    color: var(--text-muted);
  }

  .pill {
    background: var(--positive-soft);
    color: var(--positive-text);
    border-radius: var(--radius-pill);
    padding: 0 var(--space-2);
  }
</style>
