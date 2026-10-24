<script lang="ts">
  import { Section, Table, type Column } from '@cella/org-ui'
  import type { Ledger, Movement } from '../../models/balance.ts'

  // Every line posted to the account: its ledger.
  let { data }: { data: Ledger; id: string } = $props()

  const columns: Column<Movement>[] = [
    { key: 'entry', label: 'Entry', kind: 'mono', value: (m) => m.entry },
    { key: 'date', label: 'Date', kind: 'date', value: (m) => m.date },
    { key: 'label', label: 'Label', value: (m) => m.label },
    { key: 'debit', label: 'Debit', kind: 'money', value: (m) => (m.side === 'debit' ? m.cents : null) },
    { key: 'credit', label: 'Credit', kind: 'money', value: (m) => (m.side === 'credit' ? m.cents : null) },
  ]
</script>

<Section title="Ledger" count={data.movements.length}>
  <Table {columns} rows={data.movements} href={(m: Movement) => `/journal/${m.entry}`} />
</Section>
