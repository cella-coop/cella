<script lang="ts">
  import type { Snippet } from 'svelte'
  import type { Tone } from '../models/view.ts'

  // A state, its tone its class, the same in both themes: neutral at rest
  // (a draft, closed, voided); accent under way (open, unpaid, submitted),
  // a soft ring around muted text, quieter than what wants attention;
  // positive settled (paid, passed); warning wanting attention (overdue,
  // suspended); negative refused or failed. The fills are soft tints, lighter still in
  // dark (`--soft`), so a tone shows in its text and never saturates.
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
    border: 1px solid transparent;
    border-radius: var(--radius-pill);
    font-size: var(--text-xs);
    font-weight: 500;
    line-height: calc(1.4rem - 2px);
    white-space: nowrap;
  }
  .neutral {
    background: var(--neutral-soft);
    color: var(--neutral-text);
  }
  .accent {
    border-color: var(--accent-ring);
    color: var(--text-muted);
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
