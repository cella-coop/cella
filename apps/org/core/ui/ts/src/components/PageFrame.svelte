<script lang="ts">
  import type { Component, Snippet } from 'svelte'
  import CaretLeft from 'phosphor-svelte/lib/CaretLeft'
  import SidebarSimple from 'phosphor-svelte/lib/SidebarSimple'
  import type { Panel, Tone } from '../models/view.ts'
  import { useShell } from '../hooks/useShell.ts'
  import { scroller } from '../models/keys.ts'
  import Badge from './Badge.svelte'
  import Icon from './Icon.svelte'

  // The one page frame, its header one compact row as Linear's: on an
  // item, a quiet way back to its collection; the page's name with its
  // count and status; the page's tabs right after it, a collection's views, scrolling in their own strip
  // when they run out of room; then the page's writes and one quiet icon
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
    heading = true,
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
    back?: { href: string; label: string }
    // Whether the name is the page's heading; a record's page names its
    // kind and reference here and holds its title as the heading.
    heading?: boolean
    actions?: Snippet
    bar?: Snippet
    panels?: Panel[]
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
</script>

<div class="frame" class:drawn={open && shell.drawer}>
  <header class="top">
    <div class="name">
      {#if back}
        <a href={back.href} class="back" title="Back to {back.label}  Esc" aria-label="Back to {back.label}"><Icon icon={CaretLeft} /></a>
      {/if}
      {#if icon && !back}<span class="mark" aria-hidden="true"><Icon {icon} size="1.15rem" /></span>{/if}
      {#if heading}
        <h1 title={caption}>{title}</h1>
      {:else}
        <span class="crumb" title={caption}>{title}</span>
      {/if}
      {#if count}<span class="count">{count}</span>{/if}
      {#each badges as b (b.label)}<Badge tone={b.tone}>{b.label}</Badge>{/each}
    </div>
    <div class="tabs">{@render bar?.()}</div>
    {#if actions}<div class="actions">{@render actions()}</div>{/if}
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
              title={p.label}
              aria-label={p.label}
              onclick={() => choose(p.id)}
            >
              <Icon icon={p.icon} />
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

  <div class="content" {@attach scroller(title)}>
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
  .back {
    display: grid;
    place-items: center;
    width: 1.5rem;
    height: 1.5rem;
    margin-inline-start: calc(-1 * var(--space-1));
    border-radius: var(--radius-control);
    color: var(--text-muted);
  }
  .back:hover {
    background: var(--hover);
    color: var(--text);
  }
  .mark {
    display: flex;
    flex: none;
    color: var(--text-muted);
  }
  h1,
  .crumb {
    font-family: var(--font-ui);
    font-size: var(--text-md);
    font-weight: 500;
    line-height: 1.35;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .crumb {
    color: var(--text-muted);
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
     not seen, and its choices stay narrow. */
  .actions :global(.field .label) {
    position: absolute;
    width: 1px;
    height: 1px;
    overflow: hidden;
    clip-path: inset(50%);
    white-space: nowrap;
  }
  .actions :global(select) {
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
    overflow-y: auto;
    padding: var(--space-4);
    display: grid;
    align-content: start;
    gap: var(--space-4);
    min-width: 0;
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
    overflow-x: hidden;
    overflow-y: auto;
    min-width: 0;
    padding: var(--space-4);
  }
  .panel {
    display: grid;
    align-content: start;
    gap: var(--space-4);
    min-width: 0;
  }
  @media (max-width: 900px) {
    .frame,
    .drawn {
      grid-template-columns: minmax(0, 1fr);
      grid-template-rows: auto auto auto;
      overflow-y: auto;
    }
    .content {
      overflow: visible;
    }
    .drawer {
      grid-column: 1;
      overflow: visible;
    }
  }
</style>
