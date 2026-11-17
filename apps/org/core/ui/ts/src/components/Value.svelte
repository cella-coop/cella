<script lang="ts">
  import Check from 'phosphor-svelte/lib/Check'
  import WarningOctagon from 'phosphor-svelte/lib/WarningOctagon'
  import { Calendar } from '../icons.ts'
  import type { Kind, Tone } from '../models/view.ts'
  import { look, type Size } from '../models/prop.ts'
  import { inked } from '../models/ink.ts'
  import { useShell } from '../hooks/useShell.ts'
  import Avatar from './Avatar.svelte'
  import Icon from './Icon.svelte'

  // A property's value, drawn as one thing wherever it appears: a cell, a
  // list's line, a card's chip, a drawer's row, an option of a popover.
  // What leads is the kind's: a state's tone as a dot (an ink seeded by its
  // value where the tone has no colour of its own), a priority's bars, a
  // person's avatar, a circle's or record's own icon in its own ink, a
  // boolean's check, a date's calendar on cards and in the drawer alone.
  // Only the size changes how it sits: a `card` is a hairline chip, the
  // rest borderless; a `drawer` row carries its `label` before a date, a
  // figure or a phrase, which cannot say what they are.
  let {
    value,
    kind = 'text',
    tone,
    record,
    size = 'cell',
    label,
  }: { value: unknown; kind?: Kind; tone?: Tone; record?: string; size?: Size; label?: string } = $props()

  const shell = useShell()
  const v = $derived(look(shell, value, kind, tone, record))
  const calendar = $derived(kind === 'date' && (size === 'card' || size === 'drawer') && !v.empty)
  const named = $derived(size === 'drawer' && label && ['date', 'money', 'number', 'text', 'title', 'mono'].includes(kind))
  // A card drops what a person's avatar already says.
  const bare = $derived(kind === 'person' && size === 'card')
</script>

{#if v.empty && size === 'card'}
  <!-- An empty one is drawn not at all on a card. -->
{:else if v.empty && kind !== 'priority'}
  <span class="prop {size}"><span class="text empty">—</span></span>
{:else}
  <span
    class="prop {size} {kind}"
    class:chip={size === 'card'}
    data-tone={kind === 'badge' ? tone : undefined}
    title={bare ? v.shown : undefined}
    style={v.ink !== undefined ? inked(v.ink) : undefined}
  >
    {#if v.lead === 'avatar'}
      <Avatar name={v.shown} size={size === 'card' ? '1.25rem' : '1.1rem'} />
    {:else if v.lead === 'icon' && v.icon}
      <span class="mark inked"><Icon icon={v.icon} size="1em" weight={size === 'card' ? 'regular' : 'duotone'} /></span>
    {:else if v.lead === 'bars'}
      {#if v.level === 'urgent'}
        <span class="mark urgent"><Icon icon={WarningOctagon} size="1em" weight="fill" /></span>
      {:else if v.level}
        <svg class="bars" viewBox="0 0 12 12" width="1em" height="1em" aria-hidden="true">
          {#each [1, 2, 3] as n (n)}
            <rect x={n * 4 - 3.5} y={12 - n * 3.5} width="3" height={n * 3.5} rx="0.6" class:on={n <= (v.level as number)} />
          {/each}
        </svg>
      {:else}
        <svg class="dash" viewBox="0 0 12 12" width="1em" height="1em" aria-hidden="true">
          <line x1="1" y1="6" x2="11" y2="6" stroke-dasharray="2 1.5" />
        </svg>
      {/if}
    {:else if v.lead === 'check'}
      <span class="mark checked"><Icon icon={Check} size="1em" weight="regular" /></span>
    {:else if v.lead === 'dot'}
      <span class="dot" class:inked={v.ink !== undefined} aria-hidden="true"></span>
    {/if}
    {#if calendar}<span class="mark"><Icon icon={Calendar} size="1em" weight="regular" /></span>{/if}
    {#if !bare}
      <span class="text" class:toned={tone && kind !== 'badge'} data-tone={tone}>
        {#if named}<span class="name">{label}</span>{' '}{/if}{v.empty ? 'None' : v.shown}
      </span>
    {/if}
  </span>
{/if}

<style>
  .prop {
    display: inline-flex;
    align-items: center;
    gap: var(--space-1);
    min-width: 0;
    max-width: 100%;
    vertical-align: middle;
  }
  .text {
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .empty {
    color: var(--text-subtle);
  }
  .name {
    color: var(--text-muted);
  }
  .mark {
    display: inline-flex;
    flex: none;
    color: var(--text-muted);
  }
  .mark.inked {
    color: var(--mark);
  }
  .mark.urgent {
    color: var(--negative-text);
  }
  .mark.checked {
    color: var(--positive-text);
  }
  .dot {
    flex: none;
    width: 0.5em;
    height: 0.5em;
    margin-inline: 0.1em;
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
  .bars,
  .dash {
    flex: none;
    color: var(--text-muted);
  }
  .bars rect {
    fill: currentColor;
    opacity: 0.25;
  }
  .bars rect.on {
    opacity: 1;
  }
  .dash line {
    stroke: currentColor;
    stroke-width: 1.2;
    opacity: 0.6;
  }

  /* A card's property as a quiet chip, as Linear's board draws them. */
  .chip {
    padding: 0 var(--space-2);
    border: 1px solid var(--line);
    border-radius: var(--radius-pill);
    color: var(--text-muted);
    font-size: var(--text-xs);
    line-height: calc(1.25rem - 2px);
    gap: 0.3em;
  }
  .chip.person {
    padding: 0;
    border: none;
  }
  .drawer {
    font-size: var(--text-sm);
  }
  .drawer.mono,
  .cell.mono,
  .mono {
    font-family: var(--font-mono);
    font-size: var(--text-xs);
    color: var(--text-muted);
  }
  .title {
    color: var(--text);
    font-weight: 500;
  }
  .money,
  .number {
    font-variant-numeric: tabular-nums;
  }
  .date .text {
    color: var(--text-muted);
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
