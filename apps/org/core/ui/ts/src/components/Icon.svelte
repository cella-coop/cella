<script lang="ts">
  import type { Component } from 'svelte'

  let { icon, size = '1.1em' }: { icon: Component<any>; size?: string } = $props()
  const Glyph = $derived(icon)
</script>

<Glyph {size} weight="duotone" aria-hidden="true" />
