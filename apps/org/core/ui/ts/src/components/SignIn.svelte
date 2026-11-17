<script lang="ts">
  import { useSignIn } from '../hooks/useSignIn.ts'
  import Badge from './Badge.svelte'
  import Button from './Button.svelte'
  import Field from './Field.svelte'

  // Signing in: each device this browser keeps for the scope signs the
  // server's challenge with its own key; on the dev server, the fixture
  // members too, whose keys anyone can derive, and in a demo build the
  // same members, under one tag on their heading, not each row's own. In
  // a demo's room, one member is one browser's at a time: a member
  // another browser there leased reads `taken`, drawn disabled and
  // greyed, so this browser cannot sign in as them until they are freed.
  // A demo leads with this list; a browser holding no device of its own
  // reads why and what to do about it below it, collapsed, since the
  // members above are almost always what it came for. Each row reads the
  // same way: the person's name, then the circles they sit in, the
  // assembly left out since every member is in it; never their device.
  let {
    scope,
    back,
    fixtures,
    demo = false,
  }: {
    scope: string
    back: string
    fixtures: { address: string; name: string; label: string; circles: string[]; taken?: boolean }[]
    demo?: boolean
  } = $props()

  const state = useSignIn(
    () => scope,
    () => back,
  )
</script>

<h1 class="title">Sign in</h1>

{#if state.devices.length}
  <div class="list">
    {#each state.devices as d (d.key)}
      <Button busy={state.busy} onclick={() => state.as(d)}
        >{d.name ?? d.address}{#each d.circles ?? [] as c (c)} <Badge>{c}</Badge>{/each}</Button
      >
    {/each}
  </div>
{/if}

{#if fixtures.length && demo}
  <p class="label">Demo members <span class="dev">demo</span></p>
  <p class="hint">
    {scope} is a mock co-op. Sign in as any of its members: their keys are derived from their address and their
    device's label, which anyone can do.
  </p>
  <div class="list">
    {#each fixtures as f (f.address)}
      <Button
        title={f.taken ? `${f.address}: signed in on another browser already` : f.address}
        busy={state.busy}
        disabled={f.taken}
        onclick={() => state.fixture(f.address, f.label)}
        >{f.name}{#each f.circles as c (c)} <Badge>{c}</Badge>{/each}{#if f.taken} <span class="taken">taken</span>{/if}</Button
      >
    {/each}
  </div>
{:else if fixtures.length}
  <p class="label">Fixture members <span class="dev">dev only</span></p>
  <p class="hint">Their keys are derived from their address and their device's label, which anyone can do.</p>
  <div class="list">
    {#each fixtures as f (f.address)}
      <Button title={f.address} busy={state.busy} onclick={() => state.fixture(f.address, f.label)}
        >{f.name}{#each f.circles as c (c)} <Badge>{c}</Badge>{/each}</Button
      >
    {/each}
  </div>
{/if}

{#if !state.devices.length}
  {#if demo}
    <details class="no-device">
      <summary>This browser holds no device of {scope}</summary>
      <p class="hint">
        To join, open the invitation link you were sent. To sign in here from a device you already hold, make a key
        below and enrol it there, under Devices.
      </p>
    </details>
  {:else}
    <p class="hint">
      This browser holds no device of {scope}. To join, open the invitation link you were sent. To sign in here from a
      device you already hold, make a key below and enrol it there, under Devices.
    </p>
  {/if}
{/if}

<details class="make">
  <summary>Make a key for this browser</summary>
  <div class="fields">
    <Field label="Your address" name="address" type="email" bind:value={state.address} placeholder="name@lanterne.example" />
    <Field label="This device" name="label" bind:value={state.label} placeholder="laptop" />
    <Button onclick={() => state.make()} disabled={!state.address.trim()}>Make a key</Button>
  </div>
  {#if state.made}
    <p class="hint">Enrol this key from a device of {state.made.address}'s: <code>{state.made.key}</code></p>
  {/if}
</details>

{#if state.problem}
  <p class="problem" role="alert">{state.problem}</p>
{/if}

<style>
  .title {
    margin: 0;
    font-family: var(--font-display);
    font-weight: 500;
    font-size: var(--text-xl);
  }
  .list,
  .fields {
    display: grid;
    grid-template-columns: minmax(0, 1fr);
    gap: var(--space-2);
  }
  /* A row's name, circles and badge can run long together; let it wrap
     onto a second line rather than push the card wider than the panel
     (`Button`'s own rows stay single-line elsewhere, so overridden here
     alone). */
  .list :global(.button) {
    height: auto;
    min-height: var(--row);
    white-space: normal;
    flex-wrap: wrap;
    justify-content: flex-start;
    text-align: start;
  }
  .label {
    margin: 0;
    font-size: var(--text-sm);
    font-weight: 500;
  }
  .hint,
  .make summary,
  .no-device summary {
    margin: 0;
    font-size: var(--text-sm);
    color: var(--text-muted);
  }
  .make summary,
  .no-device summary {
    cursor: pointer;
  }
  .make .fields {
    margin-top: var(--space-3);
  }
  .no-device .hint {
    margin-top: var(--space-2);
  }
  code {
    font-family: var(--font-mono, monospace);
    word-break: break-all;
    color: var(--text);
  }
  .dev {
    color: var(--warning-text);
  }
  .taken {
    color: var(--text-muted);
  }
  .problem {
    margin: 0;
    font-size: var(--text-sm);
    color: var(--negative-text);
  }
</style>
