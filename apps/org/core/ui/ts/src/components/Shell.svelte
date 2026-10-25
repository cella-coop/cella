<script lang="ts">
  import type { Snippet } from 'svelte'
  import { page } from '$app/state'
  import '@fontsource/alegreya/400.css'
  import '@fontsource/alegreya/500.css'
  import '@fontsource/alegreya-sans/400.css'
  import '@fontsource/alegreya-sans/500.css'
  import '@fontsource/alegreya-sans/700.css'
  import '../styles/tokens.css'
  import '../styles/base.css'
  import CaretUpDown from 'phosphor-svelte/lib/CaretUpDown'
  import Check from 'phosphor-svelte/lib/Check'
  import type { Jump, Nav, Person } from '../models/view.ts'
  import type { Outcome as Done } from '../models/outcome.ts'
  import { useShell } from '../hooks/useShell.ts'
  import Command from './Command.svelte'
  import Icon from './Icon.svelte'
  import Outcome from './Outcome.svelte'
  import Popover from './Popover.svelte'
  import { typing } from '../models/keys.ts'

  // The shell: the sidebar, the co-op at its top and the acting member's
  // account at its foot, the command menu and the navigation between, and
  // the content beside it; the last write's outcome floats above. ] shows
  // or hides every page's drawer.
  let {
    scope,
    nav,
    actor,
    actors,
    dev,
    theme,
    outcome,
    source,
    drawer,
    children,
  }: {
    // The co-op the shell serves: its address, name and legal name.
    scope: { address: string; name: string; legal: string | null }
    nav: Nav
    actor: Person | null
    actors: Person[]
    dev: boolean
    theme: 'light' | 'dark' | 'system'
    outcome: Done | null
    source: string
    drawer: boolean
    children: Snippet
  } = $props()

  const state = useShell(() => outcome, () => drawer)

  function onkeydown(e: KeyboardEvent) {
    if (e.key !== ']' || e.metaKey || e.ctrlKey || e.altKey || typing(e) || document.querySelector('dialog[open]')) {
      return
    }
    state.show()
    e.preventDefault()
  }

  const collections: Jump[] = $derived(nav.flatMap((g) => g.items.map((i) => ({ title: i.title, href: i.href, kind: g.group }))))
  const here = (href: string) => page.url.pathname === href || page.url.pathname.startsWith(`${href}/`)
  const initials = (name: string) => name.split(/\s+/).map((w) => w[0]).slice(0, 2).join('')
  const back = $derived(page.url.pathname + page.url.search)
</script>

<svelte:window {onkeydown} />

