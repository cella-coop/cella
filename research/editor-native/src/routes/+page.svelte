<script lang="ts">
  import Editor from '#lib/editor/Editor.svelte'
  import { PairState } from '#lib/hooks/PairState.svelte.ts'
  import type { EditorState } from '#lib/hooks/EditorState.svelte.ts'
  import { createDoc, order, kind, props, text } from '#lib/model/doc.ts'
  import { runs } from '#lib/model/ops.ts'
  import { canonical, jcs } from '#lib/model/canonical.ts'
  import { seed } from '#lib/model/seed.ts'

  // Two clients of one document: Ada seeds it with the rate card, Bo starts
  // from Ada's snapshot, and from then on they only exchange updates.
  const ada = createDoc(1)
  seed(ada)
  const bo = createDoc(2)
  bo.import(ada.export({ mode: 'snapshot' }))
  const pair = new PairState(ada, bo)
  $effect(() => () => pair.destroy())

  const sides = [
    { name: 'Ada', doc: ada, i: 0 },
    { name: 'Bo', doc: bo, i: 1 },
  ] as const

  let theme = $state<'light' | 'dark' | null>(null)
  const editors: EditorState[] = []

  // A window into the model for the browser tests.
  const rows = (i: number) => {
    const doc = pair.docs[i]
    return order(doc).map((r) => ({ id: r.id, depth: r.depth, kind: kind(doc, r.id), props: props(doc, r.id), text: text(doc, r.id).toString(), runs: runs(text(doc, r.id)) }))
  }
  const expose = (ed: EditorState) => {
    editors.push(ed)
    ;(window as unknown as { __spike: unknown }).__spike = { pair, editors, rows, canon: (i: number) => jcs(canonical(pair.docs[i])) }
  }

  function flip() {
    const dark = theme ? theme === 'dark' : matchMedia('(prefers-color-scheme: dark)').matches
    theme = dark ? 'light' : 'dark'
    document.documentElement.dataset.theme = theme
  }
</script>

<svelte:head>
  <title>Native editor</title>
</svelte:head>

<main>
  <header>
    <div>
      <div class="eyebrow">Spike · Loro-native block editor</div>
      <h1>Rate card 2027</h1>
    </div>
    <div class="controls">
      <label class="toggle">
        <input type="checkbox" checked={pair.online} onchange={() => pair.toggle()} data-testid="online" />
        Online
      </label>
      <label>
        Delay
        <input type="range" min="0" max="2000" step="100" bind:value={pair.delay} data-testid="delay" />
        <span class="mono">{pair.delay} ms</span>
      </label>
      <span class="status" class:ok={pair.converged} data-testid="converged">
        {pair.converged ? 'Converged' : 'Diverged'}
      </span>
      <button onclick={flip} data-testid="theme">Theme</button>
    </div>
  </header>
  <div class="pair">
    {#each sides as side (side.name)}
      <section class="side" data-side={side.name}>
        <div class="head">
          <span class="name">{side.name}</span>
          <span class="hash mono" title={pair.hashes[side.i]} data-testid="hash-{side.name}">blake3 {pair.hashes[side.i].slice(0, 16)}</span>
          {#if pair.queued[side.i]}
            <span class="queued">{pair.queued[side.i]} queued</span>
          {/if}
        </div>
        <div class="paper">
          <Editor doc={side.doc} name={side.name} onready={expose} />
        </div>
      </section>
    {/each}
  </div>
</main>

<style>
  main {
    max-width: 92rem;
    margin: 0 auto;
    padding: var(--space-4);
  }

  header {
    display: flex;
    justify-content: space-between;
    align-items: flex-end;
    flex-wrap: wrap;
    gap: var(--space-3);
    margin-bottom: var(--space-4);
  }

  h1 {
    font-family: var(--font-display);
    font-weight: 500;
    font-size: var(--text-2xl);
    margin: 0;
  }

  .eyebrow {
    font-size: var(--text-2xs);
    letter-spacing: var(--eyebrow-tracking);
    text-transform: uppercase;
    color: var(--text-muted);
  }

  .controls {
    display: flex;
    gap: var(--space-4);
    align-items: center;
    flex-wrap: wrap;
    font-size: var(--text-sm);
  }

  .controls label {
    display: flex;
    gap: var(--space-2);
    align-items: center;
  }

  .controls button {
    border: 1px solid var(--line);
    background: var(--panel);
    border-radius: var(--radius-control);
    padding: var(--space-1) var(--space-3);
    cursor: pointer;
  }

  .status {
    border-radius: var(--radius-pill);
    padding: 0 var(--space-3);
    background: var(--warning-soft);
    color: var(--warning-text);
  }

  .status.ok {
    background: var(--positive-soft);
    color: var(--positive-text);
  }

  .pair {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(min(100%, 30rem), 1fr));
    gap: var(--space-4);
  }

  .head {
    display: flex;
    gap: var(--space-3);
    align-items: baseline;
    padding: 0 var(--space-2) var(--space-2);
    font-size: var(--text-sm);
  }

  .name {
    font-weight: 700;
  }

  .hash,
  .mono {
    font-family: var(--font-mono);
    font-size: var(--text-xs);
    color: var(--text-muted);
  }

  .queued {
    color: var(--warning-text);
  }

  .paper {
    background: var(--panel);
    border-radius: var(--radius-panel);
    border: 1px solid var(--line);
  }
</style>
