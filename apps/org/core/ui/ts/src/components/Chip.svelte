<script lang="ts">
  import type { Kind, Tone } from '../models/view.ts'
  import { show } from '../models/format.ts'
  import { inked, inkOf } from '../models/ink.ts'
  import { useShell } from '../hooks/useShell.ts'
  import { Calendar } from '../icons.ts'
  import Icon from './Icon.svelte'

  // A card's property as a quiet chip, as Linear's board draws them: a
  // hairline outline, small muted text, an icon or a dot before it. A
  // state or a priority keeps its tone as the dot's colour alone; a
  // record wears its own icon in its own ink; a date wears a calendar.
  let { value, kind = 'text', tone, record }: { value: unknown; kind?: Kind; tone?: Tone; record?: string } = $props()
  const text = $derived(show(value, kind))
  const shell = useShell()
  const shown = $derived(kind === 'circle' ? (shell.circle(text) ?? text) : kind === 'person' ? (shell.name(text) ?? text) : text)
  const icon = $derived(kind === 'date' ? Calendar : shell.icon(record ?? (kind === 'person' ? 'people' : undefined), kind === 'circle' ? text : undefined))
  const ink = $derived(record ? inkOf(shown) : kind === 'badge' && (!tone || tone === 'neutral' || tone === 'accent') ? inkOf(text) : undefined)
</script>

{#if text !== '—'}
  <span class="chip" data-tone={tone} style={ink !== undefined ? inked(ink) : undefined}>
    {#if icon}
      <span class="mark" class:inked={ink !== undefined && kind !== 'date'}><Icon {icon} size="1em" weight="regular" /></span>
    {:else if kind === 'badge'}
      <span class="dot" class:inked={ink !== undefined} aria-hidden="true"></span>
    {/if}
    <span class="text">{shown}</span>
  </span>
{/if}

<style>
  .chip {
    min-width: 0;
    display: inline-flex;
    align-items: center;
    gap: 0.3em;
    max-width: 100%;
    padding: 0 var(--space-2);
    border: 1px solid var(--line);
    border-radius: var(--radius-pill);
    color: var(--text-muted);
    font-size: var(--text-xs);
    line-height: calc(1.25rem - 2px);
    white-space: nowrap;
  }
  .text {
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .mark {
    display: inline-flex;
    flex: none;
  }
  .mark.inked {
    color: var(--mark);
  }
  .dot {
    flex: none;
    width: 0.5em;
    height: 0.5em;
    border-radius: 50%;
    background: var(--text-subtle);
  }
  .dot.inked {
    background: var(--mark);
  }
  [data-tone='accent'] .dot {
    background: var(--accent-border);
  }
  [data-tone='positive'] .dot {
    background: var(--positive-text);
  }
  [data-tone='warning'] .dot {
    background: var(--warning-text);
  }
  [data-tone='negative'] .dot {
    background: var(--negative-text);
  }
</style>
