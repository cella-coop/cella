<script lang="ts">
  import type { Component, Snippet } from 'svelte'
  import { navigating } from '$app/state'
  import CaretRight from 'phosphor-svelte/lib/CaretRight'
  import SidebarSimple from 'phosphor-svelte/lib/SidebarSimple'
  import type { DrawerPanel, Tone } from '../models/view.ts'
  import { useShell } from '../hooks/useShell.ts'
  import { scroller, typing } from '../models/keys.ts'
  import Badge from './Badge.svelte'
  import Icon from './Icon.svelte'

  // The one page frame, its header one compact row as Linear's: on an
  // item, a breadcrumb, its collection's icon and name, the way back,
  // then the item's name; elsewhere the page's icon and name; either with
  // its count and status; the page's tabs right after it, a collection's
  // views, scrolling in their own strip when they run out of room; then
  // the page's writes and one quiet icon
  // group, the drawer's panel tabs beside its toggle, which stays there
  // when the drawer is shut. The header spans the content and the drawer
  // on one grid; under it, the content with an item's subtitle, and the
  // drawer. ] shows and hides the drawer on every page at once.
  let {
    title,
    icon,
    count,
    caption,
    subtitle,
    badges = [],
    back,
    actions,
    bar,
    panels = [],
    children,
  }: {
    title: string
    // The collection's icon, as the sidebar shows it, before its name.
    icon?: Component<any>
    // How many items the page shows, after its name.
    count?: string
    // What the page is, in its trade's words: the name's tooltip.
    caption?: string
    // An item's line under its name, or what a lens leaves of a
    // collection, at the top of the content.
    subtitle?: string
    // Whether the whole page's subject holds, beside its count.
    badges?: { label: string; tone: Tone }[]
    // An item's collection, its name and icon as the sidebar shows them:
    // the breadcrumb's first segment and the way back. The page's name is
    // then the crumb's last, not the heading, which the content holds.
    back?: { href: string; label: string; icon?: Component<any> }
    actions?: Snippet
    bar?: Snippet
    panels?: DrawerPanel[]
    children: Snippet
  } = $props()

  const shell = useShell()
  const id = $props.id()
  const drawer = $derived(panels.length > 0)
  const open = $derived(panels.find((p) => p.id === shell.panel) ?? panels[0])

  function choose(panel: string) {
    shell.choose(panel)
    shell.show(true)
  }

  // Where the window cannot hold the sidebar, the content at its least
  // width and the drawer side by side, the drawer lies over the content,
  // and Escape shuts it before anything else on the page hears the key.
  // The width is the style's `over` query below.
  const over = '(max-width: 75.5rem)'
  function onkeydown(e: KeyboardEvent) {
    if (e.key !== 'Escape' || !open || !shell.drawer || typing(e) || !window.matchMedia(over).matches) {
      return
    }
    if (document.querySelector('dialog[open], :popover-open')) {
      return
    }
    shell.show(false)
    e.preventDefault()
    e.stopImmediatePropagation()
  }
</script>

<svelte:window onkeydowncapture={onkeydown} />

