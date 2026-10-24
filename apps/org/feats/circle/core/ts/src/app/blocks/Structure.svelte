<script lang="ts">
  import { money, Section, Table, type Column } from '@cella/org-ui'
  import type { Detail, Mandate, Role } from '../../models/circle.ts'

  // A circle's roles, and the mandates that grant them powers, each capped
  // by a limit per write or a budget over a period.
  let { data }: { data: Detail; id: string } = $props()

  const roles: Column<Role>[] = [
    { key: 'name', label: 'Role', kind: 'title', value: (r) => r.name },
    { key: 'duty', label: 'Duty', value: (r) => r.duty },
    { key: 'circle', label: 'Of', kind: 'mono', value: (r) => (r.circle === '*' ? 'every working circle' : r.circle) },
  ]
  const mandates: Column<Mandate>[] = [
    { key: 'power', label: 'Power', kind: 'mono', value: (m) => m.power },
    { key: 'text', label: 'Grants', value: (m) => m.text },
    { key: 'role', label: 'Role', value: (m) => m.role },
    { key: 'limit', label: 'Limit', kind: 'money', value: (m) => m.limit },
    { key: 'budget', label: 'Budget', value: (m) => (m.budget === null ? null : `${money(m.budget)} a ${m.per}`) },
    { key: 'until', label: 'Until', kind: 'date', value: (m) => m.revoked ?? m.until },
  ]
</script>

<Section title="Roles" count={data.roles.length}>
  <Table columns={roles} rows={data.roles} />
</Section>
<Section title="Mandates" count={data.mandates.length}>
  <Table columns={mandates} rows={data.mandates} />
</Section>
