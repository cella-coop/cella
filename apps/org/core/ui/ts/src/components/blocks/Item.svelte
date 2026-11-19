<script lang="ts">
  import type { Snippet } from 'svelte'
  import type { HTMLAttributes } from 'svelte/elements'

  // One row of a `List`: its marker, a bullet, nested one deeper under
  // the last (`depth`), or a number counted among its siblings
  // (`numbered`, `number`), then its text (`children`).
  let {
    numbered = false,
    number,
    depth = 0,
    children,
    ...rest
  }: HTMLAttributes<HTMLLIElement> & { numbered?: boolean; number?: number; depth?: number; children: Snippet } = $props()

  const bullets = ['•', '◦', '▪']
</script>

<li class="item" {...rest}>
  {#if numbered}
    <span class="marker" data-numbered aria-hidden="true">{number}.</span>
  {:else}
    <span class="marker" aria-hidden="true">{bullets[depth % bullets.length]}</span>
  {/if}
  {@render children()}
</li>
