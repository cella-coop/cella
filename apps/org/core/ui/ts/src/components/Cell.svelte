<script lang="ts">
  import type { Kind, Tone } from '../models/view.ts'
  import { show } from '../models/format.ts'
  import Badge from './Badge.svelte'
  import Person from './Person.svelte'

  let { value, kind = 'text', tone }: { value: unknown; kind?: Kind; tone?: Tone } = $props()
  const text = $derived(show(value, kind))
</script>

{#if kind === 'badge' && text !== '—'}
  <Badge tone={tone ?? 'neutral'}>{text}</Badge>
{:else if kind === 'person' && text !== '—'}
  <Person address={text} />
{:else}
  <span class="cell {kind}" class:empty={text === '—'} class:toned={tone} data-tone={tone}>{text}</span>
{/if}

<style>
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
