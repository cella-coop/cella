<script lang="ts">
  // A quiet line in a block: a state, a reason nothing is offered.
  let { text }: { text: string } = $props()
</script>

<p class="note">{text}</p>

<style>
  .note {
    font-size: var(--text-sm);
    color: var(--text-muted);
    padding-inline: var(--space-3);
  }
</style>
