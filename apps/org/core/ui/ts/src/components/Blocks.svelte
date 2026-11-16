<script lang="ts">
  import type { Snippet } from 'svelte'
  import type { HTMLAttributes } from 'svelte/elements'

  // A document of blocks, as the block editor and its read-only reader
  // draw it: the surface and the look of every kind of block, which the
  // document feat's components name by class and data attribute and never
  // style themselves. Its attributes, handlers and attachments pass
  // through to the surface. Every kind is set in the body face, Inter
  // (`--font-ui`), headings and embeds' titles too.
  //
  // - `.block` holds a block: its `.line` (the grip and the `.body`) and
  //   its `.children`, indented one step; the grip is the UI core's
//   `DragHandle`, shown on hover; `[data-selected]` on the block
  //   marks it chosen whole, `[data-drop]` on a line where a drag lands.
  // - a body is `.text` (an editable or a reader's text) inside a kind:
  //   `.heading[data-level]`, `.item` with its `.marker` (bullets,
  //   numbers, to-dos), `.quote`, `.code` with its `.language`,
  //   `.divider`, `.embed`; `[data-done]` strikes a to-do through.
  // - `.card` is an embed's card, `.unknown` an embed nothing draws.
  let { children, readonly = false, ...rest }: HTMLAttributes<HTMLDivElement> & { children: Snippet; readonly?: boolean } = $props()
</script>

<div class="blocks" data-readonly={readonly || undefined} {...rest}>
  {@render children()}
</div>

