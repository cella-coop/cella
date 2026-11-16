<script lang="ts">
  // A quiet line in a block: a state, a reason nothing is offered.
  // `subtle` and `end` dim it further and set it at its corner, as a
  // save indicator stands by what it saves rather than over it.
  let { text, subtle = false, end = false }: { text: string; subtle?: boolean; end?: boolean } = $props()
</script>

<p class="note" class:subtle class:end>{text}</p>

<style>
  .note {
    font-size: var(--text-sm);
    color: var(--text-muted);
    padding-inline: var(--space-3);
  }
  .subtle {
    font-size: var(--text-xs);
    color: var(--text-subtle);
  }
  .end {
    text-align: right;
  }
</style>
