<script lang="ts">
  import { Stats } from '@cella/org-ui'
  import { outcome, taking, type Roll } from '../../models/roll.ts'

  // Where the motion stands: its outcome by its procedure, as the
  // database computes it, and how many of those it counts have given a
  // stance, against its quorum.
  let { data }: { data: Roll; id: string } = $props()
</script>

<Stats
  items={[
    { label: 'Outcome', value: outcome(data).text, kind: 'badge', tone: outcome(data).tone },
    { label: 'Stances', value: taking(data) },
    { label: 'State', value: data.state, kind: 'badge' },
  ]}
/>
