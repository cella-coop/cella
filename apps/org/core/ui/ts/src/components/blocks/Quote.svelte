<script lang="ts">
  import type { Snippet } from 'svelte'
  import type { HTMLAttributes } from 'svelte/elements'

  // A quote: `Blocks`' `.quote` sets its rule and its italic; `children`
  // is its text.
  let { children, ...rest }: HTMLAttributes<HTMLQuoteElement> & { children: Snippet } = $props()
</script>

<blockquote class="quote" {...rest}>{@render children()}</blockquote>
