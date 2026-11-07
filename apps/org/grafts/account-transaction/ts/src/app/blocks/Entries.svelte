<script lang="ts">
  import { Section, Table, type Column } from '@cella/org-ui'
  import type { Dated } from '../../models/balance.ts'

  // Every entry dated in the period, each opening as its transaction.
  let { data }: { data: Dated[]; id: string } = $props()

  const columns: Column<Dated>[] = [
    { key: 'id', label: 'Entry', kind: 'mono', value: (e) => e.id },
    { key: 'date', label: 'Date', kind: 'date', value: (e) => e.date },
    { key: 'label', label: 'Label', value: (e) => e.label },
    { key: 'amount', label: 'Amount', kind: 'money', value: (e) => e.amount },
  ]
</script>

<Section title="Entries" count={data.length}>
  <Table {columns} rows={data} empty="Nothing is dated in this period" href={(e: Dated) => `/transactions/${e.id}`} />
</Section>
