<script lang="ts">
  import { Section, Stats } from '@cella/org-ui'
  import type { Detail } from '../../models/timesheet.ts'

  // The month this entry belongs to, its member's timesheet in its
  // circle: its hours and where it stands.
  let { data }: { data: Detail; id: string } = $props()

  const s = $derived(data.sheet)
</script>

<Section title="Timesheet {s.month}, {s.circle}">
  <Stats
    items={[
      { label: 'State', value: s.state, kind: 'badge', tone: s.state === 'approved' ? 'positive' : s.state === 'submitted' ? 'accent' : 'neutral' },
      { label: 'Hours', value: s.hours, kind: 'number' },
      { label: 'Billable', value: s.billable, kind: 'number' },
      { label: 'Entries', value: s.entries, kind: 'number' },
      { label: 'Submitted', value: s.submitted, kind: 'date' },
      { label: 'Approved', value: s.approved, kind: 'date' },
    ]}
  />
</Section>
