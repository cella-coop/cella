<script lang="ts">
  import type { Column } from '../models/view.ts'
  import Tile from './Tile.svelte'

  // The one gallery: a responsive grid of the items as cards, each with
  // its title and the fields the view chose.
  let {
    rows,
    titled,
    shown,
    href,
  }: {
    rows: any[]
    titled: Column
    shown: Column[]
    href?: (row: any) => string | undefined
  } = $props()
</script>

<ul class="gallery">
  {#each rows as row (row.id)}
    <li><Tile {row} {titled} {shown} href={href?.(row)} /></li>
  {/each}
</ul>

<style>
  .gallery {
    list-style: none;
    margin: 0;
    padding: 0;
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(15rem, 1fr));
    gap: var(--space-3);
  }
  li {
    display: grid;
  }
</style>
