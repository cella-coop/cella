<script lang="ts">
  import { power, Section, Table, type Column } from '@cella/org-ui'
  import type { Detail, Role, Standing } from '../../models/circle.ts'
  import { cap, covers, tones } from '../../bindings/words.ts'

  // A circle's roles, each with its duty and the circle it is of, and the
  // mandates that grant them powers in the Mandates collection's words:
  // the power, the role by name, the cap, what it covers, the circle that
  // issued it and whether it stands; each opens its mandate's page, its
  // sentence and its chain.
  let { data }: { data: Detail; id: string } = $props()

  const roles: Column<Role>[] = [
    { key: 'name', label: 'Role', kind: 'title', value: (r) => r.name },
    { key: 'duty', label: 'Duty', value: (r) => r.duty },
    { key: 'circle', label: 'Of', value: (r) => (r.circle === '*' ? 'every working circle' : data.name) },
  ]
  const mandates: Column<Standing>[] = [
    { key: 'power', label: 'Power', kind: 'title', value: (m) => power(m.power) },
    { key: 'grantee', label: 'Granted to', value: (m) => m.granteeName },
    { key: 'cap', label: 'Cap', value: (m) => cap(m) },
    { key: 'scope', label: 'Covers', value: (m) => covers(m) },
    { key: 'issuer', label: 'Issued by', value: (m) => m.issuerName },
    { key: 'state', label: 'State', kind: 'badge', value: (m) => m.state, tone: (m) => tones[m.state] },
  ]
</script>

<Section title="Roles" count={data.roles.length}>
  <Table columns={roles} rows={data.roles} />
</Section>
<Section title="Mandates" count={data.mandates.length}>
  <Table columns={mandates} rows={data.mandates} href={(m) => `/mandates/${m.id}`} />
</Section>
