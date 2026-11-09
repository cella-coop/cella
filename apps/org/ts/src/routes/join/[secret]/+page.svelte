<script lang="ts">
  import { page } from '$app/state'
  import { Join, useWrites } from '@cella/org-ui'
  import { onJoin } from '#lib/writes.ts'
  import type { PageProps } from './$types'

  let { data }: PageProps = $props()

  // Its one write, the acceptance, is the link's.
  useWrites().serve(() => onJoin(() => page.params.secret ?? ''))
</script>

<Join scope={data.scope} invited={data.invited} />
