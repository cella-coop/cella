<script lang="ts">
  import type { Component } from 'svelte'
  import Icon from './Icon.svelte'

  // A segmented control: one of a few mutually exclusive choices, each an
  // icon, in a well (`--sunk`) with its chosen segment lifted
  // (`--selected`), as the collection's layout picker.
  let {
    label,
    options,
    value,
    onchange,
  }: { label: string; options: { value: string; label: string; icon: Component<any> }[]; value: string; onchange: (value: string) => void } = $props()
</script>

<div class="segmented" role="group" aria-label={label}>
  {#each options as o (o.value)}
    <button type="button" class:on={value === o.value} aria-pressed={value === o.value} aria-label={o.label} title={o.label} onclick={() => onchange(o.value)}>
      <Icon icon={o.icon} />
    </button>
  {/each}
</div>

<style>
  .segmented {
    display: flex;
    background: var(--sunk);
    border-radius: var(--radius-control);
    padding: 2px;
  }
  .segmented button {
    display: grid;
    place-items: center;
    flex: 1;
    height: 1.75rem;
    padding: 0;
    border: none;
    border-radius: calc(var(--radius-control) - 2px);
    background: none;
    font-size: var(--text-sm);
    color: var(--text-muted);
    cursor: pointer;
  }
  .segmented button.on {
    background: var(--selected);
    color: var(--text);
  }
</style>
