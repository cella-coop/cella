<script lang="ts">
  import type { Component, Snippet } from 'svelte'
  import type { Tone } from '../models/view.ts'
  import Heading from './Heading.svelte'

  // A panel: one framed summary on a record's overview, as a figure or a
  // chart sits among text, a faint fill and a hairline. Its header is the
  // one heading, its icon, title and count, then at its end the state's
  // pill and quiet facts (`meta`); its body what it summarises, built of
  // the UI core's inner elements (`Table` drawn `dense`, `Stats`,
  // `Field`, `Tally`, `Empty`, `Prose`); its footer, where it has one,
  // help on the left, muted, and its key actions as one run at the right
  // end (`actions`), never in the body. Header, body and footer share one
  // inset, the record's title's, so every left edge lines up; inside it
  // `--inset` is nil, so what it holds sits flush to it.
  let {
    title,
    icon,
    count,
    status,
    meta,
    actions,
    help,
    children,
  }: {
    title: string
    icon?: Component<any>
    count?: number
    status?: { label: string; tone?: Tone; ink?: number } | null
    meta?: string | (string | null | undefined | false)[] | null
    actions?: Snippet
    help?: Snippet
    children?: Snippet
  } = $props()
</script>

<!-- A heading heads content: a panel holding no body and no footer is
     not drawn at all, never an empty frame under its title. -->
{#if children || actions || help}
  <aside class="panel" data-panel={title.toLowerCase()} aria-label={title}>
    <header class="head">
      <Heading {title} {icon} {count} {status} {meta} />
    </header>
    {#if children}<div class="body">{@render children()}</div>{/if}
    {#if actions || help}
      <footer class="foot">
        {#if help}<span class="help">{@render help()}</span>{/if}
        {#if actions}<span class="actions" data-run>{@render actions()}</span>{/if}
      </footer>
    {/if}
  </aside>
{/if}

<style>
  /* Its content's edge is the record's title's: the column's inset, its
     hairline inside it. */
  .panel {
    --inset: 0;
    display: grid;
    gap: var(--space-3);
    min-width: 0;
    padding: var(--space-3) calc(var(--space-4) - 1px);
    border: 1px solid var(--line);
    border-radius: var(--radius-panel);
    --surface: var(--raised);
    background: var(--surface);
  }
  .body {
    display: grid;
    gap: var(--space-3);
    min-width: 0;
  }
  .foot {
    display: flex;
    align-items: center;
    justify-content: space-between;
    flex-wrap: wrap;
    gap: var(--space-2) var(--space-3);
    min-width: 0;
  }
  .help {
    flex: 1 1 12rem;
    min-width: 0;
    font-size: var(--text-xs);
    color: var(--text-muted);
  }
  /* One run of buttons at the footer's right end, a small gap apart, so
     a filled one and those beside it are drawn as one row of cells. */
  .actions {
    display: flex;
    align-items: center;
    justify-content: end;
    flex-wrap: wrap;
    gap: var(--space-2);
    margin-inline-start: auto;
  }
</style>
