<script lang="ts">
  import type { Snippet } from 'svelte'

  // Quiet trailing facts, in a header or a footer or at a line's end: a
  // date, "due 19 Nov", "3 mandates". Several are one line, a middle dot
  // between them; an empty one draws nothing.
  let { text, children }: { text?: string | (string | null | undefined | false)[] | null; children?: Snippet } = $props()

  const said = $derived((Array.isArray(text) ? text : [text]).filter((t): t is string => !!t).join(' · '))
</script>

{#if children}
  <span class="meta">{@render children()}</span>
{:else if said}
  <span class="meta">{said}</span>
{/if}

<style>
  .meta {
    display: inline-flex;
    align-items: center;
    gap: var(--space-2);
    min-width: 0;
    font-size: var(--text-xs);
    color: var(--text-muted);
    font-variant-numeric: tabular-nums;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
</style>
