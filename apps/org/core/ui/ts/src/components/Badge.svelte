<script lang="ts">
  import type { Snippet } from 'svelte'
  import type { Tone } from '../models/view.ts'

  let { tone = 'neutral', children }: { tone?: Tone; children: Snippet } = $props()
</script>

<span class="badge {tone}">{@render children()}</span>

<style>
  /* A long value ends in an ellipsis where its cell runs out. */
  .badge {
    display: inline-block;
    max-width: 100%;
    overflow: hidden;
    text-overflow: ellipsis;
    vertical-align: middle;
    padding: 0 var(--space-2);
    border-radius: var(--radius-pill);
    font-size: var(--text-xs);
    font-weight: 500;
    line-height: 1.4rem;
    white-space: nowrap;
  }
  .neutral {
    background: var(--neutral-soft);
    color: var(--neutral-text);
  }
  .accent {
    background: var(--accent-soft);
    color: var(--accent-text);
  }
  .positive {
    background: var(--positive-soft);
    color: var(--positive-text);
  }
  .negative {
    background: var(--negative-soft);
    color: var(--negative-text);
  }
  .warning {
    background: var(--warning-soft);
    color: var(--warning-text);
  }
</style>
