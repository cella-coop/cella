<script lang="ts">
  import type { Column } from '../models/view.ts'
  import { opens, under, type Grouping } from '../models/query.ts'
  import Group from './Group.svelte'
  import Tile from './Tile.svelte'

  // The one gallery: a responsive grid of the items as cards, each with
  // its title and the fields the view chose; where the items are grouped
  // (`group`), a header over each group's cards, across the grid, with
  // its value and how many items it holds, `counts`, by value.
  let {
    rows,
    titled,
    shown,
    href,
    group,
  }: {
    rows: any[]
    titled: Column
    shown: Column[]
    href?: (row: any) => string | undefined
    group?: Grouping
  } = $props()
</script>

<ul class="gallery">
  {#each rows as row, i (row.id)}
    {const value = $derived(group ? under(row, group.by.key, group.month) : '')}
    {#if group && opens(rows, i, group.by.key, group.month)}
      <li class="group">
        <Group
          by={group.by}
          {row}
          {value}
          month={group.month}
          count={group.counts[value] ?? 0}
          collapsed={group.collapsed.has(value)}
          oncollapse={() => group.oncollapse(value)}
          oncreate={group.oncreate}
        />
      </li>
    {/if}
    {#if !group || !group.collapsed.has(value)}
      <li><Tile {row} {titled} {shown} href={href?.(row)} /></li>
    {/if}
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
  /* A group's header runs across the grid, above its cards. */
  .group {
    grid-column: 1 / -1;
    padding: var(--space-2) var(--space-2) 0;
  }
</style>
