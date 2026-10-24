<script lang="ts">
  import Editor from '../lib/editor/Editor.svelte'
  import { usePair } from '../lib/hooks/usePair.ts'

  const pair = usePair()
  let theme = $state<'light' | 'dark' | null>(null)
  let shown = $state(false)

  $effect(() => {
    if (theme) {
      document.documentElement.dataset.theme = theme
    }
  })

  // The e2e tests reach the pair through this.
  ;(globalThis as any).pair = pair
</script>

<svelte:head>
  <title>nabu spike</title>
</svelte:head>

<header>
  <div>
    <h1>Rate card 2027</h1>
    <p>Two nabu editors on two LoroDocs, synced in the page.</p>
  </div>
  <div class="controls">
    <span class="status" class:ok={pair.converged} data-testid="converged">{pair.converged ? 'Converged' : 'Diverged'}</span>
    <label class="toggle">
      <input type="checkbox" checked={pair.online} onchange={(e) => pair.setOnline(e.currentTarget.checked)} data-testid="online" />
      Online{#if !pair.online && pair.queued}&nbsp;· {pair.queued} queued{/if}
    </label>
    <button type="button" onclick={() => (theme = (theme ?? 'light') === 'light' ? 'dark' : 'light')}>Theme</button>
    <button type="button" onclick={() => (shown = !shown)}>Canonical JSON</button>
  </div>
</header>

<main>
  {#each [pair.a, pair.b] as side (side.name)}
    <section>
      <div class="bar">
        <span class="name">Editor {side.name}</span>
        <code title={side.hash} data-testid="hash-{side.name}">blake3 {side.hash.slice(0, 16)}</code>
      </div>
      <div class="panel">
        <Editor editor={side} />
      </div>
      {#if shown}
        <pre>{JSON.stringify(JSON.parse(side.json), null, 2)}</pre>
      {/if}
    </section>
  {/each}
</main>

<style>
  header {
    display: flex;
    justify-content: space-between;
    align-items: end;
    flex-wrap: wrap;
    gap: var(--space-3);
    padding: var(--space-5) var(--space-6) var(--space-3);
  }
  h1 {
    font-family: var(--font-display);
    font-weight: 500;
    font-size: var(--text-2xl);
    margin: 0;
  }
  header p {
    margin: 0;
    color: var(--text-muted);
  }
  .controls {
    display: flex;
    align-items: center;
    gap: var(--space-3);
  }
  .controls button {
    border: 1px solid var(--line);
    background: var(--raised);
    border-radius: var(--radius-control);
    padding: var(--space-1) var(--space-3);
    cursor: pointer;
  }
  .toggle {
    display: flex;
    align-items: center;
    gap: var(--space-1);
  }
  .toggle input {
    width: auto;
  }
  .status {
    padding: 2px var(--space-3);
    border-radius: var(--radius-pill);
    background: var(--negative-soft);
    color: var(--negative-text);
    font-size: var(--text-sm);
    font-weight: 600;
  }
  .status.ok {
    background: var(--positive-soft);
    color: var(--positive-text);
  }
  main {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(22rem, 1fr));
    gap: var(--space-5);
    padding: 0 var(--space-6) var(--space-6);
  }
  .bar {
    display: flex;
    justify-content: space-between;
    padding: 0 var(--space-2) var(--space-2);
    color: var(--text-muted);
    font-size: var(--text-sm);
  }
  .name {
    font-weight: 600;
    color: var(--text);
  }
  .panel {
    background: var(--panel);
    border-radius: var(--radius-panel);
    padding-left: var(--space-4);
  }
  pre {
    font-family: var(--font-mono);
    font-size: var(--text-xs);
    background: var(--sunk);
    padding: var(--space-3);
    border-radius: var(--radius-control);
    max-height: 24rem;
    overflow: auto;
  }
</style>
