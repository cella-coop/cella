<script lang="ts">
  import { browser } from '$app/env'
  import { page as here } from '$app/state'
  import { Failed, Frame, Skeleton, useWrites } from '@cella/org-ui'
  import { page as read } from '#lib/remote/settings.remote.ts'
  import { settings } from '#lib/slices.ts'
  import { onSettings } from '#lib/writes.ts'

  const name = $derived(here.params.page ?? '')
  // The one thing a page of one is of, `/settings/<name>/<id>`; none on a
  // page of the co-op's or the person's own.
  const id = $derived(here.params.id ?? '')
  // Its writes are posted to the page's, and a save that took or reached
  // a verdict reads the page again.
  useWrites().serve(() => onSettings(() => name, true, () => id))
  // What the skeleton names while the page loads.
  const opening = $derived(settings(name))
  // The page as its slice reads it for the signed-in person.
  const one = $derived(read({ page: name, id }))
</script>

{#snippet loading()}
  <Skeleton title={opening?.title} />
{/snippet}

<!-- A settings page in the one page frame, drawn by its slice's block,
     as the data names it, never the address. -->
<svelte:boundary pending={browser ? loading : undefined}>
  {#snippet failed(error)}
    <Failed {error} />
  {/snippet}
  {const data = $derived(await one)}
  {const shown = $derived(settings(data.name))}
  {#if shown}
    {#key `${data.name}/${data.id}`}
      <Frame title={shown.title} icon={shown.icon} caption={shown.caption}>
        <shown.block data={data.data} viewer={data.viewer} theme={data.theme} />
      </Frame>
    {/key}
  {/if}
</svelte:boundary>
