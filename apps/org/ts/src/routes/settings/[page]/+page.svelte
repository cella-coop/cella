<script lang="ts">
  import { Frame } from '@cella/org-ui'
  import { settings } from '#lib/slices.ts'
  import type { PageProps } from './$types'

  let { data }: PageProps = $props()

  // A settings page in the one page frame, drawn by its slice's block.
  const page = $derived(settings(data.name))
</script>

{#if page}
  {#key data.name}
    <Frame title={page.title} icon={page.icon} caption={page.caption}>
      <page.block data={data.data} viewer={data.viewer} theme={data.theme} />
    </Frame>
  {/key}
{/if}
