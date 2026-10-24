<script lang="ts">
  import type { Run } from '../models/edits.ts'

  // A text's runs as markup, the marks nested as the editor paints them:
  // a link outermost, then bold, italic and code.
  let { runs }: { runs: Run[] } = $props()
</script>

{#snippet code(r: Run)}
  {#if r.marks?.code}<code>{r.text}</code>{:else}{r.text}{/if}
{/snippet}
{#snippet italic(r: Run)}
  {#if r.marks?.italic}<em>{@render code(r)}</em>{:else}{@render code(r)}{/if}
{/snippet}
{#snippet bold(r: Run)}
  {#if r.marks?.bold}<strong>{@render italic(r)}</strong>{:else}{@render italic(r)}{/if}
{/snippet}
{#each runs as r, i (i)}{#if typeof r.marks?.link === 'string'}<a href={r.marks.link} rel="noreferrer">{@render bold(r)}</a>{:else}{@render bold(r)}{/if}{/each}
