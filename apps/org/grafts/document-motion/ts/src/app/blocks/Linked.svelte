<script lang="ts">
  import { Mention } from '@cella/org-ui'
  import type { OnMotion } from '../../models/adoption.ts'

  // A document a motion's message links, by its title, to its page.
  let { ref, data }: { ref: string; data: OnMotion } = $props()

  const found = $derived(data.linked[ref])
</script>

<Mention label={found?.title ?? ref} href={found ? `/documents/${found.document}` : undefined} title={found ? ref : `${ref} names no document`} />
