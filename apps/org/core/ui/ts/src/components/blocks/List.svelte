<script lang="ts">
  import type { Snippet } from 'svelte'
  import type { HTMLAttributes } from 'svelte/elements'

  // A run of `Item`s of one kind, bulleted or numbered: the native list
  // its items sit in, so assistive technology counts them, each item
  // drawing its own marker since `Blocks` draws no browser bullet or
  // number of its own.
  let {
    kind,
    children,
    ...rest
  }: HTMLAttributes<HTMLElement> & { kind: 'bullet' | 'numbered'; children: Snippet } = $props()
</script>

<svelte:element this={kind === 'numbered' ? 'ol' : 'ul'} class="list" {...rest}>{@render children()}</svelte:element>
