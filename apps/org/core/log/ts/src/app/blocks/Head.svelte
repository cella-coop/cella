<script lang="ts">
  import { short, Stats } from '@cella/org-ui'
  import type { Entry, Head } from '../../models/log.ts'

  // Whether the whole log verifies: every entry, receipt and signature,
  // rechecked by `cella.verify_log()` on each load.
  let { about }: { rows: Entry[]; about: Head } = $props()
</script>

<Stats
  items={[
    { label: 'Verify', value: about.verified ? 'verifies' : 'broken', kind: 'badge', tone: about.verified ? 'positive' : 'negative' },
    { label: 'Head', value: about.n, kind: 'number' },
    { label: 'Scope', value: about.scope },
    { label: 'Notary key', value: short(about.key, 16), kind: 'mono' },
  ]}
/>
