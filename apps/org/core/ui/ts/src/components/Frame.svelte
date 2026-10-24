<script lang="ts">
  import type { Snippet } from 'svelte'
  import ArrowLeft from 'phosphor-svelte/lib/ArrowLeft'
  import SidebarSimple from 'phosphor-svelte/lib/SidebarSimple'
  import type { Panel, Tone } from '../models/view.ts'
  import { useShell } from '../hooks/useShell.ts'
  import Badge from './Badge.svelte'
  import Icon from './Icon.svelte'

  // The one page frame: a header with the page's eyebrow, title and
  // actions, the content, and the drawer when the page has panels, which
  // the header's last button, or ], shows and hides on every page at once.
  // The drawer's tab bar shows one icon per panel, the open one marked,
  // even when there is one.
  let {
    eyebrow,
    title,
    subtitle,
    badges = [],
    back,
    actions,
    panels = [],
    children,
  }: {
    eyebrow: string
    title: string
    subtitle?: string
    // Whether the whole page's subject holds, beside the subtitle.
    badges?: { label: string; tone: Tone }[]
    back?: { href: string; label: string }
    actions?: Snippet
    panels?: Panel[]
    children: Snippet
  } = $props()

  const shell = useShell()
  const id = $props.id()
  const drawer = $derived(panels.length > 0)
  const open = $derived(panels.find((p) => p.id === shell.panel) ?? panels[0])
</script>

<div class="frame" class:drawn={drawer && shell.drawer}>
  <div class="content">
    <header>
      <div class="heading">
        <p class="eyebrow">
          {#if back}
            <a href={back.href} class="back" title="Back to {back.label} (Esc)"><Icon icon={ArrowLeft} size="0.9em" />{back.label}</a>
            <span class="sep">/</span>
          {/if}
          {eyebrow}
        </p>
        <h1>{title}</h1>
        {#if subtitle || badges.length}
          <p class="subtitle">
            {subtitle}
            {#each badges as b (b.label)}<Badge tone={b.tone}>{b.label}</Badge>{/each}
          </p>
        {/if}
      </div>
      {#if actions || drawer}
        <div class="actions">
          {@render actions?.()}
          {#if drawer}
            <div class="icons">
              <div class="tabs" role="tablist" aria-label="Drawer panels">
                {#each panels as p (p.id)}
                  <button
                    role="tab"
                    id="{id}-{p.id}"
                    class:on={shell.drawer && p === open}
                    aria-selected={shell.drawer && p === open}
                    aria-controls={id}
                    title={p.label}
                    aria-label={p.label}
                    onclick={() => shell.choose(p.id)}
                  >
                    <Icon icon={p.icon} />
                  </button>
                {/each}
              </div>
              <button
                class="toggle"
                onclick={() => shell.show()}
                title="{shell.drawer ? 'Hide' : 'Show'} the drawer  ]"
                aria-label="Drawer"
                aria-expanded={shell.drawer}
                aria-controls={id}
              >
                <Icon icon={SidebarSimple} />
              </button>
            </div>
          {/if}
        </div>
      {/if}
    </header>
    <div class="body">{@render children()}</div>
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
    height: 100%;
    min-height: 0;
  }
  .drawn {
    grid-template-columns: minmax(0, 1fr) var(--drawer);
  }
  .content {
    overflow-y: auto;
    padding: var(--space-5) var(--space-6) var(--space-6);
    display: grid;
    align-content: start;
    gap: var(--space-5);
    min-width: 0;
  }
  header {
    display: flex;
    justify-content: space-between;
    align-items: end;
    gap: var(--space-4);
    flex-wrap: wrap;
  }
  .heading {
    display: grid;
    gap: var(--space-1);
    min-width: 0;
  }
  .eyebrow {
    font-size: var(--text-2xs);
    font-weight: 600;
    letter-spacing: var(--eyebrow-tracking);
    text-transform: uppercase;
    color: var(--text-subtle);
    display: flex;
    align-items: center;
    gap: var(--space-2);
  }
  .back {
    display: inline-flex;
    align-items: center;
    gap: var(--space-1);
    color: var(--text-muted);
  }
  .back:hover {
    color: var(--accent-text);
  }
  .sep {
    opacity: 0.5;
  }
  h1 {
    font-size: var(--text-2xl);
  }
  .subtitle {
    color: var(--text-muted);
    display: flex;
    align-items: center;
    gap: var(--space-2);
    flex-wrap: wrap;
  }
  .actions {
    display: flex;
    gap: var(--space-2);
    align-items: end;
    flex-wrap: wrap;
  }
  /* The header's icon group, as Linear's: the drawer's panel tabs, then
     the drawer's toggle; quiet icons, the open panel's on a sunk fill. */
  .icons {
    display: flex;
    align-items: center;
    gap: var(--space-1);
  }
  .tabs {
    display: flex;
    gap: 2px;
  }
  .tabs button,
  .toggle {
    display: grid;
    place-items: center;
    width: 2rem;
    height: 2rem;
    border: none;
    border-radius: var(--radius-control);
    background: none;
    color: var(--text-muted);
    cursor: pointer;
    transition: background var(--fast) var(--ease);
  }
  .tabs button:hover,
  .toggle:hover {
    background: var(--hover);
    color: var(--text);
  }
  .tabs button.on {
    background: var(--sunk);
    color: var(--text);
  }
  /* Phosphor draws its sidebar on the left; the drawer is on the right. */
  .toggle :global(svg) {
    transform: scaleX(-1);
  }
  .body {
    display: grid;
    gap: var(--space-4);
    min-width: 0;
  }
  /* The drawer is the content's own panel; its cards are raised on it,
     spaced as the content's blocks are. */
  .drawer {
    overflow-y: auto;
    padding: var(--space-5) var(--space-4) var(--space-4);
  }
  .panel {
    display: grid;
    align-content: start;
    gap: var(--space-4);
  }
  @media (max-width: 900px) {
    .drawn {
      grid-template-columns: minmax(0, 1fr);
      overflow-y: auto;
    }
    .content {
      overflow: visible;
      padding: var(--space-4);
    }
  }
</style>
