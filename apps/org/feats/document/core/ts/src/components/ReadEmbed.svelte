<script lang="ts">
  import type { Embeds } from '@cella/org-ui'

  let { kind, ref, embeds }: { kind: string; ref: string; embeds: Embeds } = $props()
  const found = $derived(embeds[kind])
</script>

<div class="embed">
  {#if found}
    <found.embed.block {ref} data={found.data} />
  {:else}
    <div class="unknown">{kind} {ref}</div>
  {/if}
</div>
