<script lang="ts">
  import type { Component } from 'svelte'

  let { icon, size = '1.1em', weight = 'duotone' }: { icon: Component<any>; size?: string; weight?: 'regular' | 'fill' | 'duotone' } = $props()
  const Glyph = $derived(icon)
</script>

<Glyph {size} {weight} aria-hidden="true" />
