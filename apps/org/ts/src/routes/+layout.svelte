<script lang="ts">
  import { afterNavigate } from '$app/navigation'
  import { page } from '$app/state'
  import { Gate, Shell, useWrites } from '@cella/org-ui'
  import { index } from '#lib/remote/collection.remote.ts'
  import { shell } from '#lib/remote/session.remote.ts'
  import { nav } from '#lib/slices.ts'

  let { children } = $props()
  const sign = $derived(page.route.id === '/sign-in')

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

  // Named on the one state every page's writes already share, so a
  // slice that keeps a draft (a body, a drawer property) namespaces it
  // by who is signed in and which demo copy without asking the server
  // of its own; read lazily, so it always answers with `data`'s latest,
  // and reconciles every draft this origin keeps against it, now and
  // whenever it changes.
  writes.identify(
    () => data.actor?.address ?? '',
    () => data.join ?? '',
  )
</script>

<svelte:head>
  <title>{data.scope.name} · cella</title>
</svelte:head>

<!-- Signed in, the shell; before, the pages a person reaches first, the
     sign-in and an invitation's link, alone. -->
{#if data.actor}
  <Shell scope={data.scope} nav={nav(data.counts, data.waiting)} actor={data.actor} dev={data.dev} demo={data.demo} copy={data.copy} ends={data.ends} join={data.join} theme={data.theme} outcome={writes.done} source={index} drawer={data.drawer} kept={data.sections} people={data.people} circles={data.circles} lens={data.lens}>
    {@render children()}
  </Shell>
{:else}
  <Gate wide={sign} scope={data.scope} demo={data.demo} copy={data.copy} ends={data.ends} join={data.join}>
    {@render children()}
  </Gate>
{/if}
