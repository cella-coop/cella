<script lang="ts">
  import { Section, Stats, Table, type Column } from '@cella/org-ui'
  import type { Spent } from '../../models/rebill.ts'

  // What the project's members spent for it, to bill on to its client.
  let { data }: { data: Spent; id: string } = $props()

  type Row = Spent['expenses'][number]
  const columns: Column<Row>[] = [
    { key: 'label', label: 'Expense', value: (e) => e.label },
    { key: 'day', label: 'Spent on', kind: 'date', value: (e) => e.day },
    { key: 'total', label: 'Amount', kind: 'money', value: (e) => e.total },
    { key: 'status', label: 'Status', kind: 'badge', value: (e) => e.status },
  ]
</script>

{#if data.expenses.length}
  <Section title="Expenses to bill on" count={data.expenses.length}>
    <Stats
      items={[
        { label: 'Approved', value: data.approved, kind: 'money' },
        { label: 'Pending', value: data.pending, kind: 'money' },
      ]}
    />
    <Table {columns} rows={data.expenses} href={(e: Row) => `/expenses/${e.id}`} />
  </Section>
{/if}
