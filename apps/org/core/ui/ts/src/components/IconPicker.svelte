<script lang="ts">
  import { untrack } from 'svelte'
  import MagnifyingGlass from 'phosphor-svelte/lib/MagnifyingGlass'
  import CaretUpDown from 'phosphor-svelte/lib/CaretUpDown'
  import { recordIcon, recordIcons } from '../record-icons.ts'
  import { inked, inkOf } from '../models/ink.ts'
  import { usePicker } from '../hooks/usePicker.ts'
  import { useForm } from '../hooks/useForm.ts'
  import Icon from './Icon.svelte'
  import Popover from './Popover.svelte'

  // A record's own icon, picked from the curated set
  // (`record-icons.ts`) in a searchable grid, in the app's own Popover: a
  // "None" choice clears it, drawing the collection's icon instead, as
  // elsewhere. Posts as a plain field of the name `name`, empty for none,
  // read into `null` by the slice's form.
  let {
    value,
    name,
    label,
    title,
  }: {
    // Its initial value, from the record read; the picker holds the
    // choice from there, so a page needs no state of its own.
    value: string | null
    name: string
    label: string
    // The record's own words, to seed the ink its mark wears: its title,
    // the same ink wherever else it is shown.
    title: string
  } = $props()

  // Read once: the picker holds the choice from here on, so a later
  // change of the prop (the page's data, reread) does not reach back in.
  const form = useForm()
  const posted = $derived(form.name(name))
  const picker = usePicker(untrack(() => value))
  const chosen = $derived(recordIcon(picker.chosen))
  const ink = $derived(inkOf(title))
  const shown = $derived(
    picker.query.trim()
      ? recordIcons.filter((r) => r.name.toLowerCase().includes(picker.query.trim().toLowerCase()))
      : recordIcons,
  )

  function pick(e: MouseEvent, slug: string | null) {
    picker.pick(slug)
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

<input type="hidden" name={posted} value={picker.chosen ?? ''} />
<Popover label={label} wide>
  {#snippet trigger()}
    <span class="swatch" class:inked={!!chosen} style={chosen ? inked(ink) : undefined}>
      {#if chosen}<Icon icon={chosen} />{:else}<Icon icon={CaretUpDown} />{/if}
    </span>
    <span>{label}</span>
  {/snippet}
  <label class="search">
    <Icon icon={MagnifyingGlass} />
    <input type="text" placeholder="Search icons" bind:value={picker.query} onkeydown={kept} aria-label="Search icons" />
  </label>
  <div class="grid">
    <button type="button" class="cell none" role="menuitemradio" aria-checked={picker.chosen === null} title="None" aria-label="None" onclick={(e) => pick(e, null)}>
      None
    </button>
    {#each shown as r (r.slug)}
      <button type="button" class="cell" role="menuitemradio" aria-checked={picker.chosen === r.slug} title={r.name} aria-label={r.name} onclick={(e) => pick(e, r.slug)}>
        <Icon icon={r.icon} size="1.2em" />
      </button>
    {/each}
    {#if shown.length === 0}
      <p class="empty">No icon named “{picker.query}”.</p>
    {/if}
  </div>
</Popover>

<style>
  .swatch {
    display: inline-flex;
    flex: none;
    color: var(--text-muted);
  }
  .swatch.inked {
    color: var(--mark);
  }
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
