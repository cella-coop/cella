<script lang="ts">
  import { afterNavigate } from '$app/navigation'
  import { Gate, Shell, useWrites } from '@cella/org-ui'
  import { index } from '#lib/remote/collection.remote.ts'
  import { nav } from '#lib/slices.ts'
  import type { LayoutProps } from './$types'

  let { data, children }: LayoutProps = $props()

  // The last write's outcome, from whichever write the page posted, until
  // the next page.
  const writes = useWrites()
  afterNavigate(({ type }) => {
    if (type !== 'enter') {
      writes.dismiss()
    }
  })
</script>

<svelte:head>
  <title>{data.scope.name} · cella</title>
</svelte:head>

<!-- Signed in, the shell; before, the pages a person reaches first, the
     sign-in and an invitation's link, alone. -->
{#if data.actor}
  <Shell scope={data.scope} nav={nav(data.counts, data.waiting)} actor={data.actor} dev={data.dev} theme={data.theme} outcome={writes.done} source={index} drawer={data.drawer} people={data.people} circles={data.circles} lens={data.lens}>
    {@render children()}
  </Shell>
{:else}
  <Gate scope={data.scope}>
    {@render children()}
  </Gate>
{/if}
