<script lang="ts">
  import { Section, Table, type Column } from '@cella/org-ui'
  import { sittings, type Seat, type Sitting } from '../../models/seat.ts'

  // Who sits in a circle, one row per person, in which roles, since when.
  let { data }: { data: Seat[]; id: string } = $props()

  const rows = $derived(sittings(data))
  const columns: Column<Sitting>[] = [
    { key: 'member', label: 'Member', kind: 'person', value: (s) => s.member },
    { key: 'roles', label: 'Roles', value: (s) => s.roles },
    { key: 'since', label: 'Since', kind: 'date', value: (s) => s.since },
    { key: 'until', label: 'Until', kind: 'date', value: (s) => s.until },
  ]
</script>

<Section title="Seats" count={rows.length}>
  <Table {columns} rows={rows} href={(s: Sitting) => `/people/${s.member}`} />
</Section>
