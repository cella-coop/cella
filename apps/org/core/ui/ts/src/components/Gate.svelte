<script lang="ts">
  import type { Snippet } from 'svelte'
  import '../styles/tokens.css'
  import '../styles/base.css'
  import favicon from '@cella/brand/favicon.svg?url'
  import DemoBanner from './DemoBanner.svelte'

  // What a person reaches before signing in, alone on the page: the
  // co-op's mark and name above one panel, the sign-in or an invitation;
  // in a demo build, the demo's banner, one fixed strip at the viewport's
  // foot, which pads the page by its own height so it hides nothing, or,
  // dismissed, by its watermark's reach from the foot instead.
  let {
    wide = false,
    scope,
    demo = false,
    copy = 0,
    ends = 0,
    join = '',
    children,
  }: {
    // The sign-in's: no panel of its own, for it lays out cards.
    wide?: boolean
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
  <div class="panel" class:wide>
    {#if !wide}<p class="coop"><span class="mark">{scope.name.slice(0, 1).toUpperCase()}</span><b>{scope.name}</b></p>{/if}
    {@render children()}
  </div>
</div>
{#if demo}<DemoBanner {copy} {ends} {join} />{/if}

<style>
  .gate {
    display: grid;
    place-items: center;
    min-height: 100dvh;
    padding: var(--space-4);
    padding-bottom: calc(var(--space-4) + var(--demo-banner-h, 0px) + var(--demo-watermark-h, 0px));
  }
  .panel {
    display: grid;
    gap: var(--space-4);
    width: min(28rem, 100%);
    padding: var(--space-5);
    background: var(--panel);
    border-radius: var(--radius-panel);
  }
  .panel.wide {
    width: 100%;
    padding: 0;
    background: none;
  }
  .wide .coop {
    justify-content: center;
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
