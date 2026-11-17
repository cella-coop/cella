<script lang="ts">
  import type { Snippet } from 'svelte'
  import ArrowRight from 'phosphor-svelte/lib/ArrowRight'
  import Copy from 'phosphor-svelte/lib/Copy'
  import Warning from 'phosphor-svelte/lib/Warning'
  import ArrowLeft from 'phosphor-svelte/lib/ArrowLeft'
  import X from 'phosphor-svelte/lib/X'
  import Link from 'phosphor-svelte/lib/Link'
  import Question from 'phosphor-svelte/lib/Question'
  import Popover from './Popover.svelte'
  import { useSignIn } from '../hooks/useSignIn.ts'
  import Avatar from './Avatar.svelte'
  import Button from './Button.svelte'
  import Field from './Field.svelte'
  import Icon from './Icon.svelte'

  // Signing in as a real member of the co-op sees it, in a card of its
  // own: "Continue as" each person this browser holds a key for, one click
  // each; with none, why, and the two ways in, an invitation's link for a
  // first device, or this browser approved from a device the person
  // already uses, behind one disclosure that makes the key here and shows
  // it as a QR code and a link, which that device opens to enrol it. Every
  // row stands one line high: the person's name on
  // the left, the circles they sit in as compact chips on the right, all on
  // one line, the name giving way first, in the dev list alone: the card's rows
  // are the person's name, and each has a quiet remove, which forgets the
  // key in this browser, after a confirmation unless it is a fixture's.
  //
  // At the right of the screen, or below the card on a narrow one, with no
  // panel but the page's own ground, a list of its own offers
  // the fixture members on the dev server, and in a demo build the demo's
  // members, whose keys anyone can derive: a shortcut, never how a member
  // signs in. A person already in the card is not offered twice. In a
  // demo's room, a member another browser leased reads `taken`, drawn
  // disabled and greyed, until they are freed.
  let {
    scope,
    name,
    back,
    fixtures,
    demo = false,
  }: {
    scope: string
    name: string
    back: string
    fixtures: { address: string; name: string; label: string; circles: string[]; taken?: boolean }[]
    demo?: boolean
  } = $props()

  const state = useSignIn(
    () => scope,
    () => back,
  )

  const held = $derived(state.devices.filter((d) => d.key !== state.made?.key))
  const people = $derived(new Set(held.map((d) => d.address)))
  const offered = $derived(fixtures.filter((f) => !people.has(f.address)))

</script>

