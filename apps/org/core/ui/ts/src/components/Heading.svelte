<script lang="ts">
  import type { Component, Snippet } from 'svelte'
  import type { Tone } from '../models/view.ts'
  import Badge from './Badge.svelte'
  import Icon from './Icon.svelte'
  import Meta from './Meta.svelte'

  // The one heading: a title in the display face, quiet by weight rather
  // than by size, an icon before it where it has one and its count muted
  // beside it; and, as a header's row, the state's pill, quiet facts and
  // small actions at its end. A panel's header, a section's and a card's,
  // the drawer's sections and the record page's Related and Activity all
  // wear it, so the app has one heading.
  let {
    title,
    id,
    icon,
    count,
    status,
    meta,
    actions,
  }: {
    title: string
    // The title's id, for what it names (`aria-labelledby`).
    id?: string
    icon?: Component<any>
    count?: number
    // The state of what it heads, as its pill.
    status?: { label: string; tone?: Tone; ink?: number } | null
    meta?: string | (string | null | undefined | false)[] | null
    actions?: Snippet
  } = $props()
</script>

<div class="heading">
  <h2 class="title" {id}>
    {#if icon}<span class="mark" aria-hidden="true"><Icon {icon} size="1em" /></span>{/if}
    <span class="name">{title}</span>
    {#if count !== undefined}<span class="count">{count}</span>{/if}
  </h2>
  {#if status || meta || actions}
    <span class="end">
      {#if status}<Badge tone={status.tone} ink={status.ink}>{status.label}</Badge>{/if}
      <Meta text={meta} />
      {@render actions?.()}
    </span>
  {/if}
</div>

<style>
  .heading {
    display: flex;
    align-items: center;
    justify-content: space-between;
    flex-wrap: wrap;
    gap: var(--space-1) var(--space-3);
    min-width: 0;
    min-height: 1.5rem;
  }
  /* The operator's drawer heading (19 Nov), the one heading everywhere:
     the weight carries it, the colour steps back a tad below muted. */
  .title {
    display: flex;
    align-items: center;
    gap: var(--space-2);
    min-width: 0;
    margin: 0;
    font-family: var(--font-display);
    font-size: calc(var(--text-sm) * 1.1);
    font-weight: 650;
    letter-spacing: normal;
    line-height: 1.3;
    color: color-mix(in oklab, var(--text-muted) 60%, var(--text-subtle));
  }
  .name {
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .mark {
    display: inline-flex;
    flex: none;
  }
  .count {
    font-family: var(--font-ui);
    font-size: var(--text-xs);
    font-weight: 400;
    color: var(--text-subtle);
    font-variant-numeric: tabular-nums;
  }
  .end {
    display: inline-flex;
    align-items: center;
    flex-wrap: wrap;
    gap: var(--space-2);
    min-width: 0;
    margin-inline-start: auto;
  }
</style>
