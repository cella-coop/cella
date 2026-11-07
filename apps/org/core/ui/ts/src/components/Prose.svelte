<script lang="ts">
  let { text }: { text: string } = $props()
</script>

<div class="prose">{text}</div>

<style>
  /* Written content, in the text face, as a document's blocks are. */
  .prose {
    font-family: var(--font-ui);
    font-size: var(--text-lg);
    line-height: 1.6;
    white-space: pre-wrap;
    max-width: 44rem;
    padding-inline: var(--space-3);
  }
</style>