{#snippet row(name: string, circles: string[], tip: string, go: () => void, off = false, taken = false)}
  <Button title={tip} busy={state.busy} disabled={off} onclick={go}>
    <Avatar {name} size="1.25rem" />
    <span class="name">{name}</span>
    {#if taken}
      <span class="taken">taken</span>
    {:else if circles.length}
      <span class="chips">{#each circles as c (c)}<span class="chip">{c}</span>{/each}</span>
    {/if}
  </Button>
{/snippet}

<svelte:window onkeydown={(e) => e.key === 'Escape' && state.opened && state.leave()} />

<div class="sign" class:two={offered.length > 0}>
  <section class="card" aria-labelledby="in">
    <p class="coop"><span class="mark" aria-hidden="true">{name.slice(0, 1).toUpperCase()}</span><b>{name}</b></p>
    {#if !state.opened}
    {#if held.length}
      <h1 id="in" class="title">Welcome back</h1>
      <div class="list">
        {#each held as d (d.key)}
          <div class="line">
            {@render row(d.name ?? d.address, [], d.address, () => state.as(d))}
            <button class="x" type="button" title="Remove from this browser" aria-label="Remove {d.name ?? d.address} from this browser" onclick={() => (fixtures.some((f) => f.address === d.address) ? state.forget(d) : (state.confirming = d.key))}>
              <Icon icon={X} size="0.9rem" />
            </button>
          </div>
          {#if state.confirming === d.key}
            <div class="confirm" role="alert">
              <p>This browser will no longer be able to sign in as {d.name ?? d.address}. To stop the key working anywhere, revoke it in Devices.</p>
              <div class="acts">
                <Button tone="danger" onclick={() => state.forget(d)}>Remove</Button>
                <Button onclick={() => (state.confirming = null)}>Cancel</Button>
              </div>
            </div>
          {/if}
        {/each}
      </div>
    {:else}
      <div class="empty">
        <h1 id="in" class="title">This browser isn't signed in to {name} yet</h1>
      </div>
      <p class="hint">Open the invitation link you were sent, or link this browser from a device you already use.</p>
    {/if}

      <div class="bar">
        <span data-link>
          <Button tone={held.length ? 'quiet' : 'primary'} onclick={() => (state.opened = true)}>
            <Icon icon={Link} size="1rem" />Link device
          </Button>
        </span>
        <Popover label="Ways in" menu={false} button wide align="end">
          {#snippet trigger()}<Icon icon={Question} size="1rem" />Help{/snippet}
          <div class="ways">
            <p><b>New here?</b> Open the invitation link you were sent. It sets this browser up as your first device.</p>
            <p><b>Already a member?</b> Choose Link device to approve this browser from a device you already use: you make a key here, and approve it there.</p>
          </div>
        </Popover>
      </div>
    {:else}
      <div class="new">
        <button class="back" type="button" onclick={() => state.leave()}>
          <Icon icon={ArrowLeft} size="1rem" />Back
        </button>
        <h1 id="in" class="title">Link this browser</h1>
        {#if !state.made}
          <p class="hint">Make a key in this browser, then approve it from a device where you are already signed in.</p>
          <Field label="Your address" name="address" type="email" bind:value={state.address} placeholder="name@lanterne.example" />
          <Field label="Name for this browser" name="label" bind:value={state.label} placeholder="laptop" />
          <Button tone="primary" onclick={() => state.make()} disabled={!state.address.trim()}>Continue</Button>
        {:else}
          <p class="hint">On a device where {state.made.address} is signed in, scan this code, or open the link, and approve. It asks you for the code below.</p>
          {#if state.qr}
            <svg class="qr" viewBox="-3 -3 {state.qr.size + 6} {state.qr.size + 6}" role="img" aria-label="QR code of the link" shape-rendering="crispEdges"><path d={state.qr.d} fill="#000" /></svg>
          {/if}
          <div class="pair">
            <span>Code</span>
            <b>{state.code}</b>
            <span>Type it where you approve this browser.</span>
          </div>
          <div class="link">
            <code>{state.link}</code>
            <Button aria-label="Copy the link" title={state.copied ? 'Copied' : 'Copy the link'} onclick={() => state.copy()}>
              <Icon icon={Copy} size="1rem" />
            </Button>
          </div>
          <Button tone="primary" busy={state.busy} onclick={() => state.made && state.as(state.made)}>
            I approved it, sign in
          </Button>
        {/if}
      </div>
    {/if}

    {#if state.problem}
      <p class="problem" role="alert">{state.problem}</p>
    {/if}
  </section>

  {#if offered.length}
    <aside class="dev" aria-labelledby="fx">
      <div class="head">
        <Icon icon={Warning} size="1.1rem" />
        <h2 id="fx" class="label">{demo ? 'Demo members' : 'Test accounts'}</h2>
      </div>
      <p class="hint">Pick anyone to look around. A real co-op has no such list: members sign in from their own devices.</p>
      <div class="list">
        {#each offered as f (f.address)}
          {@render row(
            f.name,
            f.circles,
            f.taken ? `${f.address}: signed in on another browser already` : f.address,
            () => state.fixture(f.address, f.label),
            f.taken,
            f.taken,
          )}
        {/each}
      </div>
    </aside>
  {/if}
</div>

<style>
  .sign {
    display: grid;
    grid-template-columns: minmax(0, 1fr);
    gap: var(--space-4);
    align-items: start;
    width: min(28rem, 100%);
    margin-inline: auto;
  }
  /* The real card keeps the centre; the dev list sits on the page's own
     ground at the right, never in a panel. */
  @media (min-width: 80rem) {
    .sign.two {
      grid-template-columns: minmax(0, 1fr) minmax(0, 28rem) minmax(0, 1fr);
      width: 100%;
    }
    .sign.two .card {
      grid-column: 2;
      grid-row: 1;
    }
    .sign.two .dev {
      grid-column: 3;
      grid-row: 1;
      justify-self: end;
      width: min(24rem, 100%);
      padding-inline: 0;
    }
  }
  .card {
    display: grid;
    gap: var(--space-4);
    padding: var(--space-5);
    background: var(--panel);
    border-radius: var(--radius-panel);
    min-width: 0;
  }
  .dev {
    display: grid;
    gap: var(--space-3);
    min-width: 0;
    padding-inline: var(--space-2);
  }
  .line {
    position: relative;
  }
  .x {
    position: absolute;
    inset-block: 0;
    inset-inline-end: var(--space-1);
    margin-block: auto;
    display: grid;
    place-items: center;
    width: 2rem;
    height: 2rem;
    padding: 0;
    border: 0;
    border-radius: var(--radius-control);
    background: none;
    color: var(--text-muted);
    cursor: pointer;
    opacity: 0;
    transition: opacity var(--fast) var(--ease);
  }
  .line:hover .x,
  .line:focus-within .x,
  .x:focus-visible {
    opacity: 1;
  }
  .x:hover {
    background: var(--hover);
    color: var(--text);
  }
  @media (hover: none) {
    .x {
      opacity: 1;
    }
  }
  .confirm {
    display: grid;
    gap: var(--space-2);
    padding: var(--space-3);
    border-radius: var(--radius-control);
    background: var(--sunk);
    font-size: var(--text-sm);
    color: var(--text-muted);
  }
  .confirm p {
    margin: 0;
  }
  .list .confirm :global(.button) {
    width: auto;
    height: 2rem;
  }
  .acts {
    display: flex;
    gap: var(--space-2);
  }
  .head {
    display: flex;
    align-items: center;
    gap: var(--space-2);
    color: var(--text-muted);
  }
  .head .label {
    word-spacing: 0.2em;
    color: var(--text);
  }
  .bar {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--space-2);
  }
  .dev .list :global(.button) {
    gap: var(--space-2);
    padding-inline: var(--space-2);
  }
  .chips {
    display: flex;
    flex: none;
    gap: 0.2rem;
    margin-inline-start: auto;
    padding-inline-start: var(--space-1);
  }
  .chip {
    padding: 0 0.3rem;
    border: 1px solid var(--line);
    border-radius: var(--radius-pill);
    font-size: var(--text-2xs);
    font-weight: 400;
    line-height: 1.1rem;
    color: var(--text-muted);
    white-space: nowrap;
  }
  .title {
    margin: 0;
    font-family: var(--font-ui);
    font-size: var(--text-md);
    font-weight: 400;
    line-height: 1.4;
    color: var(--text-muted);
    text-align: center;
  }
  .coop {
    display: flex;
    align-items: center;
    justify-content: center;
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
  .empty {
    display: grid;
    gap: var(--space-3);
  }
  .ways {
    display: grid;
    gap: var(--space-3);
    padding: var(--space-3);
    font-size: var(--text-sm);
    color: var(--text-muted);
  }
  .ways p {
    margin: 0;
  }
  .ways b {
    color: var(--text);
    font-weight: 500;
  }
  .list {
    display: grid;
    grid-template-columns: minmax(0, 1fr);
    gap: var(--space-2);
  }
  .new {
    display: grid;
    grid-template-columns: minmax(0, 1fr);
    gap: var(--space-3);
  }
  .back {
    justify-self: start;
    display: inline-flex;
    align-items: center;
    gap: var(--space-1);
    margin: calc(var(--space-1) * -1) 0 0 calc(var(--space-2) * -1);
    padding: var(--space-1) var(--space-2);
    border: 0;
    border-radius: var(--radius-control);
    background: none;
    color: var(--text-muted);
    font: inherit;
    font-size: var(--text-sm);
    cursor: pointer;
  }
  .back:hover {
    background: var(--hover);
    color: var(--text);
  }
  /* Every row one line and one height: the name on the left, ending in an
     ellipsis where it runs out, the circles on the right in what is left. */
  .list :global(.button) {
    width: 100%;
    height: calc(var(--row) + var(--space-1));
    justify-content: flex-start;
  }
  .name {
    flex: 0 1 auto;
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    text-align: start;
  }
  .taken {
    margin-inline-start: auto;
    color: var(--text-muted);
    font-size: var(--text-xs);
  }
  .label {
    margin: 0;
    font-size: var(--text-sm);
    font-weight: 500;
  }
  .hint {
    margin: 0;
    font-size: var(--text-sm);
    color: var(--text-muted);
  }
  .qr {
    justify-self: center;
    width: 12rem;
    height: auto;
    border-radius: var(--radius-control);
    background: #fff;
  }
  .pair {
    display: grid;
    justify-items: center;
    gap: var(--space-1);
    padding: var(--space-3);
    border-radius: var(--radius-control);
    background: var(--sunk);
    font-size: var(--text-xs);
    color: var(--text-muted);
  }
  .pair b {
    font-family: var(--font-mono, monospace);
    font-size: var(--text-2xl);
    font-weight: 500;
    letter-spacing: 0.12em;
    color: var(--text);
  }
  .link {
    display: flex;
    align-items: center;
    gap: var(--space-2);
    min-width: 0;
  }
  .link code {
    flex: 1;
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    padding: var(--space-2) var(--space-3);
    border-radius: var(--radius-control);
    background: var(--sunk);
    font-family: var(--font-mono, monospace);
    font-size: var(--text-xs);
    color: var(--text);
  }
  .problem {
    margin: 0;
    font-size: var(--text-sm);
    color: var(--negative-text);
  }
</style>
