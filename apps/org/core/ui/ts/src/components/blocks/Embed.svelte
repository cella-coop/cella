<script lang="ts">
  import type { Snippet } from 'svelte'
  import type { HTMLAttributes } from 'svelte/elements'

  // An embed: atomic, its content wholly the caller's, a thing of
  // another slice drawn as its card (`Blocks`' `.card`), its picker
  // while it names no record yet, or `.unknown` where nothing draws it.
  // This component only wraps it in the surface `Blocks` styles.
  let { children, ...rest }: HTMLAttributes<HTMLDivElement> & { children: Snippet } = $props()
</script>

<div class="embed" {...rest}>{@render children()}</div>
