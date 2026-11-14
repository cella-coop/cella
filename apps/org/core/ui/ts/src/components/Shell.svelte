<script lang="ts">
  import type { Snippet } from 'svelte'
  import { page } from '$app/state'
  import '../styles/tokens.css'
  import '../styles/base.css'
  import CaretDown from 'phosphor-svelte/lib/CaretDown'
  import CaretLeft from 'phosphor-svelte/lib/CaretLeft'
  import CaretRight from 'phosphor-svelte/lib/CaretRight'
  import CaretUpDown from 'phosphor-svelte/lib/CaretUpDown'
  import Check from 'phosphor-svelte/lib/Check'
  import type { Jump, Nav, Person, Theme } from '../models/view.ts'
  import type { Outcome as Done } from '../models/outcome.ts'
  import { useShell } from '../hooks/useShell.ts'
  import type { Search } from '../hooks/CommandState.svelte.ts'
  import Command from './Command.svelte'
  import Icon from './Icon.svelte'
  import Outcome from './Outcome.svelte'
  import Popover from './Popover.svelte'
  import { typing } from '../models/keys.ts'
  import { worn } from '../models/theme.ts'
  import { TestTube } from '../icons.ts'

  // The shell: the sidebar and the content beside it; the last write's
  // outcome floats above. ] shows or hides every page's drawer. The
  // sidebar's top stays put: the co-op, the command menu and a grid of
  // sections, one open at a time. Its middle, which alone scrolls, lists
  // the open section's collections. Its foot stays put too: the co-op's
  // settings and the acting member's account.
  let {
    scope,
    nav,
    actor,
    dev,
    theme,
    outcome,
    source,
    drawer,
    people,
    circles = [],
    lens = null,
    children,
  }: {
    // The co-op the shell serves: its address, name and legal name.
    scope: { address: string; name: string; legal: string | null }
    nav: Nav
    actor: Person | null
    dev: boolean
    theme: Theme
    outcome: Done | null
    // What the command menu searches, read by the shell's query.
    source: Search
    drawer: boolean
    // The names of the people the co-op knows, by address.
    people: Record<string, string>
    // The circles the member reads, those they sit in first, and the one
    // they lensed the co-op on, if any.
    circles?: { id: string; name: string; sits: boolean }[]
    lens?: { id: string; name: string } | null
    children: Snippet
  } = $props()

  const state = useShell(() => outcome, () => drawer, () => people, () => lens, () => circles)

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

  // The sections, flat accordions in this order, each opening its
  // collections.
  const sections = [
    { group: 'governance', title: 'Governance' },
    { group: 'office', title: 'Office' },
    { group: 'work', title: 'Work' },
    { group: 'payments', title: 'Payments' },
    { group: 'ledger', title: 'Ledger' },
    { group: 'equity', title: 'Equity' },
  ]
  const has = (group: string) => nav.some((g) => g.group === group)
  // The group the page is in: its section and group open by themselves.
  const held = $derived(nav.find((g) => g.items.some((i) => here(i.href) && i.href !== '/'))?.group)
  // A group's collections by subgroup, in the order each first appears,
  // Settings' in its areas' order;
  // labelled only where there is more than one.
  const parts = (group: string) => {
    const by = new Map<string, Nav[number]['items']>()
    for (const item of (nav.find((g) => g.group === group)?.items ?? []).filter((i) => i.listed !== false)) {
      const key = item.subgroup ?? ''
      by.set(key, [...(by.get(key) ?? []), item])
    }
    const parted = [...by].map(([sub, items]) => ({ sub, items }))
    return group === 'platform' ? parted.sort((a, b) => areas.indexOf(a.sub) - areas.indexOf(b.sub)) : parted
  }
  // Settings is its own sidebar, in place of the sections, while a page
  // of it is open: the member's own pages, then the co-op's. The account
  // menu leads into it at Personal, the co-op menu at Organization.
  const areas = ['Personal', 'Organization']
  const settings = $derived(held === 'platform')
  const opens = (area: string) => (parts('platform').find((p) => p.sub === area) ?? parts('platform')[0])?.items[0]?.href
  const personal = $derived(opens('Personal'))
  const organization = $derived(opens('Organization'))
  state.follow(() => back, () => settings)
  const waiting = (group: string) => nav.find((g) => g.group === group)?.items.reduce((n, i) => n + (i.waiting ?? i.count ?? 0), 0) ?? 0
</script>

<svelte:window {onkeydown} />

