<script lang="ts">
  import type { Snippet } from 'svelte'
  import ArrowRight from 'phosphor-svelte/lib/ArrowRight'
  import Copy from 'phosphor-svelte/lib/Copy'
  import Warning from 'phosphor-svelte/lib/Warning'
  import ArrowLeft from 'phosphor-svelte/lib/ArrowLeft'
  import Link from 'phosphor-svelte/lib/Link'
  import Question from 'phosphor-svelte/lib/Question'
  import SignInIcon from 'phosphor-svelte/lib/SignIn'
  import UserMinus from 'phosphor-svelte/lib/UserMinus'
  import Popover from './Popover.svelte'
  import { useSignIn } from '../hooks/useSignIn.ts'
  import Avatar from './Avatar.svelte'
  import Logo from './Logo.svelte'
  import Button from './Button.svelte'
  import { verb } from '../verbs.ts'
  import Field from './Field.svelte'
  import Icon from './Icon.svelte'
  import Select from './Select.svelte'

  // Signing in as a real member of the coop sees it, in a card of its
  // own: the people this browser holds a key for in one select, the first
  // chosen, and Sign in at the bottom right; at the left, Link device and
  // Forget identity, one group drawn as a row of two cells, the second
  // forgetting the chosen key in this browser, after a confirmation unless
  // it is a fixture's. With no key, why, and the two
  // ways in, an invitation's link for a first device, or this browser
  // approved from a device the person already uses, behind one disclosure
  // that makes the key here and shows it as a QR code and a link, which
  // that device opens to enrol it. Help is an icon at the card's top
  // right. Every row of the dev list stands one line high: the person's
  // name on the left, the circles they sit in as compact chips on the
  // right, the name giving way first.
  //
  // At the right of the screen, or below the card on a narrow one, with no
  // panel but the page's own ground, a list of its own offers
  // the fixture members on the dev server, and in a demo build the demo's
  // members, whose keys anyone can derive: a shortcut, never how a member
  // signs in. Every one is listed: one this browser keeps a key for wears
  // a faint ring and signs in with that key, and the one chosen in the
  // card's select is lit in its Sign in's ink. In a demo's room, a member
  // another browser leased reads `taken`, drawn disabled and greyed,
  // until they are freed. A notice, where the page has one, says in a
  // sentence why this browser is here again, under the coop's name.
  // In a demo, a browser holding no key is pointed at that list, and
  // Link device stays quiet, so a newcomer is never led to it first.
  let {
    scope,
    name,
    logo = null,
    back,
    fixtures,
    demo = false,
    notice = '',
  }: {
    scope: string
    name: string
    // The coop's logo, an SVG, if its particulars mark one.
    logo?: string | null
    back: string
    fixtures: { address: string; name: string; label: string; circles: string[]; taken?: boolean }[]
    demo?: boolean
    notice?: string
  } = $props()

  const state = useSignIn(
    () => scope,
    () => back,
  )

  const held = $derived(state.devices.filter((d) => d.key !== state.made?.key))
  const keys = $derived(new Map(held.map((d) => [d.address, d])))
  const pick = $derived(held.find((d) => d.key === state.chosen) ?? held[0])
  const options = $derived(held.map((d) => ({ value: d.key, label: d.name ?? d.address, who: d.name ?? d.address })))

  // A fixture's key anyone can derive again, so it goes at once.
  function drop() {
    if (!pick) {
      return
    }
    if (fixtures.some((f) => f.address === pick.address)) {
      void state.forget(pick)
    } else {
      state.confirming = pick.key
    }
  }
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

