<script lang="ts">
  // A quiet line in a block: a state, a reason nothing is offered.
  // `subtle` and `end` dim it further and set it at its corner, as a
  // save indicator stands by what it saves rather than over it. `quiet` is
  // an empty state: italic, small and the dimmest shade, as "No comments yet".
  let { text, subtle = false, end = false, quiet = false }: { text: string; subtle?: boolean; end?: boolean; quiet?: boolean } = $props()
</script>

<p class="note" class:subtle class:end class:quiet>{text}</p>

<style>
  .note {
    min-height: 1.5em;
    font-size: var(--text-sm);
    color: var(--text-muted);
    padding-inline: var(--inset, var(--space-3));
  }
  .subtle {
    font-size: var(--text-xs);
    color: var(--text-subtle);
  }
  .quiet {
    font-size: var(--text-xs);
    font-style: italic;
    color: var(--text-subtle);
  }
  .end {
    text-align: right;
  }
</style>
