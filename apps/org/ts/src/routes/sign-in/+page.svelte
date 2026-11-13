<script lang="ts">
  import { browser } from '$app/env'
  import { page } from '$app/state'
  import { Failed, SignIn, Skeleton } from '@cella/org-ui'
  import { shell, signing } from '#lib/remote/session.remote.ts'

  // Where to go once signed in and what the dev server offers, and the
  // scope the shell reads, both started at once.
  const offered = $derived(signing({ back: page.url.searchParams.get('back') ?? '' }))
  const around = shell()
</script>

{#snippet loading()}
  <Skeleton title="Sign in" />
{/snippet}

<svelte:boundary pending={browser ? loading : undefined}>
  {#snippet failed(error)}
    <Failed {error} />
  {/snippet}
  {const data = $derived(await offered)}
  {const s = $derived(await around)}
  <SignIn scope={s.scope.address} back={data.back} fixtures={data.fixtures} />
</svelte:boundary>
