<script lang="ts">
  import { Section, Table, type Column } from '@cella/org-ui'
  import type { Bill } from '../../models/billing.ts'

  // The invoices that bill this client.
  let { data }: { data: Bill[]; id: string } = $props()

  const columns: Column<Bill>[] = [
    { key: 'id', label: 'Invoice', kind: 'title', value: (b) => b.id },
    { key: 'label', label: 'Label', value: (b) => b.label },
    { key: 'issued', label: 'Issued', kind: 'date', value: (b) => b.issued },
    { key: 'total', label: 'Total', kind: 'money', value: (b) => b.total },
    { key: 'owed', label: 'Owed', kind: 'money', value: (b) => b.owed },
    { key: 'state', label: 'Standing', kind: 'badge', value: (b) => b.state },
  ]
</script>

<Section title="Invoices" count={data.length}>
  <Table {columns} rows={data} href={(b: Bill) => `/invoices/${b.id}`} />
</Section>
