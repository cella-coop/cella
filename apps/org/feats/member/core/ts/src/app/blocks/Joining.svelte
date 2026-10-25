<script lang="ts">
  import { Section, Table, type Column } from '@cella/org-ui'
  import type { Member } from '../../models/member.ts'

  // The membership's own steps of joining: invited, then admitted by the
  // assembly with the shares they subscribe. What else joining asks, the
  // texts, the capital, a device and the circles, the slices that keep
  // them list beside it.
  let { data }: { data: Member; id: string } = $props()

  type Step = { id: string; step: string; state: string; day: string | null; detail: string }
  const admitted = $derived(data.since !== null)
  const steps = $derived<Step[]>([
    { id: 'invited', step: 'Invited to join', state: data.invited || admitted ? 'done' : 'to do', day: data.invited, detail: '' },
    {
      id: 'admitted',
      step: 'Admitted by the assembly',
      state: admitted ? 'done' : 'to do',
      day: data.since,
      detail: admitted ? `${data.shares} shares` : 'the assembly decides, by its procedure',
    },
  ])
  const columns: Column<Step>[] = [
    { key: 'step', label: 'Step', value: (s) => s.step },
    { key: 'state', label: 'State', kind: 'badge', value: (s) => s.state, tone: (s) => (s.state === 'done' ? 'positive' : 'accent') },
    { key: 'day', label: 'Day', kind: 'date', value: (s) => s.day },
    { key: 'detail', label: 'What', value: (s) => s.detail },
  ]
</script>

<Section title="Membership">
  <Table {columns} rows={steps} />
</Section>