<div class="shell">
  <nav class="sidebar" aria-label="Main">
    <div class="coop">
      <Popover label="Co-op: {scope.name}">
        {#snippet trigger()}
          <span class="mark">{scope.name.slice(0, 1).toUpperCase()}</span>
          <b class="name">{scope.name}</b>
          <Icon icon={CaretUpDown} size="0.9em" />
        {/snippet}
        <p class="label">Co-op</p>
        <button role="menuitemradio" aria-checked="true" class="item">
          <span class="mark small">{scope.name.slice(0, 1).toUpperCase()}</span>
          <span class="names">
            <b>{scope.name}</b>
            <span>{scope.legal ?? scope.address}</span>
          </span>
          <Icon icon={Check} />
        </button>
      </Popover>
    </div>

    <Command {collections} {source} />

    {#each nav as g (g.group)}
      {#if g.group !== 'home'}<p class="group">{g.group}</p>{/if}
      <ul>
        {#each g.items as item (item.href)}
          <li>
            <a href={item.href} class:on={here(item.href)} aria-current={here(item.href) ? 'page' : undefined}>
              <Icon icon={item.icon} />{item.title}
              {#if item.count}<span class="count" aria-label="{item.count} waiting">{item.count}</span>{/if}
            </a>
          </li>
        {/each}
      </ul>
    {/each}

    <div class="account">
      <Popover label="Account: {actor?.name ?? 'no one acting'}" side="top" wide>
        {#snippet trigger()}
          <span class="avatar">{actor ? initials(actor.name) : '–'}</span>
          <span class="names">
            <b>{actor?.name ?? 'No one acting'}</b>
            {#if dev}<span class="dev">Development · fixture keys</span>{/if}
          </span>
          <Icon icon={CaretUpDown} size="0.9em" />
        {/snippet}
        {#if dev}
          <p class="label">Act as <span class="dev">dev only</span></p>
          <p class="hint">The server signs with each member's fixture device key, which anyone can derive.</p>
          <form method="post" action="/act" class="list">
            <input type="hidden" name="back" value={back} />
            {#each actors as p (p.address)}
              <button role="menuitemradio" aria-checked={actor?.address === p.address} class="item" name="actor" value={p.address}>
                <span class="avatar">{initials(p.name)}</span>{p.name}
                {#if actor?.address === p.address}<Icon icon={Check} />{/if}
              </button>
            {/each}
          </form>
        {:else}
          <p class="hint">Writes need a member's own device; acting as a member is for development only.</p>
        {/if}
        <p class="label">Theme</p>
        <form method="post" action="/theme" class="themes">
          <input type="hidden" name="back" value={back} />
          {#each ['system', 'light', 'dark'] as t (t)}
            <button role="menuitemradio" aria-checked={theme === t} name="theme" value={t} class:on={theme === t}>{t}</button>
          {/each}
        </form>
      </Popover>
    </div>
  </nav>

  <main class="main">{@render children()}</main>
</div>

{#if state.outcome}
  <Outcome outcome={state.outcome} ondismiss={() => state.dismiss()} />
{/if}

<style>
  .shell {
    display: grid;
    grid-template-columns: var(--sidebar) minmax(0, 1fr);
    height: 100dvh;
  }
  .sidebar {
    display: flex;
    flex-direction: column;
    gap: var(--space-1);
    padding: var(--space-3);
    overflow-y: auto;
    font-size: var(--text-sm);
  }
  .main {
    margin: var(--space-2) var(--space-2) var(--space-2) 0;
    background: var(--panel);
    border-radius: var(--radius-panel);
    min-height: 0;
    overflow: hidden;
  }
  .coop {
    margin-bottom: var(--space-2);
  }
  .account {
    margin-top: auto;
    padding-top: var(--space-2);
  }
  .mark {
    display: grid;
    place-items: center;
    flex: none;
    width: 1.75rem;
    height: 1.75rem;
    border-radius: 7px;
    background: var(--accent-fill);
    color: var(--on-accent);
    font-family: var(--font-display);
    font-weight: 500;
  }
  .mark.small {
    width: 1.5rem;
    height: 1.5rem;
    border-radius: 6px;
  }
  .name {
    flex: 1;
    min-width: 0;
    font-family: var(--font-display);
    font-weight: 500;
    font-size: var(--text-md);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .names {
    display: grid;
    flex: 1;
    min-width: 0;
    line-height: 1.25;
    text-align: start;
  }
  .names b {
    font-weight: 500;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .names span {
    font-size: var(--text-xs);
    color: var(--text-muted);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .names .dev,
  .dev {
    color: var(--warning-text);
  }
  .list {
    display: grid;
  }
  .item,
  .themes button {
    display: flex;
    align-items: center;
    gap: var(--space-2);
    width: 100%;
    padding: var(--space-1) var(--space-2);
    border: none;
    border-radius: var(--radius-control);
    background: none;
    text-align: start;
    cursor: pointer;
  }
  .item:hover,
  .item:focus-visible,
  .themes button:hover {
    background: var(--hover);
  }
  .item :global(svg:last-child) {
    margin-inline-start: auto;
    color: var(--accent-text);
  }
  /* A segmented control: a sunk well, the chosen segment lifted out. */
  .themes {
    display: grid;
    grid-auto-flow: column;
    background: var(--sunk);
    border-radius: var(--radius-control);
    padding: 2px;
  }
  .themes button {
    justify-content: center;
    text-transform: capitalize;
    border-radius: calc(var(--radius-control) - 2px);
    color: var(--text-muted);
  }
  .themes button.on {
    background: var(--selected);
    color: var(--text);
  }
  .avatar {
    display: grid;
    place-items: center;
    flex: none;
    width: 1.5rem;
    height: 1.5rem;
    border-radius: 50%;
    background: var(--sunk);
    font-size: var(--text-2xs);
    font-weight: 500;
    color: var(--text-muted);
  }
  .label,
  .group {
    font-size: var(--text-2xs);
    font-weight: 600;
    letter-spacing: var(--eyebrow-tracking);
    text-transform: uppercase;
    color: var(--text-subtle);
    padding: var(--space-2) var(--space-2) var(--space-1);
  }
  .group {
    margin-top: var(--space-3);
  }
  .hint {
    font-size: var(--text-xs);
    color: var(--text-muted);
    padding: 0 var(--space-2) var(--space-1);
  }
  ul {
    list-style: none;
    margin: 0;
    padding: 0;
  }
  ul a {
    display: flex;
    align-items: center;
    gap: var(--space-2);
    height: 1.9rem;
    padding: 0 var(--space-2);
    border-radius: var(--radius-control);
    color: var(--text-muted);
  }
  ul a:hover {
    background: var(--hover);
    color: var(--text);
  }
  ul a.on {
    background: var(--hover);
    color: var(--text);
    font-weight: 500;
  }
  .count {
    margin-inline-start: auto;
    min-width: 1.4rem;
    padding: 0 var(--space-1);
    border-radius: 999px;
    background: var(--accent-fill);
    color: var(--on-accent);
    font-size: var(--text-2xs);
    font-weight: 600;
    line-height: 1.4rem;
    text-align: center;
  }
  @media (max-width: 700px) {
    .shell {
      grid-template-columns: 1fr;
      grid-template-rows: auto 1fr;
    }
    .sidebar {
      max-height: 40dvh;
    }
    .main {
      margin: 0;
      border-radius: 0;
    }
  }
</style>
