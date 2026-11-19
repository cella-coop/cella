<script lang="ts">
  import { Chip } from '@cella/org-ui'
  import type { OnMotion } from '../../models/admission.ts'

  // A member a motion's discussion names, as its author or a mention, by
  // name, to their page.
  let { ref, data }: { ref: string; data: OnMotion } = $props()

  const found = $derived(data.people[ref])
</script>

<Chip inline label={found?.name ?? `@${ref}`} href={found ? `/people/${found.address}` : undefined} title={found?.address} />
