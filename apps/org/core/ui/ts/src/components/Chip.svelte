<script lang="ts">
  import type { Component } from 'svelte'
  import { inked } from '../models/ink.ts'
  import { X } from '../icons.ts'
  import Avatar from './Avatar.svelte'
  import Icon from './Icon.svelte'

  // A record named compactly, wherever a view draws one: a list's line, a
  // table's cell, a card, a group's header, the drawer's Properties, an
  // option of a popover. One line, its collection's `icon` in the
  // record's own ink (`ink`) before its name, or a person's `avatar`,
  // the name ending in an ellipsis where its place runs out; a link where
  // it has an `href`. Its fill is one step from the surface it sits on
  // toward the text, whatever that surface is (`--surface`, which each
  // surface declares), so it reads on the panel, a raised card, a grey
  // bar, a hovered row or a floating list alike, in either theme, and
  // never shouts. One a list lets go of, as a view's displayed field,
  // ends in a small × that removes it (`remove`), named for what it does.
  let {
    label,
    icon,
    ink,
    avatar,
    href,
    title,
    weight = 'duotone',
    remove,
  }: {
    label: string
    icon?: Component<any>
    ink?: number
    avatar?: string
    href?: string
    title?: string
    weight?: 'regular' | 'duotone'
    remove?: { label: string; onclick: () => void }
  } = $props()
</script>

{#snippet inner()}
  {#if avatar}
    <!-- In rem: the avatar sizes its initials from its size, so an em would compound. -->
    <Avatar name={avatar} size="1.1rem" />
  {:else if icon}
    <span class="mark" class:inked={ink !== undefined} aria-hidden="true"><Icon {icon} size="1em" {weight} /></span>
  {/if}
  <span class="text">{label}</span>
  {#if remove}
    <button type="button" class="remove" aria-label={remove.label} title={remove.label} onclick={remove.onclick}><Icon icon={X} size="0.85em" weight="regular" /></button>
  {/if}
{/snippet}

{#if href}
  <a class="chip" class:lead={!!(avatar || icon)} {href} {title} style={ink !== undefined ? inked(ink) : undefined}>{@render inner()}</a>
{:else}
  <span class="chip" class:lead={!!(avatar || icon)} {title} style={ink !== undefined ? inked(ink) : undefined}>{@render inner()}</span>
{/if}

<style>
  .chip {
    display: inline-flex;
    align-items: center;
    gap: 0.3em;
    min-width: 0;
    max-width: 100%;
    padding: 0 0.5em;
    border-radius: var(--radius-control);
    background: color-mix(in oklab, var(--text) var(--lift), var(--surface));
    color: var(--text);
    line-height: 1.65;
    white-space: nowrap;
    vertical-align: middle;
    text-decoration: none;
  }
  /* What leads it sits closer to its edge than its name to the other. */
  .chip.lead {
    padding-inline-start: 0.3em;
  }
  a.chip:hover {
    background: color-mix(in oklab, var(--text) calc(var(--lift) * 2), var(--surface));
  }
  .mark {
    display: inline-flex;
    flex: none;
    color: var(--text-muted);
  }
  .mark.inked {
    color: var(--mark);
  }
  .text {
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  /* The ×, flush with the chip's end, its name read by its label. */
  .remove {
    display: inline-grid;
    place-items: center;
    flex: none;
    margin-inline: 0 -0.3em;
    padding: 0.1em;
    border: 0;
    border-radius: var(--radius-control);
    background: none;
    color: var(--text-muted);
    cursor: pointer;
  }
  .remove:hover {
    background: color-mix(in oklab, var(--text) calc(var(--lift) * 2), var(--surface));
    color: var(--text);
  }
</style>
