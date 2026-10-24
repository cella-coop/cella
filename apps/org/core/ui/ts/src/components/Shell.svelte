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
  import CaretDown from 'phosphor-svelte/lib/CaretDown'
  import Check from 'phosphor-svelte/lib/Check'
  import type { Jump, Nav, Person } from '../models/view.ts'
  import type { Outcome as Done } from '../models/outcome.ts'
  import { useShell } from '../hooks/useShell.ts'
  import Command from './Command.svelte'
  import Icon from './Icon.svelte'
  import Outcome from './Outcome.svelte'
  import { typing } from '../models/keys.ts'

  // The shell: the sidebar, with the scope, who acts and the navigation,
  // and the content beside it; the command menu and the last write's
  // outcome float above both. ] shows or hides every page's drawer.
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
    scope: string
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
</script>

<svelte:window {onkeydown} />

<div class="shell">
  <nav class="sidebar" aria-label="Main">
    <details class="who">
      <summary>
        <span class="mark">{scope.slice(0, 1).toUpperCase()}</span>
        <span class="names">
          <b>{scope}</b>
          <span>{actor ? `as ${actor.name}` : 'acting as no one'}</span>
        </span>
        <Icon icon={CaretDown} size="0.85em" />
      </summary>
      <div class="menu">
        {#if dev}
          <p class="label">Act as <span class="dev">dev only</span></p>
          <p class="hint">The server signs with each member's fixture device key, which anyone can derive.</p>
          <form method="post" action="/act">
            <input type="hidden" name="back" value={page.url.pathname + page.url.search} />
            {#each actors as p (p.address)}
              <button name="actor" value={p.address} class:on={actor?.address === p.address}>
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
          <input type="hidden" name="back" value={page.url.pathname + page.url.search} />
          {#each ['system', 'light', 'dark'] as t (t)}
            <button name="theme" value={t} class:on={theme === t}>{t}</button>
          {/each}
        </form>
      </div>
    </details>

    <Command {collections} {source} />

    {#each nav as g (g.group)}
      <p class="group">{g.group}</p>
      <ul>
        {#each g.items as item (item.href)}
          <li>
            <a href={item.href} class:on={here(item.href)} aria-current={here(item.href) ? 'page' : undefined}>
              <Icon icon={item.icon} />{item.title}
            </a>
          </li>
        {/each}
      </ul>
    {/each}

    {#if dev}
      <p class="footer">Development server · fixture keys</p>
    {/if}
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
  .who {
    position: relative;
    margin-bottom: var(--space-2);
  }
  summary {
    display: flex;
    align-items: center;
    gap: var(--space-2);
    padding: var(--space-1);
    border-radius: var(--radius-control);
    cursor: pointer;
    list-style: none;
  }
  summary::-webkit-details-marker {
    display: none;
  }
  summary:hover {
    background: var(--hover);
  }
  .mark {
    display: grid;
    place-items: center;
    width: 1.75rem;
    height: 1.75rem;
    border-radius: 7px;
    background: var(--accent-fill);
    color: var(--on-accent);
    font-family: var(--font-display);
    font-weight: 500;
  }
  .names {
    display: grid;
    flex: 1;
    min-width: 0;
    line-height: 1.2;
  }
  .names b {
    font-family: var(--font-display);
    font-weight: 500;
    font-size: var(--text-md);
  }
  .names span {
    font-size: var(--text-xs);
    color: var(--text-muted);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .menu {
    position: absolute;
    z-index: 40;
    inset-inline: 0;
    width: 17rem;
    margin-top: var(--space-1);
    padding: var(--space-2);
    background: var(--float);
    border-radius: var(--radius-float);
    box-shadow: var(--shadow-float);
    display: grid;
    gap: var(--space-1);
  }
  .menu form {
    display: grid;
  }
  .menu button {
    display: flex;
    align-items: center;
    gap: var(--space-2);
    padding: var(--space-1) var(--space-2);
    border: none;
    border-radius: var(--radius-control);
    background: none;
    text-align: start;
    cursor: pointer;
  }
  .menu button:hover {
    background: var(--hover);
  }
  .menu button.on {
    color: var(--accent-text);
  }
  .menu button :global(svg:last-child) {
    margin-inline-start: auto;
  }
  .themes {
    grid-auto-flow: column;
  }
  .themes button {
    justify-content: center;
    text-transform: capitalize;
  }
  .themes button.on {
    background: var(--sunk);
  }
  .avatar {
    display: grid;
    place-items: center;
    width: 1.4rem;
    height: 1.4rem;
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
  .dev {
    color: var(--warning-text);
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
  .footer {
    margin-top: auto;
    padding: var(--space-2);
    font-size: var(--text-xs);
    color: var(--warning-text);
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
