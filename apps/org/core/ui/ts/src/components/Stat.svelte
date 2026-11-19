<script lang="ts">
  import type { Kind, Tone } from '../models/view.ts'
  import Value from './Value.svelte'

  // One computed figure, a tile of `Stats`: its label in quiet sentence
  // case over its value, large in the display face; a tone colours the
  // value alone, never the label or the tile. A figure that names a
  // record links to it (`href`).
  let { label, value, kind = 'text', tone, href }: { label: string; value: unknown; kind?: Kind; tone?: Tone; href?: string } = $props()
</script>

<div class="stat">
  <dt>{label}</dt>
  <dd>
    {#if href}
      <a {href}><Value {value} {kind} {tone} /></a>
    {:else}
      <Value {value} {kind} {tone} />
    {/if}
  </dd>
</div>

<style>
  /* A tile one step from the surface it stands on toward the text, as a
     chip steps, so it stands out on a panel's raised fill and on the
     content's alike, in either theme. */
  .stat {
    display: grid;
    gap: 0.125rem;
    align-content: start;
    min-width: 0;
    padding: var(--space-2) var(--space-3);
    border-radius: var(--radius-control);
    background: color-mix(in oklab, var(--text) calc(var(--lift) * 0.6), var(--surface));
  }
  dt {
    font-size: var(--text-xs);
    color: var(--text-muted);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  dd {
    margin: 0;
    display: flex;
    min-width: 0;
    font-family: var(--font-display);
    font-size: var(--text-lg);
    font-weight: 600;
    line-height: 1.3;
  }
  a:hover {
    text-decoration: underline;
    text-decoration-color: var(--accent-border);
  }
</style>
