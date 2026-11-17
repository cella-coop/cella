<script lang="ts">
  import type { Tone } from '../models/view.ts'

  // A count of each answer, as one thin bar split in proportion and the
  // counts as a line under it, each beside its tone's dot; an empty tally
  // is a bare track.
  let { items }: { items: { label: string; value: number; tone?: Tone }[] } = $props()
  const total = $derived(items.reduce((n, i) => n + i.value, 0))
</script>

<div class="tally">
  <div class="bar" aria-hidden="true">
    {#each items as i (i.label)}
      {#if i.value > 0}<span class="part" data-tone={i.tone ?? 'neutral'} style:flex-grow={i.value}></span>{/if}
    {/each}
  </div>
  <ul class="counts" aria-label="Tally of {total}">
    {#each items as i (i.label)}
      <li><span class="dot" data-tone={i.tone ?? 'neutral'} aria-hidden="true"></span>{i.label} <b>{i.value}</b></li>
    {/each}
  </ul>
</div>

<style>
  .tally {
    display: grid;
    gap: var(--space-2);
  }
  .bar {
    display: flex;
    gap: 2px;
    height: 0.4rem;
    border-radius: var(--radius-pill);
    background: var(--neutral-soft);
    overflow: hidden;
  }
  .part {
    flex-basis: 0;
    background: var(--text-subtle);
  }
  .counts {
    display: flex;
    flex-wrap: wrap;
    gap: var(--space-1) var(--space-4);
    margin: 0;
    padding: 0;
    list-style: none;
    font-size: var(--text-sm);
    color: var(--text-muted);
  }
  .counts b {
    font-weight: 600;
    color: var(--text);
    font-variant-numeric: tabular-nums;
  }
  .dot {
    display: inline-block;
    width: 0.5em;
    height: 0.5em;
    margin-inline-end: var(--space-1);
    border-radius: 50%;
    background: var(--text-subtle);
  }
  [data-tone='positive'] {
    background: var(--positive-text);
  }
  [data-tone='negative'] {
    background: var(--negative-text);
  }
  [data-tone='warning'] {
    background: var(--warning-text);
  }
  [data-tone='accent'] {
    background: var(--accent-border);
  }
</style>
