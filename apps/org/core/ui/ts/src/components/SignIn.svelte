<script lang="ts">
  import { useSignIn } from '../hooks/useSignIn.ts'
  import Button from './Button.svelte'
  import Field from './Field.svelte'

  // Signing in: each device this browser keeps for the scope signs the
  // server's challenge with its own key; on the dev server, the fixture
  // members too, whose keys anyone can derive, and in a demo build the
  // same members, each marked as a demo member. A browser holding none is
  // pointed to an invitation's link, or makes a key to enrol from a
  // device its person holds.
  let {
    scope,
    back,
    fixtures,
    demo = false,
  }: {
    scope: string
    back: string
    fixtures: { address: string; name: string; label: string }[]
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
      <Button tone="primary" busy={state.busy} onclick={() => state.as(d)}>Sign in as {d.address} · {d.label}</Button>
    {/each}
  </div>
{:else}
  <p class="hint">
    This browser holds no device of {scope}. To join, open the invitation link you were sent. To sign in here from a
    device you already hold, make a key below and enrol it there, under Devices.
  </p>
{/if}

{#if fixtures.length && demo}
  <p class="label">Demo members <span class="dev">demo</span></p>
  <p class="hint">
    {scope} is a mock co-op. Sign in as any of its members: their keys are derived from their address and their
    device's label, which anyone can do.
  </p>
  <div class="list">
    {#each fixtures as f (f.address)}
      <Button title={f.address} busy={state.busy} onclick={() => state.fixture(f.address, f.label)}
        >{f.name} · {f.label} <span class="dev">demo member</span></Button
      >
    {/each}
  </div>
{:else if fixtures.length}
  <p class="label">Fixture members <span class="dev">dev only</span></p>
  <p class="hint">Their keys are derived from their address and their device's label, which anyone can do.</p>
  <div class="list">
    {#each fixtures as f (f.address)}
      <Button title={f.address} busy={state.busy} onclick={() => state.fixture(f.address, f.label)}>{f.name} · {f.label}</Button>
    {/each}
  </div>
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
    gap: var(--space-2);
  }
  .label {
    margin: 0;
    font-size: var(--text-sm);
    font-weight: 500;
  }
  .hint,
  .make summary {
    margin: 0;
    font-size: var(--text-sm);
    color: var(--text-muted);
  }
  .make summary {
    cursor: pointer;
  }
  .make .fields {
    margin-top: var(--space-3);
  }
  code {
    font-family: var(--font-mono, monospace);
    word-break: break-all;
    color: var(--text);
  }
  .dev {
    color: var(--warning-text);
  }
  .problem {
    margin: 0;
    font-size: var(--text-sm);
    color: var(--negative-text);
  }
</style>
