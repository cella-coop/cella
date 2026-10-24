<script lang="ts">
  import type { Component, Snippet } from 'svelte'
  import type { HTMLAnchorAttributes } from 'svelte/elements'
  import Icon from './Icon.svelte'

  // The one tab pill, a page's tabs and a collection's views alike: quiet
  // with a hairline, tinted on hover, filled when it is the open one.
  let {
    href,
    on = false,
    icon,
    children,
    ...rest
  }: { href: string; on?: boolean; icon?: Component<any>; children: Snippet } & Omit<HTMLAnchorAttributes, 'href'> = $props()
</script>

<a {href} class="pill" class:on aria-current={on ? 'page' : undefined} {...rest}>
  {#if icon}<Icon {icon} />{/if}{@render children()}
</a>

<style>
  .pill {
    display: flex;
    align-items: center;
    gap: var(--space-1);
    height: 1.6rem;
    padding: 0 var(--space-2);
    border: 1px solid var(--line);
    border-radius: var(--radius-pill);
    font-size: var(--text-sm);
    color: var(--text-muted);
    white-space: nowrap;
  }
  .pill:hover {
    background: var(--hover);
    color: var(--text);
  }
  .on {
    background: var(--sunk);
    border-color: transparent;
    color: var(--text);
    font-weight: 500;
  }
</style>
