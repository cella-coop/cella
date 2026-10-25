<script lang="ts">
  import { page } from '$app/state'
  import { Gate, Shell, type Done } from '@cella/org-ui'
  import { nav } from '#lib/slices.ts'
  import type { LayoutProps } from './$types'

  let { data, children }: LayoutProps = $props()

  // The last write's outcome, from whichever action the page ran.
  const outcome = $derived((page.form?.done ?? null) as Done | null)
</script>

<svelte:head>
  <title>{data.scope.name} · cella</title>
</svelte:head>

<!-- Signed in, the shell; before, the pages a person reaches first, the
     sign-in and an invitation's link, alone. -->
{#if data.actor}
  <Shell scope={data.scope} nav={nav(data.counts)} actor={data.actor} dev={data.dev} theme={data.theme} {outcome} source="/search" drawer={data.drawer}>
    {@render children()}
  </Shell>
{:else}
  <Gate scope={data.scope}>
    {@render children()}
  </Gate>
{/if}
