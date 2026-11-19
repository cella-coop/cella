<script lang="ts">
  import Check from 'phosphor-svelte/lib/Check'
  import WarningOctagon from 'phosphor-svelte/lib/WarningOctagon'
  import { Calendar } from '../icons.ts'
  import type { Kind, Tone } from '../models/view.ts'
  import { look, type Size } from '../models/prop.ts'
  import { inked } from '../models/ink.ts'
  import { useShell } from '../hooks/useShell.ts'
  import Avatar from './Avatar.svelte'
  import Badge from './Badge.svelte'
  import Chip from './Chip.svelte'
  import Icon from './Icon.svelte'

  // A property's value, drawn as one thing wherever it appears: a cell, a
  // list's line, a card's chip, a drawer's row, an option of a popover.
  // What leads is the kind's: a state is its pill (`Badge`), its dot in
  // its tone (an ink seeded by its value where the tone has no colour of
  // its own), a priority's bars, a
  // person's avatar, a boolean's check, a date's calendar on cards and in
  // the drawer alone. A record, a circle among them, is its `Chip` at
  // every size, its own icon in its own ink inside it. Only the size
  // changes how the rest sits: a `card` is a hairline chip, the rest
  // borderless; in a `drawer` row what leads sits in a box of one width,
  // so the text of every row it leads starts at one edge, and the row's
  // name is the drawer's to draw. A record given its
  // `href` is a link, its chip the link itself. `chip` draws any value as
  // a chip, a person's with their avatar inside, as a group's header names
  // an open set's value. `href` links any kind, not a record alone: a
  // figure that names what it is a figure of.
  let {
    value,
    kind = 'text',
    tone,
    record,
    href,
    size = 'cell',
    chip = false,
  }: { value: unknown; kind?: Kind; tone?: Tone; record?: string; href?: string; size?: Size; chip?: boolean } = $props()

  const shell = useShell()
  const v = $derived(look(shell, value, kind, tone, record))
  const calendar = $derived(kind === 'date' && size === 'card' && !v.empty)
  // A card drops what a person's avatar already says.
  const bare = $derived(kind === 'person' && size === 'card')
</script>

{#if v.empty && size === 'card'}
  <!-- An empty one is drawn not at all on a card. -->
{:else if v.empty && kind !== 'priority'}
  <span class="prop {size}"><span class="text empty">—</span></span>
{:else if v.record || chip}
  <span class="prop {size} record">
    <Chip label={v.shown} icon={v.icon} ink={v.ink} avatar={kind === 'person' ? v.shown : undefined} {href} weight={size === 'card' ? 'regular' : 'duotone'} />
  </span>
{:else if href}
  <!-- A kind with no chip of its own, linked: the figure or the pill
       itself is the link, never a record's, which is its `Chip`'s. -->
  <a class="link" {href}>{@render drawn()}</a>
{:else}
  {@render drawn()}
{/if}

{#snippet drawn()}
  {#if kind === 'badge'}
    <!-- A state is its pill wherever it is drawn: its tone's soft fill, a
         dot in its tone or its ink, and its word. -->
    <span class="prop {size} badge"><Badge {tone} ink={v.ink}>{v.shown}</Badge></span>
  {:else}
    <span
      class="prop {size} {kind}"
      class:chip={size === 'card'}
      title={bare ? v.shown : undefined}
      style={v.ink !== undefined ? inked(v.ink) : undefined}
    >
      {#if size === 'drawer'}
        {#if v.lead !== 'none'}<span class="lead">{@render lead()}</span>{/if}
      {:else}
        {@render lead()}
      {/if}
      {#if calendar}<span class="mark"><Icon icon={Calendar} size="1em" weight="regular" /></span>{/if}
      {#if !bare}
        <span class="text" class:toned={!!tone} data-tone={tone}>
          {v.empty ? 'None' : v.shown}
        </span>
      {/if}
    </span>
  {/if}
{/snippet}

{#snippet lead()}
  {#if v.lead === 'avatar'}
    <Avatar name={v.shown} size={size === 'card' ? '1.25rem' : size === 'drawer' ? '1rem' : '1.1rem'} />
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
  {/if}
{/snippet}

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
  /* A record on a card is its chip, at the card's chips' size. */
  .card.record {
    font-size: var(--text-xs);
  }
  /* In the drawer, what leads is centred in a box as wide as the
     drawer's icon column and as far from the text as its columns are
     apart; the text is the reader's, a day's too. */
  .drawer {
    font-size: var(--text-sm);
    gap: var(--space-2);
  }
  .lead {
    display: inline-flex;
    flex: none;
    justify-content: center;
    width: 1rem;
  }
  .drawer.date .text {
    color: var(--text);
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
  .number,
  .percent,
  .hours {
    font-variant-numeric: tabular-nums;
  }
  /* A kind with no chip of its own, linked: the figure itself is the
     link, never boxed. */
  .link {
    display: contents;
    color: inherit;
  }
  .link:hover .text {
    text-decoration: underline;
    text-decoration-color: var(--accent-border);
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
  .toned[data-tone='failed'] {
    color: var(--help-text);
  }
</style>
