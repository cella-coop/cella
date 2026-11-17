<script lang="ts">
  import MagnifyingGlass from 'phosphor-svelte/lib/MagnifyingGlass'
  import { useQuery } from '../hooks/useQuery.ts'
  import { recordIcons } from '../record-icons.ts'
  import Icon from './Icon.svelte'

  // The curated icons (`record-icons.ts`) in a searchable grid, a "None"
  // choice clearing it, drawing the collection's icon instead: the body of
  // an icon picker's popover and of a record's icon property. A choice
  // closes the popover it sits in.
  let { value, onpick }: { value: string | null; onpick: (slug: string | null) => void } = $props()

  const q = useQuery()
  const shown = $derived(q.text.trim() ? recordIcons.filter((r) => r.name.toLowerCase().includes(q.text.trim().toLowerCase())) : recordIcons)

  function pick(e: MouseEvent, slug: string | null) {
    onpick(slug)
    ;(e.currentTarget as HTMLElement).closest<HTMLElement>('[popover]')?.hidePopover()
  }

  // Arrow keys and Home/End rove the grid's buttons (Popover's own); the
  // search box keeps them for the caret and the cursor instead.
  function kept(e: KeyboardEvent) {
    if (['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(e.key)) {
      e.stopPropagation()
    }
  }
</script>

<label class="search">
  <Icon icon={MagnifyingGlass} />
  <input type="text" placeholder="Search icons" bind:value={q.text} onkeydown={kept} aria-label="Search icons" />
</label>
<div class="grid">
  <button type="button" class="cell none" role="menuitemradio" aria-checked={value === null} title="None" aria-label="None" onclick={(e) => pick(e, null)}>
    None
  </button>
  {#each shown as r (r.slug)}
    <button type="button" class="cell" role="menuitemradio" aria-checked={value === r.slug} title={r.name} aria-label={r.name} onclick={(e) => pick(e, r.slug)}>
      <Icon icon={r.icon} size="1.2em" />
    </button>
  {/each}
  {#if shown.length === 0}
    <p class="empty">No icon named “{q.text}”.</p>
  {/if}
</div>

<style>
  .search {
    display: flex;
    align-items: center;
    gap: var(--space-2);
    padding: var(--space-1) var(--space-2);
    border: 1px solid var(--line);
    border-radius: var(--radius-control);
    color: var(--text-muted);
  }
  .search input {
    flex: 1;
    border: none;
    background: none;
    color: var(--text);
    font: inherit;
    min-width: 0;
  }
  .grid {
    display: grid;
    grid-template-columns: repeat(6, 1fr);
    gap: var(--space-1);
    max-height: 14rem;
    overflow-y: auto;
  }
  .cell {
    display: grid;
    place-items: center;
    aspect-ratio: 1;
    border: none;
    border-radius: var(--radius-control);
    background: none;
    color: var(--text);
    cursor: pointer;
  }
  .cell:hover {
    background: var(--hover);
  }
  .cell[aria-checked='true'] {
    background: var(--accent-soft);
    color: var(--accent-text);
  }
  .none {
    grid-column: 1 / -1;
    aspect-ratio: auto;
    font-size: var(--text-sm);
  }
  .empty {
    grid-column: 1 / -1;
    margin: 0;
    padding: var(--space-2);
    font-size: var(--text-sm);
    color: var(--text-muted);
    text-align: center;
  }
</style>
