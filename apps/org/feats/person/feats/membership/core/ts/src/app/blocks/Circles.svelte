<script lang="ts">
  import { Section, Table, type Column } from '@cella/org-ui'
  import type { Held, Seat } from '@cella/org-circle/models'

  // Joining's circles: a seat in the assembly, which the admission gives,
  // and one in a working circle, which that circle's motion gives.
  let { data }: { data: { seats: Seat[]; held: Held[] }; id: string } = $props()

  type Step = { id: string; step: string; state: string; detail: string }
  const now = $derived(data.seats.filter((s) => !s.until))
  const assembly = $derived(now.filter((s) => s.root))
  const working = $derived(now.filter((s) => !s.root))
  const steps = $derived<Step[]>([
    {
      id: 'assembly',
      step: 'Sit in the assembly',
      state: assembly.length ? 'done' : 'to do',
      detail: assembly.length ? assembly.map((s) => s.circleName).join(', ') : 'the admission seats a new member there',
    },
    {
      id: 'working',
      step: 'Join a working circle',
      state: working.length ? 'done' : 'to do',
      detail: working.length
        ? working.map((s) => (s.roleName ? `${s.circleName} as ${s.roleName}` : s.circleName)).join(', ')
        : 'a circle seats a member by its own motion',
    },
  ])
  const columns: Column<Step>[] = [
    { key: 'step', label: 'Step', value: (x) => x.step },
    { key: 'state', label: 'State', kind: 'badge', value: (x) => x.state, tone: (x) => (x.state === 'done' ? 'positive' : 'accent') },
    { key: 'detail', label: 'What', value: (x) => x.detail },
  ]
</script>

<Section title="Circles">
  <Table {columns} rows={steps} />
</Section>