<div class="sign" class:two={fixtures.length > 0}>
  <section class="card" aria-labelledby="in">
    <p class="coop"><Logo {name} {logo} /><b>{name}</b></p>
    {#if notice}
      <p class="notice" role="status">{notice}</p>
    {/if}
    {#if !state.opened}
      <span class="help">
        <Popover label="Ways in" menu={false} icon wide align="end">
          {#snippet trigger()}<Icon icon={Question} size="1.1rem" />{/snippet}
          <div class="ways">
            <p><b>New here?</b> Open the invitation link you were sent. It sets this browser up as your first device.</p>
            <p><b>Already a member?</b> Choose Link device to approve this browser from a device you already use: you make a key here, and approve it there.</p>
          </div>
        </Popover>
      </span>
    {#if pick}
      <h1 id="in" class="title">Welcome back</h1>
      <Select label="Sign in as" {options} value={pick.key} onchange={(v) => (state.chosen = v)} />
      {#if state.confirming === pick.key}
        <div class="confirm" role="alert">
          <p>This browser will no longer be able to sign in as {pick.name ?? pick.address}. To stop the key working anywhere, revoke it in Devices.</p>
          <div class="acts" data-run>
            <Button lead={verb('Forget')} tone="danger" onclick={() => state.forget(pick)}>Forget</Button>
            <Button lead={verb('Cancel')} onclick={() => (state.confirming = null)}>Cancel</Button>
          </div>
        </div>
      {/if}
    {:else if state.loaded}
      <div class="empty">
        <h1 id="in" class="title">This browser isn't signed in to {name} yet</h1>
      </div>
      {#if demo && fixtures.length}
        <p class="hint">To look around, pick anyone from the Demo members list: no invitation or device is needed.</p>
      {:else}
        <p class="hint">Open the invitation link you were sent, or link this browser from a device you already use.</p>
      {/if}
    {:else}
      <!-- Which keys this browser holds only its script can read: until
           it has, the page the server sends says nothing of them. -->
      <h1 id="in" class="title sr">Sign in to {name}</h1>
      <div class="pending" aria-busy="true">
        <span class="line"></span>
        <span class="line"></span>
      </div>
    {/if}

      <div class="bar">
        <!-- The ways besides Sign in, one group drawn as one row of cells
             though both are quiet (`data-run="group"`, `Button`). -->
        <span class="others" data-run="group">
          <span data-link data-through>
            <Button tone={pick || !state.loaded || demo ? 'quiet' : 'primary'} onclick={() => (state.opened = true)}>
              <Icon icon={Link} size="1rem" />Link device
            </Button>
          </span>
          {#if pick}
            <Button onclick={drop}><Icon icon={UserMinus} size="1rem" />Forget identity</Button>
          {/if}
        </span>
        {#if pick}
          <span class="go">
            <Button tone="info" busy={state.busy} onclick={() => state.as(pick)}><Icon icon={SignInIcon} size="1rem" />Sign in</Button>
          </span>
        {/if}
      </div>
    {:else}
      <div class="new">
        <span class="back"><Button tone="subtle" lead={ArrowLeft} onclick={() => state.leave()}>Back</Button></span>
        <h1 id="in" class="title">Link this browser</h1>
        {#if !state.made}
          <p class="hint">Make a key in this browser, then approve it from a device where you are already signed in.</p>
          <Field label="Your address" name="address" type="email" bind:value={state.address} placeholder="name@lanterne.example" />
          <Field label="Name for this browser" name="label" bind:value={state.label} placeholder="laptop" />
          <Button lead={verb('Continue')} tone="primary" onclick={() => state.make()} disabled={!state.address.trim()}>Continue</Button>
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
          <Button tone="primary" lead={verb('Sign in')} busy={state.busy} onclick={() => state.made && state.as(state.made)}>
            I approved it, sign in
          </Button>
        {/if}
      </div>
    {/if}

    {#if state.problem}
      <p class="problem" role="alert">{state.problem}</p>
    {/if}
  </section>

  {#if fixtures.length}
    <aside class="dev" aria-labelledby="fx">
      <div class="head">
        <Icon icon={Warning} size="1.1rem" />
        <h2 id="fx" class="label">{demo ? 'Demo members' : 'Test accounts'}</h2>
      </div>
      <p class="hint">Pick anyone to look around. A real coop has no such list: members sign in from their own devices.</p>
      <div class="list">
        {#each fixtures as f (f.address)}
          {const k = $derived(keys.get(f.address))}
          <div class="fx" class:kept={!!k} class:chosen={!!k && k.key === pick?.key}>
            {@render row(
              f.name,
              f.circles,
              f.taken ? `${f.address}: signed in on another browser already` : f.address,
              () => (k ? state.as(k) : state.fixture(f.address, f.label)),
              f.taken,
              f.taken,
            )}
          </div>
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
    width: min(32rem, 100%);
    margin-inline: auto;
  }
  /* The real card keeps the centre; the dev list sits on the page's own
     ground at the right, never in a panel. */
  @media (min-width: 80rem) {
    .sign.two {
      grid-template-columns: minmax(0, 1fr) minmax(0, 32rem) minmax(0, 1fr);
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
    position: relative;
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
  .help {
    position: absolute;
    inset-block-start: var(--space-3);
    inset-inline-end: var(--space-3);
    color: var(--text-muted);
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
    flex-wrap: wrap;
    align-items: center;
    gap: var(--space-2);
    margin-block-start: var(--space-5);
  }
  /* One row that never wraps nor shrinks: it is one run of cells, and the
     bar wraps Sign in below it where the card is too narrow for both. */
  .others {
    display: flex;
    flex: none;
    align-items: center;
    gap: var(--space-2);
  }
  /* Link device's wrapper is only what its focus is found by: its button
     stands in the group's row itself. */
  [data-link] {
    display: contents;
  }
  .go {
    margin-inline-start: auto;
  }
  .dev .list :global(.button) {
    gap: var(--space-2);
    padding-inline: var(--space-2);
  }
  /* Kept in this browser: a row tinted faintly in Sign in's ink. Chosen in
     the card: tinted strongly. Its fill, so hovered it takes every quiet
     button's hover. */
  .fx.kept :global(.button:not(:hover)) {
    --fill: color-mix(in oklab, var(--info-text) 8%, var(--sunk));
  }
  .fx.chosen :global(.button:not(:hover)) {
    --fill: color-mix(in oklab, var(--info-text) 24%, var(--sunk));
  }
  .fx.chosen .chip {
    border-color: var(--info-text);
    color: var(--info-text);
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
  .empty {
    display: grid;
    gap: var(--space-3);
  }
  .pending {
    display: grid;
    justify-items: center;
    gap: var(--space-4);
  }
  .line {
    display: block;
    inline-size: 60%;
    block-size: var(--space-3);
    border-radius: var(--radius-pill);
    background: var(--sunk);
  }
  .line + .line {
    inline-size: 100%;
    block-size: 2rem;
    border-radius: var(--radius-control);
  }
  .sr {
    position: absolute;
    width: 1px;
    height: 1px;
    overflow: hidden;
    clip-path: inset(50%);
    white-space: nowrap;
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
  /* The way back, a subtle button at the card's top left. */
  .back {
    justify-self: start;
    margin: calc(var(--space-1) * -1) 0 0 calc(var(--space-3) * -1);
  }
  /* Every row one line and one height: the name on the left, ending in an
     ellipsis where it runs out, the circles on the right in what is left. */
  .list :global(.button) {
    --h: calc(var(--row) + var(--space-1));
    width: 100%;
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
  .notice {
    margin: 0;
    padding: var(--space-3);
    border-radius: var(--radius-control);
    background: var(--sunk);
    font-size: var(--text-sm);
    color: var(--text);
  }
  .problem {
    margin: 0;
    font-size: var(--text-sm);
    color: var(--negative-text);
  }
</style>