<div class="frame" class:drawn={open && shell.drawer}>
  <header class="top">
    <div class="name">
      {#if back}
        <nav class="crumbs" aria-label="Breadcrumb">
          <a href={back.href} class="up" title="Back to {back.label}  Esc">
            {#if back.icon}<span class="mark"><Icon icon={back.icon} size="1.15rem" /></span>{/if}{back.label}
          </a>
          <span class="sep" aria-hidden="true"><Icon icon={CaretRight} weight="regular" size="0.8rem" /></span>
          <span class="here" aria-current="page" title={caption ? `${caption}: ${title}` : title}>{title}</span>
        </nav>
      {:else}
        {#if icon}<span class="mark" aria-hidden="true"><Icon {icon} size="1.15rem" /></span>{/if}
        <h1 title={caption}>{title}</h1>
      {/if}
      {#if count}<span class="count">{count}</span>{/if}
      {#each badges as b (b.label)}<Badge tone={b.tone}>{b.label}</Badge>{/each}
    </div>
    <div class="tabs">{@render bar?.()}</div>
    {#if actions}<div class="actions" data-run>{@render actions()}</div>{/if}
    {#if drawer}
      <div class="icons">
        <div class="panels" role="tablist" aria-label="Drawer panels">
          {#each panels as p (p.id)}
            <button
              role="tab"
              id="{id}-{p.id}"
              class:on={shell.drawer && p === open}
              aria-selected={shell.drawer && p === open}
              aria-controls={id}
              title={p.note ? `${p.label}: ${p.note}` : p.label}
              aria-label={p.note ? `${p.label}, ${p.note}` : p.label}
              onclick={() => choose(p.id)}
            >
              <Icon icon={p.icon} />
              {#if p.note}<span class="note" aria-hidden="true"></span>{/if}
            </button>
          {/each}
        </div>
        <button
          class="toggle"
          onclick={() => shell.show()}
          title="{shell.drawer ? 'Hide' : 'Show'} the drawer  ]"
          aria-label="{shell.drawer ? 'Hide' : 'Show'} the drawer"
          aria-expanded={shell.drawer}
          aria-controls={id}
        >
          <Icon icon={SidebarSimple} />
        </button>
      </div>
    {/if}
  </header>

  <div class="content" aria-busy={navigating.to !== null} {@attach scroller(title)}>
    {#if subtitle}<p class="subtitle">{subtitle}</p>{/if}
    {@render children()}
  </div>

  {#if open && shell.drawer}
    <aside class="drawer" aria-label={open.label}>
      <div class="panel" {id} role="tabpanel" aria-labelledby="{id}-{open.id}">{@render open.body()}</div>
    </aside>
  {/if}
</div>

<style>
  .frame {
    display: grid;
    grid-template-columns: minmax(0, 1fr);
    grid-template-rows: auto minmax(0, 1fr);
    height: 100%;
    min-height: 0;
  }
  .drawn {
    grid-template-columns: minmax(0, 1fr) var(--drawer);
  }
  .top {
    grid-column: 1 / -1;
    display: flex;
    align-items: center;
    gap: var(--space-4);
    min-height: 3.375rem;
    padding: var(--space-2) var(--space-4);
    border-bottom: 1px solid var(--line);
    min-width: 0;
  }
  .name {
    display: flex;
    align-items: center;
    gap: var(--space-2);
    flex: none;
    max-width: 40%;
    min-width: 0;
    white-space: nowrap;
  }
  .mark {
    display: flex;
    flex: none;
    color: var(--text-muted);
  }
  h1,
  .crumbs {
    font-family: var(--font-ui);
    font-size: var(--text-md);
    font-weight: 500;
    line-height: 1.35;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  /* The breadcrumb as Linear's: the collection quiet and whole, a small
     caret, then the item's name in the text's own colour, which alone
     gives way to the row, cut short by an ellipsis. */
  .crumbs {
    display: flex;
    align-items: center;
    gap: var(--space-1);
    min-width: 0;
  }
  .up {
    display: flex;
    align-items: center;
    gap: var(--space-2);
    flex: none;
    padding: 2px var(--space-1);
    margin-inline-start: calc(-1 * var(--space-1));
    border-radius: var(--radius-control);
    color: var(--text-muted);
    text-decoration: none;
  }
  .up:hover {
    background: var(--hover);
    color: var(--text);
  }
  .up:hover .mark {
    color: inherit;
  }
  .sep {
    display: flex;
    flex: none;
    color: var(--text-muted);
  }
  .here {
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    color: var(--text);
  }
  .count {
    font-size: var(--text-sm);
    color: var(--text-muted);
    font-variant-numeric: tabular-nums;
  }
  /* The page's tabs scroll in their own strip, never the page. */
  .tabs {
    flex: 1;
    min-width: 0;
    display: flex;
    align-items: center;
    overflow-x: auto;
    scrollbar-width: none;
  }
  .actions {
    display: flex;
    gap: var(--space-2);
    align-items: center;
    flex: none;
  }
  /* A write in the header keeps it one row: its fields' labels are read,
     not seen, and its choices stay narrow. A form in a popover opened
     from the header is no part of the row: its labels show and its
     choices take its width, as in any form. */
  .actions :global(.field:not(.popover *) .label) {
    position: absolute;
    width: 1px;
    height: 1px;
    overflow: hidden;
    clip-path: inset(50%);
    white-space: nowrap;
  }
  .actions :global(.select:not(.popover *)) {
    max-width: 16rem;
  }
  /* The quiet icon group: the drawer's panel tabs, then its toggle; the
     open panel's tab on a sunk fill. */
  .icons {
    display: flex;
    align-items: center;
    gap: 2px;
    flex: none;
  }
  .panels {
    display: flex;
    gap: 2px;
  }
  .panels button,
  .toggle {
    display: grid;
    place-items: center;
    width: 1.75rem;
    height: 1.75rem;
    border: none;
    border-radius: var(--radius-control);
    background: none;
    color: var(--text-muted);
    cursor: pointer;
    transition: background var(--fast) var(--ease);
  }
  .panels button:hover,
  .toggle:hover {
    background: var(--hover);
    color: var(--text);
  }
  /* A panel's note while it is shut: a small dot at its tab's corner. */
  .panels button {
    position: relative;
  }
  .note {
    position: absolute;
    top: 3px;
    right: 3px;
    width: 6px;
    height: 6px;
    border-radius: 50%;
    background: var(--accent-border);
  }
  .panels button.on {
    background: var(--sunk);
    color: var(--text);
  }
  /* Phosphor draws its sidebar on the left; the drawer is on the right. */
  .toggle :global(svg) {
    transform: scaleX(-1);
  }
  /* What a block holds outside a section sits at a section's inset too. */
  .content {
    --inset: var(--space-3);
    grid-column: 1;
    grid-row: 2;
    overflow-y: auto;
    padding: var(--space-4);
    display: grid;
    align-content: start;
    gap: var(--space-4);
    min-width: 0;
  }
  .content[aria-busy='true'] {
    opacity: 0.6;
    transition: opacity var(--fast);
  }
  /* What the content holds shrinks with it rather than pushing it wide. */
  .content > :global(*) {
    min-width: 0;
  }
  .subtitle {
    color: var(--text-muted);
    font-size: var(--text-sm);
    padding: 0 var(--space-3);
  }
  /* The drawer is the content's own panel; its cards are raised on it,
     spaced as the content's blocks are. It scrolls down, never across. */
  .drawer {
    grid-column: 2;
    grid-row: 2;
    overflow-x: hidden;
    overflow-y: auto;
    min-width: 0;
    /* The gap to the content is as wide as the content's own edge by the
       sidebar (the operator, 17 Nov), with the content's scrollbar midway
       across it, touching neither (the operator, 19 Nov). An overlay bar
       is drawn inside the content's padding, at its edge, so the content
       keeps the larger share and the drawer the smaller. */
    padding: var(--drawer-inset) var(--drawer-inset) var(--drawer-inset) var(--drawer-lead);
    /* clear of a demo's dismissed banner below it, standing in its
       column (`DemoBanner`) */
    padding-bottom: max(var(--drawer-inset), calc(var(--demo-watermark-h, 0px) - var(--frame-margin) + var(--drawer-inset)));
  }
  .drawn > .content {
    padding-inline-end: var(--space-3);
  }
  .panel {
    display: grid;
    align-content: start;
    gap: var(--space-4);
    min-width: 0;
  }
  /* Where the window cannot hold the sidebar (15rem), the content at its
     least width (40rem) and the drawer (20rem) side by side, the drawer
     lies over the content's right edge at its own width, raised as a
     floating thing is; nothing wraps under the content, and the header
     keeps its one row. The script's `over` is the same width. */
  @media (max-width: 75.5rem) {
    .drawn {
      grid-template-columns: minmax(0, 1fr);
    }
    .drawn > .content {
      padding-inline-end: var(--space-4);
    }
    .drawer {
      grid-column: 1;
      grid-row: 2;
      justify-self: end;
      z-index: 2;
      width: min(var(--drawer), 100%);
      height: 100%;
      padding-left: var(--space-4);
      border-left: 1px solid var(--line);
      --surface: var(--float);
      background: var(--surface);
      box-shadow: var(--shadow-float);
    }
  }
</style>
