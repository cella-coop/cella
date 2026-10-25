<script lang="ts">
  import { Section, Table, type Column } from '@cella/org-ui'
  import type { Owed } from '../../models/patronage.ts'

  // A member's own statements of the work share, on their page: each
  // year's part, what it employs in shares and what it pays.
  let { data }: { data: Owed[]; id: string } = $props()

  const columns: Column<Owed>[] = [
    { key: 'year', label: 'Year', value: (s) => String(s.year) },
    { key: 'part', label: 'Part', kind: 'money', value: (s) => s.part },
    { key: 'capital', label: 'In shares', kind: 'money', value: (s) => s.capital },
    { key: 'cash', label: 'Paid', kind: 'money', value: (s) => s.cash },
    { key: 'state', label: 'State', kind: 'badge', value: (s) => (s.distributed ? 'distributed' : 'approved'), tone: (s) => (s.distributed ? 'positive' : 'warning') },
  ]
</script>

{#if data.length}
  <Section title="Your work share statements" count={data.length}>
    <Table {columns} rows={data} href={(s: Owed) => `/statements/${s.id}`} />
  </Section>
{/if}
