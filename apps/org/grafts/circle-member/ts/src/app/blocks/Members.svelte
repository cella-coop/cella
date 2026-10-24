<script lang="ts">
  import { Section, Table, type Column } from '@cella/org-ui'
  import type { Seat } from '../../models/position.ts'

  // Who sits in a circle, in which role, since when.
  let { data }: { data: Seat[]; id: string } = $props()

  const columns: Column<Seat>[] = [
    { key: 'member', label: 'Member', kind: 'title', value: (s) => s.memberName ?? s.member },
    { key: 'role', label: 'Role', value: (s) => s.roleName },
    { key: 'since', label: 'Since', kind: 'date', value: (s) => s.since },
    { key: 'until', label: 'Until', kind: 'date', value: (s) => s.until },
  ]
</script>

<Section title="Seats" count={data.length}>
  <Table {columns} rows={data} href={(s: Seat) => `/members/${s.member}`} />
</Section>
