<script lang="ts">
  import CheckCircle from 'phosphor-svelte/lib/CheckCircle'
  import XCircle from 'phosphor-svelte/lib/XCircle'
  import HourglassMedium from 'phosphor-svelte/lib/HourglassMedium'
  import X from 'phosphor-svelte/lib/X'
  import { said, type Outcome } from '../models/outcome.ts'
  import Icon from './Icon.svelte'

  // A write's outcome, floating until dismissed: each write it made, its
  // verdict and, if refused, the rule's reason.
  let { outcome, ondismiss }: { outcome: Outcome; ondismiss: () => void } = $props()

  const icons = { settled: CheckCircle, refused: XCircle, pending: HourglassMedium, failed: XCircle }
  const all = $derived([outcome, ...outcome.then])
</script>

<svelte:window onkeydown={(e) => e.key === 'Escape' && ondismiss()} />

<div class="outcome" role="status" aria-live="polite" data-state={outcome.state}>
  <ul>
    {#each all as o, i}
      <li class={o.state} class:then={i > 0}>
        <Icon icon={icons[o.state]} />
        <span class="what">
          <code>{o.op}</code>
          <b>{said(o)}</b>
          {#if o.reason}<span class="reason">{o.reason}</span>{/if}
        </span>
      </li>
    {/each}
  </ul>
  <button class="close" onclick={ondismiss} aria-label="Dismiss"><Icon icon={X} /></button>
</div>

<style>
  .outcome {
    position: fixed;
    inset-block-end: var(--space-5);
    inset-inline-end: var(--space-5);
    z-index: 50;
    max-width: 28rem;
    display: flex;
    gap: var(--space-3);
    align-items: start;
    background: var(--float);
    border-radius: var(--radius-float);
    box-shadow: var(--shadow-float);
    padding: var(--space-3) var(--space-3) var(--space-3) var(--space-4);
    font-size: var(--text-sm);
  }
  ul {
    list-style: none;
    margin: 0;
    padding: 0;
    display: grid;
    gap: var(--space-2);
  }
  li {
    display: flex;
    gap: var(--space-2);
    align-items: start;
  }
  li.then {
    padding-inline-start: var(--space-4);
  }
  li :global(svg) {
    flex-shrink: 0;
    margin-top: 0.15em;
  }
  .settled {
    color: var(--positive-text);
  }
  .refused,
  .failed {
    color: var(--negative-text);
  }
  .pending {
    color: var(--warning-text);
  }
  .what {
    display: grid;
    color: var(--text);
  }
  code {
    color: var(--text-muted);
    font-size: var(--text-xs);
  }
  b {
    font-weight: 500;
  }
  .reason {
    color: var(--text-muted);
  }
  .close {
    border: none;
    background: none;
    color: var(--text-muted);
    cursor: pointer;
    padding: var(--space-1);
    border-radius: var(--radius-control);
  }
  .close:hover {
    background: var(--hover);
  }
</style>
