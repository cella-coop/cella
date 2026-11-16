<script lang="ts">
  import type { Snippet } from 'svelte'
  import { afterNavigate } from '$app/navigation'
  import { page } from '$app/state'
  import '../styles/tokens.css'
  import '../styles/base.css'
  import CaretDown from 'phosphor-svelte/lib/CaretDown'
  import CaretLeft from 'phosphor-svelte/lib/CaretLeft'
  import CaretRight from 'phosphor-svelte/lib/CaretRight'
  import CaretUpDown from 'phosphor-svelte/lib/CaretUpDown'
  import Check from 'phosphor-svelte/lib/Check'
  import Desktop from 'phosphor-svelte/lib/Desktop'
  import Moon from 'phosphor-svelte/lib/Moon'
  import Sun from 'phosphor-svelte/lib/Sun'
  import type { Jump, Nav, Person, Theme } from '../models/view.ts'
  import { listed, runs } from '../models/arrange.ts'
  import type { Outcome as Done } from '../models/outcome.ts'
  import { useShell } from '../hooks/useShell.ts'
  import { usePinned } from '../hooks/usePinned.ts'
  import { mark } from '../marks.ts'
  import type { Search } from '../hooks/CommandState.svelte.ts'
  import Command from './Command.svelte'
  import Icon from './Icon.svelte'
  import Outcome from './Outcome.svelte'
  import Popover from './Popover.svelte'
  import { typing } from '../models/keys.ts'
  import { worn } from '../models/theme.ts'
  import { TestTube } from '../icons.ts'
  import favicon from '@cella/brand/favicon.svg?url'

  // The shell: the sidebar and the content beside it; the last write's
  // outcome floats above. ] shows or hides every page's drawer. The
  // sidebar shows the circle the member is in: its top stays put, the
  // co-op selector, the Inbox, Activity and Pinned, the views the
  // member pinned, the same in every circle. Its middle, which alone
  // scrolls, lists the circle's enabled features, in its order, under its
  // accordions, then More…. Its foot stays put too: the command menu and
  // the acting member's account.
  let {
    scope,
    nav,
    actor,
    dev,
    theme,
    outcome,
    source,
    drawer,
    kept = '',
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
    // The sidebar accordions the viewer opened or shut, as their cookie holds them.
    kept?: string
    // The names of the people the co-op knows, by address.
    people: Record<string, string>
    // The circles the member reads, the assembly first, then those they
    // sit in, each with its features spelt as one listing, and the one
    // they lensed the co-op on, if any, the circle they are in.
    circles?: { id: string; name: string; sits: boolean; assembly?: boolean; features?: string }[]
    lens?: { id: string; name: string; features?: string } | null
    children: Snippet
  } = $props()

  const state = useShell(() => outcome, () => drawer, () => people, () => lens, () => circles, () => nav, () => kept)
  const pinned = usePinned()

  function onkeydown(e: KeyboardEvent) {
    if (e.key !== ']' || e.metaKey || e.ctrlKey || e.altKey || typing(e) || document.querySelector('dialog[open]')) {
      return
    }
    state.show()
    e.preventDefault()
  }

  // What the command menu jumps to: every collection, those kept out of the
  // sidebar too, and every settings page but a page of one thing, whose
  // address needs the thing it is of.
  const collections: Jump[] = $derived(
    nav.flatMap((g) => g.items.filter((i) => g.group !== 'platform' || i.listed !== false).map((i) => ({ title: i.title, href: i.href, kind: g.group }))),
  )
  const here = (href: string) => page.url.pathname === href || page.url.pathname.startsWith(`${href}/`)
  const initials = (name: string) => name.split(/\s+/).map((w) => w[0]).slice(0, 2).join('')
  const back = $derived(page.url.pathname + page.url.search)
  // Whether a pin's address is the page open, a bare `?` as none.
  const opened = (href: string) => href.replace(/\?$/, '') === back
  // A collection's own icon, as the sidebar draws it, for a pin of a
  // preset that names no mark of its own.
  const owner = (collection: string) => nav.flatMap((g) => g.items).find((i) => i.href === `/${collection}`)?.icon
  // The circles the selector lists: those the member sits in, and the lens's
  // own where they do not, so the lens shows checked and can be cleared; the
  // assembly is the co-op's own row.
  const sat = $derived(circles.filter((c) => !c.assembly && (c.sits || c.id === lens?.id)))
  // The theme button cycles system, light, dark; its icon is the current one.
  const cycle = { system: 'light', light: 'dark', dark: 'system' } as const
  const marks = { system: Desktop, light: Sun, dark: Moon } as const
  const next = $derived(cycle[theme])

  // The circle the member is in: their lens, or the assembly where they
  // lensed none, which reads whole.
  const inside = $derived(lens ?? circles.find((c) => c.assembly) ?? null)
  // Its features in its order, as runs: an accordion's features together
  // under its name, a feature under none a run of its own; each drawn as
  // the collections its feat owns that the sidebar lists.
  const owned = (feature: string) => (nav.find((g) => g.group === 'feature')?.items ?? []).filter((i) => i.feature === feature && i.listed !== false)
  const features = $derived(
    runs(listed(inside?.features ?? ''))
      .map((r) => ({ group: r.group, items: r.items.flatMap((i) => owned(i.placed.value)) }))
      .filter((r) => r.items.length),
  )
  type Items = Nav[number]['items']
  const holds = (items: Items) => items.some((i) => here(i.href))
  const waits = (items: Items) => items.reduce((n, i) => n + (i.waiting ?? i.count ?? 0), 0)
  // The group the page is in, Settings' where it is one of its pages.
  const held = $derived(nav.find((g) => g.items.some((i) => here(i.href) && i.href !== '/'))?.group)
  // Settings' collections by subgroup, in its areas' order.
  const parts = (group: string) => {
    const by = new Map<string, Nav[number]['items']>()
    for (const item of (nav.find((g) => g.group === group)?.items ?? []).filter((i) => i.listed !== false)) {
      const key = item.subgroup ?? ''
      by.set(key, [...(by.get(key) ?? []), item])
    }
    const parted = [...by].map(([sub, items]) => ({ sub, items }))
    return parted.sort((a, b) => areas.indexOf(a.sub) - areas.indexOf(b.sub))
  }
  // Settings is its own sidebar, in place of the features, while a page
  // of it is open: the member's own pages, then the co-op's. The account
  // menu leads into it at Personal, the co-op menu at Organization.
  const areas = ['Personal', 'Organization']
  const settings = $derived(held === 'platform')
  const opens = (area: string) => (parts('platform').find((p) => p.sub === area) ?? parts('platform')[0])?.items[0]?.href
  const personal = $derived(opens('Personal'))
  const organization = $derived(opens('Organization'))
  state.follow(() => back, () => settings, afterNavigate)
