<script lang="ts">
  import { money, power, Section, Table, type Column } from '@cella/org-ui'
  import type { Detail, Mandate, Role } from '../../models/circle.ts'

  // A circle's roles, and the mandates that grant them powers, each its
  // policy's sentence, capped by a limit per write or a budget over a
  // period, scoped to what it covers, and the circle that issued it;
  // each opens its mandate's page, its chain.
  let { data }: { data: Detail; id: string } = $props()

  const roles: Column<Role>[] = [
    { key: 'name', label: 'Role', kind: 'title', value: (r) => r.name },
    { key: 'duty', label: 'Duty', value: (r) => r.duty },
    { key: 'circle', label: 'Of', kind: 'mono', value: (r) => (r.circle === '*' ? 'every working circle' : r.circle) },
  ]
  const mandates: Column<Mandate>[] = [
    { key: 'power', label: 'Power', value: (m) => power(m.power) },
    { key: 'sentence', label: 'Policy', value: (m) => m.sentence },
    { key: 'grantee', label: 'Role', value: (m) => m.grantee },
    { key: 'limit', label: 'Limit', kind: 'money', value: (m) => m.limit },
    { key: 'budget', label: 'Budget', value: (m) => (m.budget === null ? null : `${money(m.budget)} a ${m.per}`) },
    { key: 'scope', label: 'Covers', value: (m) => (m.scope === null ? 'the whole co-op' : m.scope === 'own' ? 'its own circle' : m.scope) },
    { key: 'issuer', label: 'Issued by', kind: 'mono', value: (m) => m.issuer },
    { key: 'until', label: 'Until', kind: 'date', value: (m) => m.revoked ?? m.until },
  ]
</script>

<Section title="Roles" count={data.roles.length}>
  <Table columns={roles} rows={data.roles} />
</Section>
<Section title="Mandates" count={data.mandates.length}>
  <Table columns={mandates} rows={data.mandates} href={(m) => `/mandates/${m.id}`} />
</Section>
