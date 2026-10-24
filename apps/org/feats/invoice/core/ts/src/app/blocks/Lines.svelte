<script lang="ts">
  import { Section, Table, type Column } from '@cella/org-ui'
  import type { Detail, Lined, Received } from '../../models/invoice.ts'

  // What the invoice bills, line by line, and what was received for it.
  let { data }: { data: Detail; id: string } = $props()

  const lines: Column<Lined>[] = [
    { key: 'description', label: 'Description', kind: 'title', value: (l) => l.description },
    { key: 'quantity', label: 'Quantity', kind: 'number', value: (l) => Number(l.quantity) },
    { key: 'unit_price', label: 'Unit price', kind: 'money', value: (l) => l.unit_price },
    { key: 'vat_rate', label: 'VAT', kind: 'number', value: (l) => `${Number(l.vat_rate)} %` },
    { key: 'amount', label: 'Amount', kind: 'money', value: (l) => l.amount },
  ]
  const payments: Column<Received>[] = [
    { key: 'at', label: 'Received', kind: 'date', value: (p) => p.at },
    { key: 'reference', label: 'Reference', kind: 'mono', value: (p) => p.reference },
    { key: 'method', label: 'Method', value: (p) => p.method },
    { key: 'amount', label: 'Amount', kind: 'money', value: (p) => p.amount },
  ]
</script>

<Section title="Lines" count={data.lines.length}>
  <Table columns={lines} rows={data.lines} />
</Section>
<Section title="Payments" count={data.payments.length}>
  {#if data.payments.length}
    <Table columns={payments} rows={data.payments} />
  {/if}
</Section>
