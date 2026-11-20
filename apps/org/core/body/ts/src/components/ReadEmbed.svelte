<script lang="ts">
  import { blocks, type Embeds } from '@cella/org-ui'

  let { kind, ref, embeds }: { kind: string; ref: string; embeds: Embeds } = $props()
  const found = $derived(embeds[kind])
</script>

<blocks.Embed>
  {#if found}
    <found.embed.block {ref} data={found.data} />
  {:else}
    <div class="unknown">{kind} {ref}</div>
  {/if}
</blocks.Embed>