</script>

<svelte:window {onkeydown} />

<!-- The brand's mark, as the site wears it, on every page of the app. -->
<svelte:head>
  <link rel="icon" type="image/svg+xml" href={favicon} />
</svelte:head>

<!-- Collections, each its icon, its title and its count where it has one. -->
{#snippet links(items: Items)}
  <ul>
    {#each items as item (item.href)}
      <li>
        <a href={item.href} class:on={here(item.href)} aria-current={here(item.href) ? 'page' : undefined}>
          <Icon icon={item.icon} />{item.title}
          {#if item.count}<span class="count" aria-label="{item.count} waiting">{item.count}</span>{/if}
        </a>
      </li>
    {/each}
  </ul>
{/snippet}

<!-- Settings' collections, labelled by subgroup where it has several. -->
{#snippet list()}
  {const ps = $derived(parts('platform'))}
  {#each ps as part (part.sub)}
    {#if ps.length > 1}<p class="group">{part.sub}</p>{/if}
    {@render links(part.items)}
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
      {@render list()}
    </div>
    {:else}
    <div class="top">
    <div class="coop">
      <Popover label="Co-op: {scope.name}{lens ? ` / ${lens.name}` : ''}">
        {#snippet trigger()}
          <span class="mark" aria-hidden="true">{scope.name.slice(0, 1).toUpperCase()}</span>
          <!-- Through a circle, the circle is the name and the co-op its
               eyebrow. -->
          {#if lens}
            <span class="names"><span>{scope.name}</span><b class="name">{lens.name}</b></span>
          {:else}
            <b class="name">{scope.name}</b>
          {/if}
          <Icon icon={CaretUpDown} size="0.9em" />
        {/snippet}
        <!-- The co-op and its circles are one radio group: the co-op, whose
             root is the assembly, clears the member's lens, a circle sets it,
             and every collection reads through the one chosen. -->
        <form method="post" action="/lens" class="list" role="group" aria-label="Co-op">
          <input type="hidden" name="back" value={back} />
          <button role="menuitemradio" aria-checked={!lens} class="item" name="lens" value="">
            <span class="mark small">{scope.name.slice(0, 1).toUpperCase()}</span>
            <span class="names">
              <b>{scope.name}</b>
              <span>{scope.legal ?? scope.address}</span>
            </span>
            {#if !lens}<Icon icon={Check} />{/if}
          </button>
          {#if sat.length}
            <p class="label">Circles</p>
            {#each sat as c (c.id)}
              <button role="menuitemradio" aria-checked={lens?.id === c.id} class="item" name="lens" value={c.id}>
                {c.name}{#if lens?.id === c.id}<Icon icon={Check} />{/if}
              </button>
            {/each}
          {/if}
        </form>
        {#if organization}<hr /><a class="item" role="menuitem" href={organization}>Settings</a>{/if}
      </Popover>
    </div>

    <!-- Always here, above the features: what waits on the acting member. -->
    {@render links(nav.find((g) => g.group === 'home')?.items ?? [])}

    <!-- Pinned, the one place the same in every circle: the views the
         member pinned, each opening at its own address. -->
    <div class="pinned">
      <p class="label">Pinned</p>
      {#if pinned.list.length}
        <ul aria-label="Pinned">
          {#each pinned.list as f (`${f.collection} ${f.view}`)}
            {const on = $derived(opened(f.href))}
            <li>
              <a href={f.href} class:on aria-current={on ? 'page' : undefined}>
                <Icon icon={f.icon ? mark(f.icon) : (owner(f.collection) ?? mark())} /><span class="title">{f.name}</span>
              </a>
            </li>
          {/each}
        </ul>
      {:else}
        <p class="hint">Pin a view from its View panel.</p>
      {/if}
    </div>

    </div>

    <!-- The features of the circle the member is in, in its order: a run
         under an accordion as Linear's teams, the name and a caret, no
         icon, open, its collections indented on a guide line; a run under
         none listed flat. More… opens the circle's features page. -->
    <div class="middle">
      {#each features as run}
        {#if run.group}
          {const key = $derived(`feature:${run.group}`)}
          {const open = $derived(state.expanded(key, holds(run.items)))}
          <button class="head" aria-expanded={open} onclick={() => state.toggle(key, holds(run.items))}>
            <span class="title">{run.group}</span>
            <span class="caret"><Icon icon={open ? CaretDown : CaretRight} size="0.7rem" /></span>
            {#if !open && waits(run.items)}<span class="dot" aria-label="{waits(run.items)} waiting in {run.group}"></span>{/if}
          </button>
          {#if open}<div class="tree">{@render links(run.items)}</div>{/if}
        {:else}
          {@render links(run.items)}
        {/if}
      {/each}
      {#if inside}<a class="more" href="/settings/features/{inside.id}">More…</a>{/if}
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
        <!-- The menu's head: who is signed in, and the theme as one button
             that cycles system, light and dark. -->
        <div class="head-row">
          <p class="label">{actor ? 'Signed in' : 'Theme'}</p>
          <form method="post" action="/theme" class="theme">
            <input type="hidden" name="back" value={back} />
            <button name="theme" value={next} title="Theme: {theme}. Switch to {next}" aria-label="Theme: {theme}. Switch to {next}">
              <Icon icon={marks[theme]} />
            </button>
          </form>
        </div>
        {#if actor}
          <p class="hint">{actor.address}, on this device</p>
          <div class="list">
            {#if personal}<a class="item" role="menuitem" href={personal}>Settings</a>{/if}
            <form method="post" action="/sign-out" class="list">
              <button class="item">Sign out</button>
            </form>
          </div>
        {/if}
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
    grid-template-columns: minmax(0, 1fr);
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
  /* Pinned stay in the top, so a long list scrolls in its own place. */
  .pinned ul {
    max-height: 12rem;
    overflow-y: auto;
  }
  .pinned .title {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  /* One column no wider than the sidebar: a long name truncates rather
     than widen it. */
  .foot {
    display: grid;
    grid-template-columns: minmax(0, 1fr);
    gap: var(--space-3);
    padding-top: var(--space-2);
  }
  /* An accordion of the circle's: the icon, the name and a quiet
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
  /* The circle's features page, after its features: quieter than a
     collection, as an accordion's name is. */
  .more {
    display: flex;
    align-items: center;
    height: 1.9rem;
    margin-top: var(--space-1);
    padding: 0 var(--space-2);
    border-radius: var(--radius-control);
    color: var(--text-subtle);
  }
  .more:hover {
    background: var(--hover);
    color: var(--text);
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
  hr {
    margin: var(--space-1) var(--space-2);
    border: none;
    border-top: 1px solid var(--line);
  }
  .item {
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
  .item:focus-visible {
    background: var(--hover);
  }
  .item :global(svg:last-child) {
    margin-inline-start: auto;
    color: var(--accent-text);
  }
  .head-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--space-2);
  }
  .theme button {
    display: grid;
    place-items: center;
    padding: var(--space-1);
    border: none;
    border-radius: var(--radius-control);
    background: none;
    color: var(--text-muted);
    cursor: pointer;
  }
  .theme button:hover,
  .theme button:focus-visible {
    background: var(--hover);
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
