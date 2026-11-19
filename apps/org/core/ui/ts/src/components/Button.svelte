<script lang="ts">
  import type { Component, Snippet } from 'svelte'
  import { cell } from '../attachments/cell.ts'
  import Icon from './Icon.svelte'

  let {
    tone = 'quiet',
    type = 'button',
    href,
    download,
    title,
    kbd,
    busy = false,
    disabled = false,
    onclick,
    icon = false,
    lead,
    form,
    'aria-label': ariaLabel,
    children,
  }: {
    // The form it submits where it is drawn outside it, by the form's id.
    form?: string
    // Its icon alone, small and square, with no fill until hovered, as a
    // comment's Reply; it is named by `aria-label` and `title`.
    icon?: boolean
    // An icon before its words, saying what it does, as a stance's check.
    lead?: Component<any>
    tone?: 'primary' | 'quiet' | 'danger' | 'subtle' | 'info' | 'positive'
    type?: 'button' | 'submit'
    href?: string
    // A link that saves what it points to under this name, as an export.
    download?: string
    title?: string
    kbd?: string
    // Its action is under way: it keeps focus but reads as unavailable.
    busy?: boolean
    // Nothing to do yet, as a form with nothing changed.
    disabled?: boolean
    onclick?: (e: MouseEvent) => void
    // An icon-only button's name, where its words say nothing of it.
    'aria-label'?: string
    children: Snippet
  } = $props()

  // A filled tone is always a cell, a quiet one only beside a filled one
  // or in a group its parent marks (`data-run`, `attachments/cell.ts`);
  // an icon alone is never one.
  const shape = $derived(icon ? undefined : tone === 'primary' || tone === 'info' || tone === 'danger' || tone === 'positive' ? 'fill' : 'plain')
  const id = $props.id()
</script>

