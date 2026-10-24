<script lang="ts">
  import type { Snippet } from 'svelte'
  import ArrowLeft from 'phosphor-svelte/lib/ArrowLeft'
  import Icon from './Icon.svelte'

  // The one page frame: a header with the page's eyebrow, title and
  // actions, the content, and the drawer when the page has one.
  let {
    eyebrow,
    title,
    subtitle,
    back,
    actions,
    drawer,
    children,
  }: {
    eyebrow: string
    title: string
    subtitle?: string
    back?: { href: string; label: string }
    actions?: Snippet
    drawer?: Snippet
    children: Snippet
  } = $props()
</script>

<div class="frame" class:drawn={drawer}>
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
        {#if subtitle}<p class="subtitle">{subtitle}</p>{/if}
      </div>
      {#if actions}<div class="actions">{@render actions()}</div>{/if}
    </header>
    <div class="body">{@render children()}</div>
  </div>
  {#if drawer}
    <aside class="drawer">{@render drawer()}</aside>
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
  }
  .actions {
    display: flex;
    gap: var(--space-2);
    align-items: end;
    flex-wrap: wrap;
  }
  .body {
    display: grid;
    gap: var(--space-4);
    min-width: 0;
  }
  .drawer {
    background: var(--raised);
    overflow-y: auto;
    padding: var(--space-4);
    display: grid;
    align-content: start;
    gap: var(--space-3);
    border-start-end-radius: var(--radius-panel);
    border-end-end-radius: var(--radius-panel);
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
    .drawer {
      border-radius: 0;
    }
  }
</style>
