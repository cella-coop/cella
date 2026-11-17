<script lang="ts">
  import Check from 'phosphor-svelte/lib/Check'
  import Icon from './Icon.svelte'

  // The mark of a chosen option or menu item: a bare check in the accent,
  // at the end of its row, the same in every list and menu.
  // The row's tint is `styles/base.css`'s.
</script>

<span class="tick" aria-hidden="true"><Icon icon={Check} size="1em" weight="regular" /></span>

<style>
  .tick {
    display: inline-flex;
    flex: none;
    margin-inline-start: auto;
    color: var(--accent-text);
  }
</style>
