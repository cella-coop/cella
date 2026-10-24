<script lang="ts">
  let { text }: { text: string } = $props()
</script>

<div class="prose">{text}</div>

<style>
  .prose {
    font-family: var(--font-display);
    font-size: var(--text-lg);
    line-height: 1.6;
    white-space: pre-wrap;
    max-width: 44rem;
    padding-inline: var(--space-3);
  }
</style>
