<script lang="ts">
  import { Mention } from '@cella/org-ui'
  import type { OnDecision } from '../../models/adoption.ts'

  // A document a decision's message links, by its title, to its page.
  let { ref, data }: { ref: string; data: OnDecision } = $props()

  const found = $derived(data.linked[ref])
</script>

<Mention label={found?.title ?? ref} href={found ? `/documents/${found.document}` : undefined} title={found ? ref : `${ref} names no document`} />
