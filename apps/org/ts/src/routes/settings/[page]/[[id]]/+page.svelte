<script lang="ts">
  import { onMount } from 'svelte'
  import { browser } from '$app/env'
  import { page as here } from '$app/state'
  import { Basket, Failed, ProposeBasket, SettingsFrame, Skeleton, useBasket, useShell, useWrites } from '@cella/org-ui'
  import { page as read } from '#lib/remote/settings.remote.ts'
  import { settings } from '#lib/slices.ts'
  import { onSettings } from '#lib/writes.ts'

  const name = $derived(here.params.page ?? '')
  // The one thing a page of one is of, `/settings/<name>/<id>`; none on a
  // page of the coop's or the person's own.
  const id = $derived(here.params.id ?? '')
  // Its writes are posted to the page's, and a save that took or reached
  // a verdict reads the page again.
  useWrites().serve(() => onSettings(() => name, true, () => id))
  // The changes to propose, gathered across the settings pages and kept
  // in the session's cookie, which the browser alone reads; the sidebar
  // opens on them as one is gathered.
  const shell = useShell()
  const basket = useBasket(
    () => ({ page: name, id }),
    () => shell.choose('basket'),
  )
  onMount(() => basket.load())
  // What the skeleton names while the page loads.
  const opening = $derived(settings(name))
  // The page as its slice reads it for the signed-in person.
  const one = $derived(read({ page: name, id }))
</script>

{#snippet loading()}
  <Skeleton title={opening?.title} />
{/snippet}

{#snippet gathered()}
  <Basket />
{/snippet}

<!-- A settings page, laid out as a record's (`SettingsFrame`): its
     slice's block, as the data names it, never the address, and its
     Details; while changes wait to be proposed, the drawer holds them,
     and Review proposes a circle's as one motion. -->
<svelte:boundary pending={browser ? loading : undefined}>
  {#snippet failed(error)}
    <Failed {error} />
  {/snippet}
  {const data = $derived(await one)}
  {const shown = $derived(settings(data.name))}
  {#if shown}
    {#key `${data.name}/${data.id}`}
      <SettingsFrame title={shown.title} icon={shown.icon} caption={shown.caption} properties={shown.properties?.(data.data)} gathered={basket.count ? gathered : undefined}>
        <shown.block data={data.data} viewer={data.viewer} theme={data.theme} />
      </SettingsFrame>
    {/key}
  {/if}
</svelte:boundary>
<ProposeBasket />
