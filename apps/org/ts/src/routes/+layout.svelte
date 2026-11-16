<script lang="ts">
  import { afterNavigate } from '$app/navigation'
  import { Gate, Shell, useWrites } from '@cella/org-ui'
  import { index } from '#lib/remote/collection.remote.ts'
  import { shell } from '#lib/remote/session.remote.ts'
  import { nav } from '#lib/slices.ts'

  let { children } = $props()

  // The last write's outcome, from whichever write the page posted, until
  // the next page; its context is set before the script awaits.
  const writes = useWrites()
  afterNavigate(({ type }) => {
    if (type !== 'enter') {
      writes.dismiss()
    }
  })

  // What the shell reads, awaited before it draws, so the server renders
  // it whole; a write that took or reached a verdict refreshes it.
  const data = $derived(await shell())
</script>

<svelte:head>
  <title>{data.scope.name} · cella</title>
</svelte:head>

<!-- Signed in, the shell; before, the pages a person reaches first, the
     sign-in and an invitation's link, alone. -->
{#if data.actor}
  <Shell scope={data.scope} nav={nav(data.counts, data.waiting)} actor={data.actor} dev={data.dev} demo={data.demo} copy={data.copy} theme={data.theme} outcome={writes.done} source={index} drawer={data.drawer} kept={data.sections} people={data.people} circles={data.circles} lens={data.lens}>
    {@render children()}
  </Shell>
{:else}
  <Gate scope={data.scope} demo={data.demo} copy={data.copy}>
    {@render children()}
  </Gate>
{/if}
