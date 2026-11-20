<script lang="ts">
  import type { HTMLAttributes } from 'svelte/elements'

  // A line in a block that says something: a state, a reason nothing is
  // offered. `subtle` and `end` dim it further and set it at its corner,
  // as a save indicator stands by what it saves rather than over it.
  // Where there is nothing to show, `Empty` says so instead. Its
  // attributes pass through, as a draft's own state a slice reads off
  // it would.
  let {
    text,
    subtle = false,
    end = false,
    ...rest
  }: { text: string; subtle?: boolean; end?: boolean } & HTMLAttributes<HTMLParagraphElement> = $props()
</script>

<p class="note" class:subtle class:end {...rest}>{text}</p>

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
  .end {
    text-align: right;
  }
</style>
