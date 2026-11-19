<script lang="ts">
  import type { Component, Snippet } from 'svelte'
  import type { Tone } from '../models/view.ts'
  import { inked } from '../models/ink.ts'
  import Icon from './Icon.svelte'

  // A state, its tone its class, the same in both themes: neutral at rest
  // (a draft, closed, voided); accent under way (open, unpaid, submitted),
  // a soft ring around muted text, quieter than what wants attention;
  // positive settled (paid, passed); warning wanting attention (overdue,
  // suspended); negative refused or failed. The fills are soft tints, lighter still in
  // dark (`--soft`), so a tone shows in its text and never saturates. A
  // badge naming a record wears its collection's `icon` before its text,
  // in the record's own ink (`ink`, `models/ink.ts`'s `inkOf`) where one
  // is given; one with neither wears a small dot instead, in its tone or
  // its ink, as Linear's chips do, so a state is never told by colour
  // alone but always carries one.
  let { tone = 'neutral', icon, ink, children }: { tone?: Tone; icon?: Component<any>; ink?: number; children: Snippet } = $props()
</script>

<span class="badge {tone}" style={ink !== undefined ? inked(ink) : undefined}>
  {#if icon}
    <span class="mark" class:inked={ink !== undefined}><Icon {icon} size="1em" /></span>
  {:else}
    <span class="dot" class:inked={ink !== undefined} aria-hidden="true"></span>
  {/if}
  <span class="text">{@render children()}</span>
</span>

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
  .mark {
    display: inline-flex;
    vertical-align: -0.125em;
    margin-inline-end: var(--space-1);
    opacity: 0.7;
  }
  .mark.inked {
    opacity: 1;
    color: var(--mark);
  }
  .dot {
    display: inline-block;
    width: 0.4em;
    height: 0.4em;
    margin-inline-end: var(--space-1);
    border-radius: 50%;
    background: currentColor;
    vertical-align: middle;
  }
  .dot.inked {
    background: var(--mark);
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
