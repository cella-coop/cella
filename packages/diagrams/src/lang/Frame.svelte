<!--
  A diagram's frame and the language's one stylesheet (index.md, the
  language). Every mark is drawn in currentColor, so whatever the diagram
  stands on sets its ink: the text's on the paper, a band's light ink on
  a band. `--dg-ground` is that surface, which a glyph's ring and a
  label's halo are filled with; three tones, `--dg-grant`, `--dg-no` and
  `--dg-ask`, back a particle's kind with colour, and fall back to the ink.
-->
<script lang="ts">
  import type { Snippet } from 'svelte'

  let { width, height, children }: { width: number; height: number; children: Snippet } = $props()
</script>

<svg class="dg" viewBox="0 0 {width} {height}" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
  {@render children()}
</svg>

<style>
  .dg {
    --ground: var(--dg-ground, var(--panel));
    --grant: var(--dg-grant, currentColor);
    --no: var(--dg-no, currentColor);
    --ask: var(--dg-ask, currentColor);
    display: block;
    width: 100%;
    height: auto;
    overflow: visible;
    font-family: var(--font-text);
    fill: none;
    stroke-linecap: round;
    stroke-linejoin: round;
  }

  /* worldlines: who, with time running up */
  .dg :global(.line) {
    stroke: currentColor;
    stroke-width: 1.5;
  }

  .dg :global(.line.rails) {
    stroke-width: 1.25;
  }

  .dg :global(.line.vacant) {
    stroke-dasharray: 5 4;
    opacity: 0.7;
  }

  .dg :global(.tick) {
    stroke: currentColor;
    stroke-width: 1.5;
  }

  /* authority: a worldline's width is the scope of what it holds */
  .dg :global(.auth) {
    stroke: var(--grant);
    stroke-linecap: butt;
    opacity: 0.22;
  }

  /* particles: what travels between lines */
  .dg :global(.grant) {
    stroke: var(--grant);
    stroke-width: 1.7;
  }

  .dg :global(.revoke) {
    stroke: var(--no);
    stroke-width: 1.7;
    stroke-dasharray: 5 3;
  }

  .dg :global(.ask) {
    stroke: var(--ask);
    stroke-width: 1.4;
    stroke-dasharray: 4 3;
  }

  .dg :global(.answer),
  .dg :global(.record) {
    stroke: var(--ask);
    stroke-width: 1.4;
  }

  .dg :global(.record) {
    stroke: currentColor;
  }

  .dg :global(.object) {
    stroke: var(--ask);
    stroke-width: 1.4;
  }

  .dg :global(.cascade) {
    stroke: var(--no);
    stroke-width: 1.4;
    stroke-dasharray: 0.5 3.5;
  }

  .dg :global(.chain) {
    stroke: currentColor;
    stroke-width: 1.2;
    stroke-dasharray: 2 2.5;
  }

  /* a wait: the time a party takes to decide */
  .dg :global(.wait) {
    fill: currentColor;
    opacity: 0.2;
  }

  /* a box: a record, a store, a scope's own state */
  .dg :global(.box) {
    fill: var(--ground);
    stroke: currentColor;
    stroke-width: 1.3;
  }

  .dg :global(.box.pending) {
    stroke-dasharray: 4 3;
    opacity: 0.7;
  }

  .dg :global(.span) {
    fill: currentColor;
    opacity: 0.08;
  }

  /* vertices: where lines interact */
  .dg :global(.dot) {
    fill: currentColor;
  }

  .dg :global(.dot.open) {
    fill: var(--ground);
    stroke: currentColor;
    stroke-width: 1.4;
  }

  /* glyphs: what happens, a Phosphor icon in a ring */
  .dg :global(.glyph > circle) {
    fill: var(--ground);
    stroke: currentColor;
    stroke-width: 1.3;
  }

  .dg :global(.glyph.refused > circle) {
    stroke-dasharray: 3 2;
  }

  .dg :global(.tone-grant) {
    color: var(--grant);
  }

  .dg :global(.tone-no) {
    color: var(--no);
  }

  .dg :global(.tone-ask) {
    color: var(--ask);
  }

  .dg :global(.icon) {
    fill: currentColor;
    stroke: none;
  }

  /* step numbers */
  .dg :global(.num > circle) {
    fill: var(--ground);
    stroke: currentColor;
    stroke-width: 0.9;
  }

  .dg :global(.num > text) {
    font-family: var(--font-mono);
    font-size: 9.5px;
    font-weight: 500;
  }

  /* the time axis, a hairline */
  .dg :global(.axis) {
    stroke: currentColor;
    stroke-width: 1;
    opacity: 0.55;
  }

  /* labels: a line's name in the display face, a kind in small mono
     capitals, a particle's word in the text face, each haloed by the
     ground so it reads over lines */
  .dg :global(text) {
    fill: currentColor;
    stroke: var(--ground);
    stroke-width: 4px;
    paint-order: stroke;
  }

  .dg :global(.name) {
    font-family: var(--font-display);
    font-size: 13px;
    font-weight: 650;
    letter-spacing: -0.01em;
  }

  .dg :global(.kind) {
    font-family: var(--font-mono);
    font-size: 8.5px;
    letter-spacing: 0.1em;
    text-transform: uppercase;
    opacity: 0.72;
  }

  .dg :global(.say) {
    font-size: 11px;
    font-style: italic;
  }

  .dg :global(.code) {
    font-family: var(--font-mono);
    font-size: 9.5px;
  }

  .dg :global(.quiet) {
    opacity: 0.62;
  }
</style>
