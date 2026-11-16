<script lang="ts">
  import type { Tone } from '../models/view.ts'
  import type { Who as Changer } from '../models/settings.ts'
  import Badge from './Badge.svelte'
  import Who from './Who.svelte'

  // Settings, each said in full: its label and what bounds it, its value
  // now and the one proposed, a badge saying how it bears, and below them
  // a sentence saying what it means, which wraps, never cut off, or, where
  // it says who sets it, an icon beside its label whose tooltip says why. In a
  // section it sits at the section's inset.
  let {
    items,
  }: {
    items: { key: string; label: string; sub?: string; values: { label: string; value: string }[]; badge?: { label: string; tone: Tone }; who?: Changer; text?: string }[]
  } = $props()
</script>

<dl class="explained">
  {#each items as item (item.key)}
    <div class="item">
      <dt>
        <span class="label">{item.label}</span>
        {#if item.who}<Who who={item.who} />{/if}
        {#if item.sub}<span class="sub">{item.sub}</span>{/if}
      </dt>
      <dd class="values">
        {#each item.values as v (v.label)}
          <span class="value"><span class="sub">{v.label}</span> {v.value}</span>
        {/each}
        {#if item.badge}<Badge tone={item.badge.tone}>{item.badge.label}</Badge>{/if}
      </dd>
      {#if item.text}<dd class="text">{item.text}</dd>{/if}
    </div>
  {/each}
</dl>

<style>
  .explained {
    display: grid;
    gap: var(--space-3);
    margin: 0;
    padding-inline: var(--inset, 0);
  }
  .item {
    display: grid;
    gap: var(--space-1);
    max-width: 44rem;
  }
  dt {
    display: flex;
    flex-wrap: wrap;
    align-items: baseline;
    gap: var(--space-2);
  }
  dd {
    margin: 0;
  }
  .label {
    font-weight: 500;
    color: var(--text);
  }
  .sub {
    font-size: var(--text-xs);
    color: var(--text-subtle);
  }
  .values {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: var(--space-3);
    font-size: var(--text-sm);
    font-variant-numeric: tabular-nums;
  }
  .text {
    font-size: var(--text-sm);
    color: var(--text-muted);
    line-height: 1.5;
  }
</style>
