<script lang="ts">
  import { date, Section, Table, type Column } from '@cella/org-ui'
  import type { Keys } from '../../models/index.ts'

  // Joining's device: a key that signs the member's writes, the first one
  // carried by their invitation and enrolled by their admission.
  let { data }: { data: Keys; id: string } = $props()

  type Step = { id: string; step: string; state: string; detail: string }
  const held = $derived(data.devices.filter((d) => !d.revoked))
  const steps = $derived<Step[]>([
    {
      id: 'device',
      step: 'Enrol a device',
      state: held.length ? 'done' : 'to do',
      detail: [
        ...held.map((d) => `${d.label}, enrolled ${date(d.enrolled)}`),
        ...(data.first && !data.first.enrolled ? [`${data.first.label}, carried by the invitation, enrolled on admission`] : []),
      ].join('; '),
    },
  ])
  const columns: Column<Step>[] = [
    { key: 'step', label: 'Step', value: (x) => x.step },
    { key: 'state', label: 'State', kind: 'badge', value: (x) => x.state, tone: (x) => (x.state === 'done' ? 'positive' : 'accent') },
    { key: 'detail', label: 'What', value: (x) => x.detail },
  ]
</script>

<Section title="Devices">
  <Table {columns} rows={steps} />
</Section>
