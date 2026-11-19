<script lang="ts">
  import type { Option } from '../models/select.ts'
  import Avatar from './Avatar.svelte'
  import Icon from './Icon.svelte'
  import Value from './Value.svelte'

  // An option as it is drawn in a picker's list and on its trigger: the
  // property's own look (`Value`) where it has a kind or a tone, a
  // person's avatar, an icon of its own, else its words alone.
  let { o }: { o: Option } = $props()
  // A circle, a person or a priority is its value; a state is its words.
  const raw = $derived(o.kind && o.kind !== 'badge' ? o.value : o.label)
</script>

{#if o.who}
  <Avatar name={o.who} size="1.25rem" />
  <span class="text">{o.label}</span>
{:else if o.kind || o.tone}
  <span class="text"><Value value={raw} kind={o.kind ?? 'badge'} tone={o.tone} states={o.states} record={o.record} size="cell" /></span>
{:else}
  {#if o.icon}<span class="mark"><Icon icon={o.icon} size="1em" /></span>{/if}
  <span class="text">{o.label}</span>
{/if}

<style>
  .text {
    flex: 1;
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .mark {
    display: inline-flex;
    flex: none;
    color: var(--text-muted);
  }
</style>
