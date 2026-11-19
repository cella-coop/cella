<script lang="ts">
  // What stands where there is nothing to show: one muted line, as "No
  // roles yet" or "Nothing received for it yet", at the inset of what it
  // sits in. A table with no rows draws it in their place.
  let { text }: { text: string } = $props()
</script>

<p class="empty">{text}</p>

<style>
  .empty {
    margin: 0;
    font-size: var(--text-sm);
    color: var(--text-subtle);
    padding-inline: var(--inset, 0);
  }
</style>
