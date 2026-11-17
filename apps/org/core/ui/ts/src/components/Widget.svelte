<script lang="ts">
  import type { Component, Snippet } from 'svelte'
  import Icon from './Icon.svelte'

  // What a slice shows inside a record's body that is not a block: one
  // inline panel, as a figure or a chart sits among text, a faint fill
  // and a hairline, a muted header with an icon and a name, and `aside`
  // at the header's end for a state. It may be interactive, and is
  // always distinguished as a widget. Its width is the body's column, and
  // what it holds sits flush to its padding (`--inset` is nil inside).
  let { name, icon, aside, children }: { name: string; icon?: Component<any>; aside?: Snippet; children: Snippet } = $props()
</script>

<aside class="widget" data-widget={name.toLowerCase()} aria-label={name}>
  <header class="head">
    <span class="name">
      {#if icon}<Icon {icon} size="1em" />{/if}
      {name}
    </span>
    {#if aside}<span class="aside">{@render aside()}</span>{/if}
  </header>
  <div class="body">{@render children()}</div>
</aside>

<style>
  .widget {
    --inset: 0;
    max-width: calc(44rem - 2 * var(--space-3));
    margin-inline: var(--space-3);
    border: 1px solid var(--line);
    border-radius: var(--radius-panel);
    background: var(--raised);
    padding: var(--space-3) var(--space-4);
    display: grid;
    gap: var(--space-3);
    min-width: 0;
  }
  .head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    flex-wrap: wrap;
    gap: var(--space-2);
  }
  .name {
    display: inline-flex;
    align-items: center;
    gap: var(--space-1);
    font-size: var(--text-xs);
    font-weight: 600;
    color: var(--text-subtle);
  }
  .aside {
    display: inline-flex;
    align-items: center;
    flex-wrap: wrap;
    gap: var(--space-2);
    font-size: var(--text-xs);
    color: var(--text-muted);
  }
  .body {
    display: grid;
    gap: var(--space-3);
    min-width: 0;
  }
</style>
