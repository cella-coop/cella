<script lang="ts">
  import { Frame, useWrites } from '@cella/org-ui'
  import { settings } from '#lib/slices.ts'
  import { onSettings } from '#lib/writes.ts'
  import type { PageProps } from './$types'

  let { data }: PageProps = $props()

  // A settings page in the one page frame, drawn by its slice's block,
  // its writes posted to the page's.
  const page = $derived(settings(data.name))
  useWrites().serve(() => onSettings(() => data.name))
</script>

{#if page}
  {#key data.name}
    <Frame title={page.title} icon={page.icon} caption={page.caption}>
      <page.block data={data.data} viewer={data.viewer} theme={data.theme} />
    </Frame>
  {/key}
{/if}
