<script lang="ts">
  import { Section, Table, type Column } from '@cella/org-ui'
  import type { Membership } from '../../models/member.ts'

  // The membership's own steps of joining: invited, then admitted by the
  // assembly with the shares they subscribe. What else joining asks, the
  // texts, the capital, a device and the circles, the slices that keep
  // them list beside it. Someone not yet invited has these steps ahead.
  let { data }: { data: Membership; id: string } = $props()

  type Step = { id: string; step: string; state: string; day: string | null; detail: string }
  const m = $derived(data.member)
  const admitted = $derived(m?.since != null)
  const steps = $derived<Step[]>([
    { id: 'invited', step: 'Invited to join', state: m?.invited || admitted ? 'done' : 'to do', day: m?.invited ?? null, detail: '' },
    {
      id: 'admitted',
      step: 'Admitted by the assembly',
      state: admitted ? 'done' : 'to do',
      day: m?.since ?? null,
      detail: admitted ? `${m?.shares} shares` : 'the assembly decides, by its procedure',
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
