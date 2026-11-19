<script lang="ts">
  import type { Kind, Tone } from '../models/view.ts'
  import { show } from '../models/format.ts'

  // A whole split in parts: one thin bar in proportion and its legend
  // under it, each part's dot in its tone, its label and its figure, as a
  // vote's stances or what an invoice has had paid of it. `of` is the
  // whole where the parts fall short of it, its rest a bare track, as
  // eight stances of ten; `kind` writes the figures, a sum as money. An
  // empty tally is a bare track.
  let { items, of, kind = 'number' }: { items: { label: string; value: number; tone?: Tone }[]; of?: number; kind?: Kind } = $props()
  const total = $derived(items.reduce((n, i) => n + i.value, 0))
  const rest = $derived(of !== undefined && of > total ? of - total : 0)
</script>

<div class="tally">
  <div class="bar" aria-hidden="true">
    {#each items as i (i.label)}
      {#if i.value > 0}<span class="part" data-tone={i.tone ?? 'neutral'} style:flex-grow={i.value}></span>{/if}
    {/each}
    {#if rest > 0}<span class="rest" style:flex-grow={rest}></span>{/if}
  </div>
  <ul class="legend" aria-label="Tally of {show(of ?? total, kind)}">
    {#each items as i (i.label)}
      <li><span class="dot" data-tone={i.tone ?? 'neutral'} aria-hidden="true"></span>{i.label} <b>{show(i.value, kind)}</b></li>
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
  .rest {
    flex-basis: 0;
  }
  .legend {
    display: flex;
    flex-wrap: wrap;
    gap: var(--space-1) var(--space-4);
    margin: 0;
    padding: 0;
    list-style: none;
    font-size: var(--text-sm);
    color: var(--text-muted);
  }
  .legend b {
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
