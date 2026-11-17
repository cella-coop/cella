<script lang="ts">
  import type { Snippet } from 'svelte'
  import '../styles/tokens.css'
  import '../styles/base.css'
  import favicon from '@cella/brand/favicon.svg?url'
  import DemoBanner from './DemoBanner.svelte'

  // What a person reaches before signing in, alone on the page: the
  // co-op's mark and name above one panel, the sign-in or an invitation;
  // in a demo build, the demo's banner above them.
  let {
    scope,
    demo = false,
    copy = 0,
    ends = 0,
    join = '',
    children,
  }: {
    scope: { address: string; name: string; legal: string | null }
    demo?: boolean
    copy?: number
    ends?: number
    join?: string
    children: Snippet
  } = $props()
</script>

<svelte:head>
  <link rel="icon" type="image/svg+xml" href={favicon} />
</svelte:head>

<div class="gate">
  <div class="panel">
    {#if demo}<DemoBanner {copy} {ends} {join} />{/if}
    <p class="coop"><span class="mark">{scope.name.slice(0, 1).toUpperCase()}</span><b>{scope.name}</b></p>
    {@render children()}
  </div>
</div>

<style>
  .gate {
    display: grid;
    place-items: center;
    min-height: 100dvh;
    padding: var(--space-4);
  }
  .panel {
    display: grid;
    gap: var(--space-4);
    width: min(28rem, 100%);
    padding: var(--space-5);
    background: var(--panel);
    border-radius: var(--radius-panel);
  }
  .coop {
    display: flex;
    align-items: center;
    gap: var(--space-2);
    margin: 0;
    font-family: var(--font-display);
    font-size: var(--text-lg);
  }
  .coop b {
    font-weight: 500;
  }
  .mark {
    display: grid;
    place-items: center;
    width: 1.75rem;
    height: 1.75rem;
    border-radius: var(--radius-control);
    background: var(--accent-fill);
    color: var(--on-accent);
    font-size: var(--text-md);
  }
</style>
