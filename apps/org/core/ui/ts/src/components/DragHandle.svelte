<script lang="ts">
  import DotsSixVertical from 'phosphor-svelte/lib/DotsSixVertical'
  import Icon from './Icon.svelte'

  // An item's drag handle in a sortable list: a quiet grip, labelled for
  // whoever cannot see it, which the pointer drags and the keyboard lifts.
  let { label }: { label: string } = $props()
</script>

<button type="button" class="handle" data-drag-handle aria-label="Reorder {label}" title="Drag to reorder, or Space and the arrow keys">
  <Icon icon={DotsSixVertical} />
</button>

<style>
  .handle {
    display: grid;
    place-items: center;
    width: 1.25rem;
    height: 1.6rem;
    padding: 0;
    border: none;
    border-radius: var(--radius-control);
    background: none;
    color: var(--text-subtle);
  }
  .handle:hover {
    background: var(--hover);
    color: var(--text);
  }
</style>
