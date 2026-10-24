<script lang="ts">
  import { Section, Table, type Column } from '@cella/org-ui'
  import type { Held, Seat } from '../../models/position.ts'

  // Where a member sits, and the powers their seats give them: what
  // `circle_member.may` checks a write against.
  let { data }: { data: { seats: Seat[]; held: Held[] }; id: string } = $props()

  const seats: Column<Seat>[] = [
    { key: 'circle', label: 'Circle', kind: 'title', value: (s) => s.circleName },
    { key: 'role', label: 'Role', value: (s) => s.roleName ?? 'seat' },
    { key: 'since', label: 'Since', kind: 'date', value: (s) => s.since },
    { key: 'until', label: 'Until', kind: 'date', value: (s) => s.until },
  ]
  const held: Column<Held>[] = [
    { key: 'power', label: 'Power', kind: 'mono', value: (h) => h.power },
    { key: 'text', label: 'Grants', value: (h) => h.text },
    { key: 'limit', label: 'Limit', kind: 'money', value: (h) => h.limit },
    { key: 'through', label: 'Through', value: (h) => `${h.role} in ${h.circleName}` },
  ]
</script>

<Section title="Seats" count={data.seats.length}>
  <Table columns={seats} rows={data.seats} href={(s: Seat) => `/circles/${s.circle}`} />
</Section>
<Section title="Powers held" count={data.held.length}>
  <Table columns={held} rows={data.held} />
</Section>
