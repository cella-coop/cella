<script lang="ts">
  import type { Snippet } from 'svelte'
  import type { HTMLAttributes } from 'svelte/elements'

  // A block heading, 1 to 3: `Blocks`' `.heading[data-level]` sizes it,
  // the body's and a motion's and a document's alike; `children` is its
  // text. `aria-level` is one past the block's own level, since the
  // page's own title (`h1`) outranks it.
  let {
    level = 1,
    children,
    ...rest
  }: HTMLAttributes<HTMLDivElement> & { level?: 1 | 2 | 3; children: Snippet } = $props()
</script>

<div class="heading" data-level={level} role="heading" aria-level={level + 1} {...rest}>{@render children()}</div>