<style>
  /* A document is the co-op's writing, not the app's: set whole, headings
     too, in the text face; the display face stays the shell's. */
  .blocks {
    padding: var(--space-2) var(--space-2) var(--space-5) var(--space-5);
    font-family: var(--font-ui);
    font-size: var(--text-lg);
    line-height: 1.55;
    max-width: 46rem;
    color: var(--text);
  }
  .blocks[data-readonly] {
    padding: var(--space-1) 0;
  }
  .blocks[data-chosen] {
    caret-color: transparent;
  }
  .blocks[data-chosen] :global(*::selection) {
    background: transparent;
  }
  .blocks :global(.children) {
    padding-left: 1.6rem;
  }
  .blocks :global(.line) {
    position: relative;
    display: flex;
    align-items: flex-start;
    margin: 1px 0;
    border-radius: var(--radius-control);
  }
  .blocks :global(.body) {
    flex: 1;
    min-width: 0;
    padding: 1px var(--space-1);
    border-radius: var(--radius-control);
  }
  .blocks :global([data-selected] > .line > .body),
  .blocks :global([data-selected] > .children) {
    background: var(--accent-soft);
  }
  .blocks :global(.line > .handle) {
    flex: none;
    margin-left: -1.4rem;
    margin-top: 0.15rem;
    cursor: grab;
    opacity: 0;
    transition: opacity var(--fast) var(--ease);
  }
  .blocks :global(.line:hover > .handle),
  .blocks :global(.line > .handle:focus-visible),
  .blocks :global([data-selected] > .line > .handle) {
    opacity: 1;
  }
  .blocks :global([data-dragging]) {
    opacity: 0.4;
  }
  .blocks :global(.line[data-drop])::after {
    content: '';
    position: absolute;
    left: 0;
    right: 0;
    height: 2px;
    border-radius: var(--radius-pill);
    background: var(--accent-border);
  }
  .blocks :global(.line[data-drop='before'])::after {
    top: -2px;
  }
  .blocks :global(.line[data-drop='after'])::after {
    bottom: -2px;
  }
  .blocks :global(.text) {
    white-space: pre-wrap;
    overflow-wrap: anywhere;
    min-height: 1.55em;
    padding: 2px 0;
    caret-color: var(--accent-border);
    /* A block's own ring would box each line as it is typed in,
       cramped beside the next; the caret stands out in its place,
       wide enough to read without it (progressive: plain where a
       browser does not draw a shaped caret yet). */
    caret-shape: block;
    flex: 1;
    min-width: 0;
  }
  .blocks :global(.text:focus-visible) {
    box-shadow: none;
  }
  /* An empty block says how a block is added where the caret is in it,
     and so does the last one, empty, wherever the caret is. */
  .blocks :global(.text[data-empty]:focus)::before,
  .blocks :global(.block[data-last] > .line .text[data-empty])::before {
    content: attr(data-placeholder);
    color: var(--text-subtle);
    position: absolute;
    pointer-events: none;
  }
  .blocks :global(.text strong) {
    font-weight: 700;
  }
  .blocks :global(.text code) {
    font-family: var(--font-mono);
    font-size: 0.8em;
    background: var(--sunk);
    border-radius: 4px;
    padding: 0.1em 0.25em;
    color: var(--negative-text);
  }
  .blocks :global(.text a) {
    color: var(--accent-text);
    text-decoration: underline;
    text-decoration-color: var(--accent-border);
    text-underline-offset: 2px;
  }
  .blocks :global(.text mark) {
    background: var(--warning-soft);
    color: inherit;
    border-radius: 2px;
  }
  .blocks :global(.heading) {
    display: flex;
    font-weight: 600;
    line-height: 1.25;
  }
  .blocks :global(.heading[data-level='1']) {
    font-size: var(--text-2xl);
    margin-top: var(--space-3);
  }
  .blocks :global(.heading[data-level='2']) {
    font-size: var(--text-xl);
    margin-top: var(--space-3);
  }
  .blocks :global(.heading[data-level='3']) {
    font-size: var(--text-lg);
    font-weight: 700;
    margin-top: var(--space-2);
  }
  .blocks :global(.item) {
    display: flex;
    gap: var(--space-2);
    align-items: flex-start;
  }
  .blocks :global(.marker) {
    min-width: 1.1em;
    text-align: center;
    color: var(--text-muted);
    padding-top: 2px;
    font-variant-numeric: tabular-nums;
  }
  .blocks :global(.marker[data-numbered]) {
    text-align: right;
  }
  .blocks :global(.item > .checkbox) {
    margin-top: 0.3em;
  }
  .blocks :global(.item[data-done] .text) {
    color: var(--text-subtle);
    text-decoration: line-through;
  }
  .blocks :global(.quote) {
    display: flex;
    padding-left: var(--space-3);
    border-left: 3px solid var(--text);
    font-style: italic;
  }
  .blocks :global(.code) {
    display: flex;
    flex-direction: column;
    gap: var(--space-1);
    padding: var(--space-3);
    border-radius: var(--radius-control);
    background: var(--sunk);
    font-family: var(--font-mono);
    font-size: var(--text-sm);
    line-height: 1.5;
  }
  .blocks :global(.language) {
    align-self: flex-start;
    border: none;
    background: transparent;
    color: var(--text-muted);
    font: inherit;
    font-size: var(--text-xs);
  }
  .blocks :global(.divider) {
    padding: var(--space-2) 0;
    cursor: default;
  }
  .blocks :global(.divider hr) {
    margin: 0;
    border: none;
    border-top: 1px solid var(--line);
  }
  .blocks :global(.embed) {
    user-select: none;
    cursor: default;
    font-family: var(--font-ui);
    font-size: var(--text-md);
  }
  .blocks :global(.card) {
    display: grid;
    gap: var(--space-1);
    padding: var(--space-3) var(--space-4);
    border-radius: var(--radius-panel);
    background: var(--raised);
    border: 1px solid var(--line);
  }
  .blocks :global(.card .kind) {
    font-size: var(--text-xs);
    color: var(--text-muted);
  }
  .blocks :global(.card .title) {
    font-size: var(--text-lg);
  }
  .blocks :global(.card .meta) {
    display: flex;
    flex-wrap: wrap;
    gap: var(--space-3);
    align-items: center;
    font-size: var(--text-sm);
    color: var(--text-muted);
  }
  .blocks :global(.unknown) {
    padding: var(--space-2) var(--space-3);
    border: 1px dashed var(--line);
    border-radius: var(--radius-panel);
    color: var(--text-muted);
    font-family: var(--font-mono);
    font-size: var(--text-sm);
  }
  .blocks :global(.menu) {
    display: grid;
    min-width: 14rem;
    max-height: 18rem;
    overflow: auto;
  }
</style>
