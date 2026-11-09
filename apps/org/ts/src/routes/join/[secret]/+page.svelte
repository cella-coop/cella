<script lang="ts">
  import { browser } from '$app/env'
  import { page } from '$app/state'
  import { Failed, Join, Skeleton, useWrites } from '@cella/org-ui'
  import { invited, shell } from '#lib/remote/session.remote.ts'
  import { onJoin } from '#lib/writes.ts'

  const secret = $derived(page.params.secret ?? '')
  // Its one write, the acceptance, is the link's.
  useWrites().serve(() => onJoin(() => secret))
  // Whom the link invites, and the scope the shell reads, both started at
  // once.
  const whom = $derived(invited({ secret }))
  const around = shell()
</script>

{#snippet loading()}
  <Skeleton title="Invitation" />
{/snippet}

<svelte:boundary pending={browser ? loading : undefined}>
  {#snippet failed(error)}
    <Failed {error} />
  {/snippet}
  {const one = $derived(await whom)}
  {const s = $derived(await around)}
  <Join scope={s.scope} invited={one} />
</svelte:boundary>
