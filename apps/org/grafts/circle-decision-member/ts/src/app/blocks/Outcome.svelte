<script lang="ts">
  import { Stats } from '@cella/org-ui'
  import { outcome, type Roll } from '../../models/roll.ts'

  // Where the decision stands: its outcome as the database computes it,
  // and how many on its roll have given a stance.
  let { data }: { data: Roll; id: string } = $props()

  const given = $derived(data.voters.filter((v) => v.stance).length)
</script>

<Stats
  items={[
    { label: 'Outcome', value: outcome(data).text, kind: 'badge', tone: outcome(data).tone },
    { label: 'Stances', value: `${given} of ${data.voters.length}` },
    { label: 'State', value: data.state, kind: 'badge' },
  ]}
/>
