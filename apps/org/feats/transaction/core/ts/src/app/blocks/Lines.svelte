<script lang="ts">
  import { Section, Table, type Column } from '@cella/org-ui'
  import type { Booked, Detail } from '../../models/transaction.ts'

  // An entry's lines; its debits and credits balance, or it never posted.
  let { data }: { data: Detail; id: string } = $props()

  const columns: Column<Booked>[] = [
    { key: 'account', label: 'Account', kind: 'mono', value: (l) => l.account },
    { key: 'debit', label: 'Debit', kind: 'money', value: (l) => (l.side === 'debit' ? l.cents : null) },
    { key: 'credit', label: 'Credit', kind: 'money', value: (l) => (l.side === 'credit' ? l.cents : null) },
  ]
</script>

<Section title="Lines" count={data.lines.length}>
  <Table {columns} rows={data.lines} href={(l: Booked) => `/accounts/${l.account}`} />
</Section>
