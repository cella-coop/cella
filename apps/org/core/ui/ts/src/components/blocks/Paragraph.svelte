<script lang="ts">
  import type { Snippet } from 'svelte'
  import type { HTMLAttributes } from 'svelte/elements'

  // A paragraph: plain text, nothing else to its shape. `children` is
  // its text, the editor's editable `Text` or the reader's plain run;
  // this component styles nothing beyond what `Blocks` already sets for
  // the body font. Its attributes and attachments pass through, as an
  // atomic block's id would.
  let { children, ...rest }: HTMLAttributes<HTMLDivElement> & { children: Snippet } = $props()
</script>

<div class="paragraph" {...rest}>{@render children()}</div>
