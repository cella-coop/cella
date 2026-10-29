<script lang="ts">
  import CheckCircle from 'phosphor-svelte/lib/CheckCircle'
  import XCircle from 'phosphor-svelte/lib/XCircle'
  import HourglassMedium from 'phosphor-svelte/lib/HourglassMedium'
  import Question from 'phosphor-svelte/lib/Question'
  import X from 'phosphor-svelte/lib/X'
  import { none, said, type Outcome } from '../models/outcome.ts'
  import Icon from './Icon.svelte'

  // A write's outcome, floating until dismissed: each write it made, its
  // verdict and, if refused, the rule's reason; for a write of several
  // stopped part-way, that those it wrote first stand and only the rest
  // is left to send; and, when no answer came back, that it is unknown.
  let { outcome, ondismiss }: { outcome: Outcome; ondismiss: () => void } = $props()

  const icons = { settled: CheckCircle, refused: XCircle, pending: HourglassMedium, failed: XCircle, unknown: Question }
  const all = $derived([outcome, ...outcome.then])

  // Escape dismisses the outcome first, before a page's own Escape, such
  // as the detail view's way back, which a handled press leaves alone; an
  // open dialog takes Escape itself.
  function onkeydown(e: KeyboardEvent) {
    if (e.key !== 'Escape' || document.querySelector('dialog[open]')) {
      return
    }
    e.preventDefault()
    ondismiss()
  }
</script>

<svelte:window onkeydowncapture={onkeydown} />

<div class="outcome" role="status" aria-live="polite" data-state={outcome.state}>
  <div class="body">
    <ul>
      {#each all as o, i}
        <li class={o.state} class:then={i > 0}>
          <Icon icon={icons[o.state]} />
          <span class="what">
            {#if o.op !== none}<code>{o.op}</code>{/if}
            <b>{said(o)}</b>
            {#if o.reason}<span class="reason">{o.reason}</span>{/if}
          </span>
        </li>
      {/each}
    </ul>
    {#if outcome.spent?.length}
      <p class="part">
        Stopped part-way: {outcome.spent.length === 1 ? 'the write before it settled and stands' : `the ${outcome.spent.length} writes before it settled and stand`}, cleared from the form. Send it again to write only the rest.
      </p>
    {/if}
  </div>
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
  .pending,
  .unknown {
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
  .body {
    display: grid;
    gap: var(--space-2);
  }
  .part {
    margin: 0;
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
