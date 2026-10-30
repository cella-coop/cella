<script lang="ts">
  import { Section, Table, type Column } from '@cella/org-ui'
  import type { Detail, Lined, Taxed } from '../../models/bill.ts'

  // What the bill charges, line by line, and its VAT by rate.
  let { data }: { data: Detail; id: string } = $props()

  const lines: Column<Lined>[] = [
    { key: 'description', label: 'Description', kind: 'title', value: (l) => l.description },
    { key: 'quantity', label: 'Quantity', kind: 'number', value: (l) => Number(l.quantity) },
    { key: 'unit_price', label: 'Unit price', kind: 'money', value: (l) => l.unit_price },
    { key: 'vat_rate', label: 'VAT', kind: 'number', value: (l) => `${Number(l.vat_rate)} %` },
    { key: 'amount', label: 'Amount', kind: 'money', value: (l) => l.amount },
  ]
  const taxed: Column<Taxed & { id: string }>[] = [
    { key: 'rate', label: 'Rate', kind: 'number', value: (t) => `${Number(t.rate)} %` },
    { key: 'base', label: 'Base', kind: 'money', value: (t) => t.base },
    { key: 'tax', label: 'VAT', kind: 'money', value: (t) => t.tax },
  ]
  const rates = $derived(data.taxed.map((t) => ({ ...t, id: t.rate })))
</script>

<Section title="Lines" count={data.lines.length}>
  <Table columns={lines} rows={data.lines} />
</Section>
<Section title="VAT by rate" count={rates.length}>
  <Table columns={taxed} rows={rates} />
</Section>
