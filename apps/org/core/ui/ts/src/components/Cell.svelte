<script lang="ts">
  import type { Kind, Tone } from '../models/view.ts'
  import { show } from '../models/format.ts'
  import { inked, inkOf } from '../models/ink.ts'
  import { useShell } from '../hooks/useShell.ts'
  import Badge from './Badge.svelte'
  import Icon from './Icon.svelte'
  import Person from './Person.svelte'

  // A value as a cell, a card's field or a property draws it. One that
  // names a record, of the collection `record` names, wears that
  // collection's icon before it, in the record's own ink
  // (`models/ink.ts`'s `inkOf`); a person is always one of `people`.
  let { value, kind = 'text', tone, record }: { value: unknown; kind?: Kind; tone?: Tone; record?: string } = $props()
  const text = $derived(show(value, kind))
  const shell = useShell()
  // A circle's id is drawn as its name, where the member reads it.
  const shown = $derived(kind === 'circle' ? (shell.circle(text) ?? text) : text)
  const icon = $derived(text === '—' ? undefined : shell.icon(record ?? (kind === 'person' ? 'people' : undefined)))
  const tint = $derived(icon && record ? inkOf(shown) : null)
  // A chip always shows a colour: its record's ink, its tone's where the
  // tone has one, else an ink seeded by its value (the operator, 16 Nov).
  const chip = $derived(record ? inkOf(shown) : !tone || tone === 'neutral' || tone === 'accent' ? inkOf(text) : undefined)
</script>

{#snippet mark()}
  {#if icon}<span class="mark" class:inked={tint !== null} style={tint !== null ? inked(tint) : undefined}><Icon {icon} size="1em" /></span>{/if}
{/snippet}

{#if kind === 'badge' && text !== '—'}
  <Badge tone={tone ?? 'neutral'} {icon} ink={chip}>{text}</Badge>
{:else if kind === 'person' && text !== '—'}
  <span class="record">{@render mark()}<Person address={text} /></span>
{:else if icon}
  <span class="record">{@render mark()}<span class="cell {kind}" class:toned={tone} data-tone={tone}>{shown}</span></span>
{:else}
  <span class="cell {kind}" class:empty={text === '—'} class:toned={tone} data-tone={tone}>{shown}</span>
{/if}

<style>
  .record {
    display: inline-flex;
    align-items: center;
    gap: var(--space-1);
    min-width: 0;
    max-width: 100%;
  }
  .mark {
    display: inline-flex;
    flex: none;
    color: var(--text-muted);
  }
  .mark.inked {
    color: var(--mark);
  }
  .cell {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .title {
    color: var(--text);
    font-weight: 500;
  }
  .mono {
    font-family: var(--font-mono);
    font-size: var(--text-xs);
    color: var(--text-muted);
  }
  .money,
  .number {
    font-variant-numeric: tabular-nums;
  }
  .date {
    color: var(--text-muted);
  }
  .empty {
    color: var(--text-subtle);
    font-family: var(--font-ui);
  }
  .toned[data-tone='negative'] {
    color: var(--negative-text);
  }
  .toned[data-tone='positive'] {
    color: var(--positive-text);
  }
  .toned[data-tone='warning'] {
    color: var(--warning-text);
  }
  .toned[data-tone='accent'] {
    color: var(--accent-text);
  }
</style>
