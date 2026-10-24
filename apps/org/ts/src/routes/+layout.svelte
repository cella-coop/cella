<script lang="ts">
  import { page } from '$app/state'
  import { Shell, type Done } from '@cella/org-ui'
  import { nav } from '#lib/slices.ts'
  import type { LayoutProps } from './$types'

  let { data, children }: LayoutProps = $props()

  // The last write's outcome, from whichever action the page ran.
  const outcome = $derived((page.form?.done ?? null) as Done | null)
</script>

<svelte:head>
  <title>{data.scope} · cella</title>
</svelte:head>

<Shell scope={data.scope} {nav} actor={data.actor} actors={data.actors} dev={data.dev} theme={data.theme} {outcome} source="/search" drawer={data.drawer}>
  {@render children()}
</Shell>
