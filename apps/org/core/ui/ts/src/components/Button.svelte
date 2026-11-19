<script lang="ts">
  import type { Component, Snippet } from 'svelte'
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

  // A filled tone is always a cell; a quiet one is one in a run its
  // parent marks (`data-run`) that holds a filled one, or in a group
  // (`data-run="group"`); an icon alone never is. Its style draws it.
  const shape = $derived(icon ? undefined : tone === 'primary' || tone === 'info' || tone === 'danger' || tone === 'positive' ? 'fill' : 'plain')
</script>

{#if href}
  <a class="button {tone}" class:icon {href} {download} {title} {onclick} aria-label={ariaLabel} data-cell={shape}>{#if lead}<Icon icon={lead} size="1em" />{/if}{@render children()}{#if kbd}<kbd>{kbd}</kbd>{/if}</a>
{:else}
  <button class="button {tone}" class:icon {type} {form} {title} {onclick} {disabled} aria-busy={busy} aria-disabled={busy} aria-label={ariaLabel} data-cell={shape}>
    {#if lead}<Icon icon={lead} size="1em" />{/if}{@render children()}{#if kbd}<kbd>{kbd}</kbd>{/if}
  </button>
{/if}

<style>
  /* A caller paints a button by its tone, or by setting `--fill`, and
     outlines it by `--edge`, never by its background or border: drawn
     as a cell, its box paints neither. It sizes it by `--h`, its height,
     which a cell's ends are drawn at. */
  .button {
    --h: 2rem;
    display: inline-flex;
    align-items: center;
    gap: var(--space-2);
    height: var(--h);
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

  /* A cell: a row of actions drawn as the brand's (`@cella/brand`'s
     `actions.ts`), every end of it a mask the brand writes
     (its tokens.css), so the page the server sends is drawn as it stays,
     with no script. A run is the buttons a parent marks (`data-run`),
     each its child or a form that is its one button (`data-through`),
     standing a cell's gap apart: the first's start and the last's end
     are pointed, and each pair shares a slanted edge, leaning forward
     then back from the run's start, as the site's do. A filled button
     out of every run is a lone cell, pointed at both ends.

     Its fill and its edge are drawn behind its words, by its two
     pseudo-elements reaching past its box (`--cell-reach`) for a shared
     edge leaning into the gap and the focus ring round it: each a mask
     of its start, its flat middle and its end. Forced colours repaint
     the words but not a mask's fill, so there the cell gives way to the
     plain box the system draws, its border shown. */
  :global {
    [data-run] {
      column-gap: var(--space-2);
    }
    [data-run] > :nth-child(odd of .button[data-cell], [data-through]) {
      --run-start-fill: var(--cell-start-back-fill);
      --run-start-edge: var(--cell-start-back-edge);
      --run-start-ring: var(--cell-start-back-ring);
      --run-end-fill: var(--cell-end-fore-fill);
      --run-end-edge: var(--cell-end-fore-edge);
      --run-end-ring: var(--cell-end-fore-ring);
    }
    [data-run] > :nth-child(even of .button[data-cell], [data-through]) {
      --run-start-fill: var(--cell-start-fore-fill);
      --run-start-edge: var(--cell-start-fore-edge);
      --run-start-ring: var(--cell-start-fore-ring);
      --run-end-fill: var(--cell-end-back-fill);
      --run-end-edge: var(--cell-end-back-edge);
      --run-end-ring: var(--cell-end-back-ring);
    }
    [data-run] > :nth-child(1 of .button[data-cell], [data-through]) {
      --run-start-fill: var(--cell-start-point-fill);
      --run-start-edge: var(--cell-start-point-edge);
      --run-start-ring: var(--cell-start-point-ring);
    }
    [data-run] > :nth-last-child(1 of .button[data-cell], [data-through]) {
      --run-end-fill: var(--cell-end-point-fill);
      --run-end-edge: var(--cell-end-point-edge);
      --run-end-ring: var(--cell-end-point-ring);
    }
    /* what a run's item sets reaches no button inside it but its own */
    .button:not([data-run] > *, [data-run] > [data-through] > *) {
      --run-start-fill: initial;
      --run-start-edge: initial;
      --run-start-ring: initial;
      --run-end-fill: initial;
      --run-end-edge: initial;
      --run-end-ring: initial;
    }

    @media (forced-colors: none) {
      .button[data-cell='fill'],
      :is([data-run='group'], [data-run]:has(> .button[data-cell='fill'], > [data-through] > .button[data-cell='fill'])) > .button[data-cell],
      :is([data-run='group'], [data-run]:has(> .button[data-cell='fill'], > [data-through] > .button[data-cell='fill'])) > [data-through] > .button[data-cell] {
        /* the reach past its box, the ring's above and below it, and
           how far each end's mask runs in from its pseudo-element's side */
        --reach: calc(var(--h) * var(--cell-reach));
        --ring: calc(var(--h) * var(--cell-ring));
        --ends: calc(2 * var(--h) * (var(--cell-reach) + var(--cell-end)) - 2px);
        position: relative;
        isolation: isolate;
        padding-inline: var(--space-4);
        background: none;
        border-color: transparent;

        &::before,
        &::after {
          content: '';
          position: absolute;
          /* from its padding box, so a border's pixel further */
          inset: calc(-1px - var(--ring)) calc(-1px - var(--reach));
          z-index: -1;
          pointer-events: none;
        }
        &::before {
          background: var(--fill);
          transition: background-color var(--fast) var(--ease);
          mask:
            var(--run-start-fill, var(--cell-start-point-fill)) left / auto 100% no-repeat,
            linear-gradient(#000 0 0) center / calc(100% - var(--ends)) calc(100% - 2 * var(--ring)) no-repeat,
            var(--run-end-fill, var(--cell-end-point-fill)) right / auto 100% no-repeat;
        }
        /* The edge stands a pixel inside the cell, as a plain button's
           border stands inside its box. */
        &::after {
          background: var(--edge, transparent);
          mask:
            var(--run-start-edge, var(--cell-start-point-edge)) left / auto 100% no-repeat,
            linear-gradient(#000 0 0) 50% var(--ring) / calc(100% - var(--ends)) 1px no-repeat,
            linear-gradient(#000 0 0) 50% calc(100% - var(--ring)) / calc(100% - var(--ends)) 1px no-repeat,
            var(--run-end-edge, var(--cell-end-point-edge)) right / auto 100% no-repeat;
        }
        /* Focused, the edge gives way to the ring, astride the outline
           and under the fill, so it stands outside the cell as the ring
           stands outside a plain button. */
        &:focus-visible {
          box-shadow: none;
        }
        &:focus-visible::after {
          z-index: -2;
          background: var(--accent-border);
          mask:
            var(--run-start-ring, var(--cell-start-point-ring)) left / auto 100% no-repeat,
            linear-gradient(#000 0 0) 50% 0 / calc(100% - var(--ends)) calc(2 * var(--ring)) no-repeat,
            linear-gradient(#000 0 0) 50% 100% / calc(100% - var(--ends)) calc(2 * var(--ring)) no-repeat,
            var(--run-end-ring, var(--cell-end-point-ring)) right / auto 100% no-repeat;
        }
        /* right to left, the run starts at the right: its cells mirrored */
        &:dir(rtl)::before,
        &:dir(rtl)::after {
          scale: -1 1;
        }
      }
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
  /* An affirmative choice, as a vote's Consent or an expense's Approve:
     filled as a refusal is, in the positive ink. */
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
