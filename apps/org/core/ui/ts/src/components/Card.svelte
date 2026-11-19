<script lang="ts">
  import type { Component, Snippet } from 'svelte'
  import type { Tone } from '../models/view.ts'
  import Heading from './Heading.svelte'

  // A borderless card, raised on the panel: the drawer's View or Legend,
  // a dashboard's figure. Its header is the one heading, as a `Panel`'s:
  // its icon, its count muted, a state's pill and an optional quiet
  // control at its end, which the title's own line makes room for; its
  // own padding insets what it holds.
  let {
    title,
    icon,
    count,
    status,
    actions,
    children,
  }: { title: string; icon?: Component<any>; count?: number; status?: { label: string; tone?: Tone; ink?: number } | null; actions?: Snippet; children: Snippet } = $props()
</script>

<section class="card">
  <Heading {title} {icon} {count} {status} {actions} />
  {@render children()}
</section>

<style>
  .card {
    --inset: 0;
    display: grid;
    gap: var(--space-2);
    padding: var(--space-3) var(--space-4) var(--space-4);
    --surface: var(--raised);
    background: var(--surface);
    border-radius: var(--radius-panel);
    min-width: 0;
  }
</style>