<!-- A group's collections, labelled by subgroup where it has several. -->
{#snippet list(group: string)}
  {const ps = $derived(parts(group))}
  {#each ps as part (part.sub)}
    {#if ps.length > 1}<p class="group">{part.sub}</p>{/if}
    <ul>
      {#each part.items as item (item.href)}
        <li>
          <a href={item.href} class:on={here(item.href)} aria-current={here(item.href) ? 'page' : undefined}>
            <Icon icon={item.icon} />{item.title}
            {#if item.count}<span class="count" aria-label="{item.count} waiting">{item.count}</span>{/if}
          </a>
        </li>
      {/each}
    </ul>
  {/each}
{/snippet}

<div class="shell" {@attach worn(theme)}>
  <nav class="sidebar" aria-label="Main">
    {#if settings}
    <div class="top">
      <a class="leave" href={state.left}><Icon icon={CaretLeft} size="0.8rem" />Back to app</a>
    </div>
    <div class="middle">
      <p class="label">Settings</p>
      {@render list('platform')}
    </div>
    {:else}
    <div class="top">
    <div class="coop">
      <Popover label="Co-op: {scope.name}{lens ? ` / ${lens.name}` : ''}">
        {#snippet trigger()}
          <span class="mark" aria-hidden="true">{scope.name.slice(0, 1).toUpperCase()}</span>
          <b class="name">{scope.name}{#if lens}<span class="lensed"> / {lens.name}</span>{/if}</b>
          <Icon icon={CaretUpDown} size="0.9em" />
        {/snippet}
        <button role="menuitemradio" aria-checked="true" class="item">
          <span class="mark small">{scope.name.slice(0, 1).toUpperCase()}</span>
          <span class="names">
            <b>{scope.name}</b>
            <span>{scope.legal ?? scope.address}</span>
          </span>
          <Icon icon={Check} />
        </button>
        {#if circles.length}
          <!-- The circles: the one chosen is the member's lens, which every
               collection reads through; All circles clears it. -->
          <p class="label">Circles</p>
          <form method="post" action="/lens" class="list" role="group" aria-label="Circles">
            <input type="hidden" name="back" value={back} />
            <button role="menuitemradio" aria-checked={!lens} class="item" name="lens" value="">
              All circles{#if !lens}<Icon icon={Check} />{/if}
            </button>
            {#each circles as c, i (c.id)}
              {#if i > 0 && !c.sits && circles[i - 1]?.sits}<hr />{/if}
              <button role="menuitemradio" aria-checked={lens?.id === c.id} class="item" name="lens" value={c.id}>
                {c.name}{#if lens?.id === c.id}<Icon icon={Check} />{/if}
              </button>
            {/each}
          </form>
        {/if}
        {#if organization}<a class="item" role="menuitem" href={organization}>Settings</a>{/if}
      </Popover>
    </div>

    <!-- Always here, above the sections: what waits on the acting member. -->
    <ul>
      {#each nav.find((g) => g.group === 'home')?.items ?? [] as item (item.href)}
        <li>
          <a href={item.href} class:on={here(item.href)} aria-current={here(item.href) ? 'page' : undefined}>
            <Icon icon={item.icon} />{item.title}
            {#if item.count}<span class="count" aria-label="{item.count} waiting">{item.count}</span>{/if}
          </a>
        </li>
      {/each}
    </ul>

    </div>

    <!-- The sections, accordions as Linear's: the name and a caret, no
         icon; open, the collections indented on a guide line. -->
    <div class="middle">
      {#each sections.filter((s) => has(s.group)) as s (s.group)}
        {const open = $derived(state.expanded(s.group, s.group === held))}
        <button class="head" aria-expanded={open} onclick={() => state.toggle(s.group, s.group === held)}>
          <span class="title">{s.title}</span>
          <span class="caret"><Icon icon={open ? CaretDown : CaretRight} size="0.7rem" /></span>
          {#if !open && waiting(s.group)}<span class="dot" aria-label="{waiting(s.group)} waiting in {s.title}"></span>{/if}
        </button>
        {#if open}<div class="tree">{@render list(s.group)}</div>{/if}
      {/each}
    </div>
    {/if}

    <div class="foot">
    <Command {collections} {source} />
    <div class="account">
      <Popover label="Account: {actor?.name ?? 'no one signed in'}" side="top" wide>
        {#snippet trigger()}
          <span class="avatar" aria-hidden="true">{actor ? initials(actor.name) : '–'}</span>
          <span class="names">
            <b>{actor?.name ?? 'No one signed in'}</b>
          </span>
          <Icon icon={CaretUpDown} size="0.9em" />
        {/snippet}
        {#if actor}
          <p class="label">Signed in</p>
          <p class="hint">{actor.address}, on this device</p>
          <div class="list">
            {#if personal}<a class="item" role="menuitem" href={personal}>Settings</a>{/if}
            <form method="post" action="/sign-out" class="list">
              <button class="item">Sign out</button>
            </form>
          </div>
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
    </div>
  </nav>

  <main class="main">
    {@render children()}
    {#if dev}
      <!-- Dev mode, where anyone signs in as a fixture member: a watermark
           at the content's foot, by the drawer. Its word is drawn by CSS,
           a mark and no text to read. -->
      <p class="prototype" title="Development server: anyone may sign in as a fixture member" aria-hidden="true">
        <Icon icon={TestTube} size="1.1rem" />
      </p>
    {/if}
  </main>
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
  /* Top and foot stay put; only the middle scrolls. */
  .sidebar {
    position: relative;
    display: grid;
    grid-template-rows: auto minmax(0, 1fr) auto;
    min-height: 0;
    padding: var(--space-3);
    font-size: var(--text-sm);
  }
  /* The dev-mode watermark: upright at the content's bottom right, below
     the drawer, large and faint enough to read past. */
  .prototype {
    position: absolute;
    right: var(--space-4);
    bottom: var(--space-3);
    display: flex;
    align-items: center;
    gap: var(--space-1);
    margin: 0;
    font-size: var(--text-md);
    color: var(--text);
    opacity: 0.16;
    pointer-events: none;
    user-select: none;
  }
  .prototype::after {
    content: 'prototype';
  }
  .top {
    display: grid;
    gap: var(--space-2);
    padding-bottom: var(--space-4);
  }
  /* Settings' way back to where the member left the app. */
  .leave {
    display: flex;
    align-items: center;
    gap: var(--space-2);
    height: 1.9rem;
    padding: 0 var(--space-2);
    border-radius: var(--radius-control);
    color: var(--text-muted);
    font-weight: 500;
  }
  .leave:hover {
    background: var(--hover);
    color: var(--text);
  }
  .middle {
    min-height: 0;
    overflow-y: auto;
  }
  .foot {
    display: grid;
    gap: var(--space-3);
    padding-top: var(--space-2);
  }
  /* A section's or a group's accordion: the icon, the name and a quiet
     caret, as a collection's row is drawn; open, its collections hang
     from a guide line. */
  .head {
    display: flex;
    align-items: center;
    gap: var(--space-2);
    width: 100%;
    height: 1.9rem;
    padding: 0 var(--space-2);
    border: none;
    border-radius: var(--radius-control);
    background: none;
    color: var(--text-muted);
    font-weight: 500;
    text-align: start;
    cursor: pointer;
  }
  .head:hover {
    background: var(--hover);
    color: var(--text);
  }
  .head:focus-visible {
    outline: 2px solid var(--accent-text);
    outline-offset: 1px;
  }
  .head .title {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .caret {
    display: flex;
    color: var(--text-subtle);
  }
  .tree {
    margin: 1px 0 var(--space-2) calc(var(--space-2) + 1px);
    padding-left: var(--space-1);
    border-left: 1px solid var(--line);
  }
  /* Something in a shut accordion waits on the acting member. */
  .dot {
    margin-inline-start: auto;
    width: 7px;
    height: 7px;
    border-radius: 50%;
    background: var(--accent-fill);
  }
  .main {
    position: relative;
    margin: var(--space-2) var(--space-2) var(--space-2) 0;
    background: var(--panel);
    border-radius: var(--radius-panel);
    min-height: 0;
    overflow: hidden;
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
  .lensed {
    color: var(--text-muted);
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
  .list {
    display: grid;
  }
  .list hr {
    margin: var(--space-1) var(--space-2);
    border: none;
    border-top: 1px solid var(--line);
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
    font-size: var(--text-xs);
    font-weight: 500;
    color: var(--text-subtle);
    padding: var(--space-2) var(--space-2) var(--space-1);
  }
  ul + .group {
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
  /* How many rows wait: a small pill, quiet beside its name. */
  .count {
    margin-inline-start: auto;
    min-width: 1.1rem;
    padding: 0 5px;
    border-radius: 999px;
    background: var(--sunk);
    color: var(--text-muted);
    font-size: var(--text-2xs);
    font-weight: 600;
    line-height: 1.1rem;
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