<!-- Its cell, which `attachments/cell.ts` draws: one outline, its fill,
     and its edge clipped to it, so the edge stands inside the cell. -->
{#snippet drawn()}
  <svg aria-hidden="true"><g><clipPath id="{id}-cell"><path /></clipPath><path class="fill" /><path class="edge" clip-path="url(#{id}-cell)" /></g></svg>
{/snippet}

{#if href}
  <a class="button {tone}" class:icon {href} {download} {title} {onclick} aria-label={ariaLabel} data-cell={shape} {@attach cell}>{#if shape}{@render drawn()}{/if}{#if lead}<Icon icon={lead} size="1em" />{/if}{@render children()}{#if kbd}<kbd>{kbd}</kbd>{/if}</a>
{:else}
  <button class="button {tone}" class:icon {type} {form} {title} {onclick} {disabled} aria-busy={busy} aria-disabled={busy} aria-label={ariaLabel} data-cell={shape} {@attach cell}>
    {#if shape}{@render drawn()}{/if}{#if lead}<Icon icon={lead} size="1em" />{/if}{@render children()}{#if kbd}<kbd>{kbd}</kbd>{/if}
  </button>
{/if}

<style>
  /* A caller paints a button by its tone, or by setting `--fill`, and
     outlines it by `--edge`, never by its background or border: drawn
     as a cell, its box paints neither, and its path both. */
  .button {
    display: inline-flex;
    align-items: center;
    gap: var(--space-2);
    height: 2rem;
    padding: 0 var(--space-3);
    border: 1px solid var(--edge, transparent);
    border-radius: var(--radius-control);
    background: var(--fill);
    font-size: var(--text-sm);
    font-weight: 500;
    cursor: pointer;
    white-space: nowrap;
    transition: background var(--fast) var(--ease);
  }
  /* A filled button's pointed ends bulge into its padding, so it keeps
     more of it, drawn or not yet: drawing never moves its words. */
  .button[data-cell='fill'] {
    padding-inline: var(--space-4);
  }
  /* Drawn, its fill is its cell's. The svg is its first item, a pixel
     wide, its end margin taking back the room it and the gap after it
     hold, so it moves nothing and its words follow it in the flow and
     paint over it, with no layer of its own; its cell runs back from it
     over the whole button, and past it where a shared edge leans into
     the gap. It takes no pointer, so the button's whole box is what a
     click hits. As the first item it sets the button's baseline, its
     foot, so it stands as tall as an icon does, and a button set in a
     line of text sits where one led by an icon always sat. */
  svg {
    flex: none;
    width: 1px;
    height: 1rem;
    margin-inline-end: calc(-1px - var(--space-2));
    overflow: visible;
    pointer-events: none;
  }
  .button:global([data-drawn]) {
    background: none;
    border-color: transparent;
  }
  .fill {
    fill: var(--fill);
    stroke: transparent;
    stroke-width: 4px;
    stroke-linejoin: round;
    /* the focus ring is the stroke's outer half, painted under the fill,
       so it stands 2px outside the cell as the box-shadow ring stands
       outside a plain button */
    paint-order: stroke;
    transition: fill var(--fast) var(--ease);
  }
  /* The edge is the inner half of a stroke clipped to the cell, so it
     stands 1px inside it as a plain button's border stands inside its
     box: an outlined cell keeps the footprint of a filled one. */
  .edge {
    fill: none;
    stroke: var(--edge, transparent);
    stroke-width: 2px;
    stroke-linejoin: round;
  }
  .button:global([data-drawn]):focus-visible {
    box-shadow: none;
  }
  .button:global([data-drawn]):focus-visible .fill {
    stroke: var(--accent-border);
  }
  /* Forced colours repaint the words but not an svg's fill, so the cell
     gives way to the plain box the system draws, its border shown. */
  @media (forced-colors: active) {
    .button:global([data-drawn]) {
      background: var(--fill);
    }
    svg {
      display: none;
    }
    /* The svg carrying the focus stroke is hidden here, and the drawn
       button's rule above cleared its box-shadow ring: a system-colour
       outline stands in for both. */
    .button:global([data-drawn]):focus-visible {
      outline: 2px solid Highlight;
    }
  }
  .button.icon {
    justify-content: center;
    width: 1.75rem;
    height: 1.75rem;
    padding: 0;
    --fill: none;
    color: var(--text-muted);
    font-size: var(--text-md);
  }
  .button.icon:hover {
    --fill: var(--hover);
    color: var(--text);
  }
  .button:disabled {
    opacity: 0.5;
    cursor: default;
  }
  .button[aria-busy='true'] {
    opacity: 0.6;
    cursor: progress;
  }
  .quiet {
    --fill: var(--sunk);
    color: var(--text);
  }
  .quiet:hover {
    --fill: var(--hover);
  }
  /* A secondary way somewhere, as the sidebar's More…: no fill and
     text-subtle, the dimmest that still clears AA, until hovered, so it
     never competes with what it follows. */
  .subtle {
    --fill: none;
    color: var(--text-subtle);
  }
  .subtle:hover {
    --fill: var(--hover);
    color: var(--text);
  }
  /* The one primary action, the site's own ink
     (`styles/base.css`'s `--primary-fill`, the ink specimen's lead). */
  .primary {
    --fill: var(--primary-fill);
    color: var(--primary-text);
  }
  .primary:hover {
    filter: brightness(0.94);
  }
  .danger {
    --fill: var(--negative-soft);
    color: var(--negative-text);
  }
  .danger:hover {
    filter: brightness(0.96);
  }
  /* An affirmative choice, as a vote's Consent: filled as a refusal is,
     in the positive ink. */
  .positive {
    --fill: var(--positive-soft);
    color: var(--positive-text);
  }
  .positive:hover {
    filter: brightness(0.96);
  }
  /* A step forward that is not the page's one primary action, as the
     sign-in's Sign in beside its quiet ways out. */
  .info {
    --fill: var(--info-soft);
    color: var(--info-text);
  }
  .info:hover {
    filter: brightness(0.96);
  }
  kbd {
    font-family: var(--font-ui);
    font-size: var(--text-2xs);
    opacity: 0.7;
    padding: 0 0.3em;
    border-radius: 4px;
    background: oklch(0.5 0 0 / 12%);
  }
</style>
