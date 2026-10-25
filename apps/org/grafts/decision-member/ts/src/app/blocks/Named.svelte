<script lang="ts">
  import { Mention } from '@cella/org-ui'
  import type { OnDecision } from '../../models/admission.ts'

  // A member a decision's discussion names, as its author or a mention, by
  // name, to their page.
  let { ref, data }: { ref: string; data: OnDecision } = $props()

  const found = $derived(data.people[ref])
</script>

<Mention label={found?.name ?? `@${ref}`} href={found ? `/members/${found.address}` : undefined} title={found?.address} />
