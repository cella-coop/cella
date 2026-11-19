<script lang="ts">
  import { icons, money, Panel, Table, type Column, type Total } from '@cella/org-ui'
  import type { Taxed } from '@cella/org-vat'
  import type { Detail, Lined } from '../../models/bill.ts'

  // What the bill charges, line by line, its VAT by rate, and its totals
  // ruled off under them: the overview's first panel.
  let { data }: { data: Detail; id: string } = $props()

  const lines: Column<Lined>[] = [
    { key: 'description', label: 'Description', kind: 'title', value: (l) => l.description },
    { key: 'quantity', label: 'Quantity', kind: 'number', value: (l) => Number(l.quantity) },
    { key: 'unit_price', label: 'Unit price', kind: 'money', value: (l) => l.unit_price },
    { key: 'vat_rate', label: 'VAT', kind: 'number', value: (l) => `${Number(l.vat_rate)} %` },
    { key: 'amount', label: 'Amount', kind: 'money', value: (l) => l.amount },
  ]
  const taxed: Column<Taxed & { id: string }>[] = [
    { key: 'rate', label: 'VAT rate', kind: 'number', value: (t) => `${Number(t.rate)} %` },
    { key: 'base', label: 'Base', kind: 'money', value: (t) => t.base },
    { key: 'tax', label: 'VAT', kind: 'money', value: (t) => t.tax },
  ]
  const rates = $derived(data.taxed.map((t) => ({ ...t, id: t.rate })))
  const totals: Total[] = $derived([
    { label: 'Before VAT', value: data.net },
    ...(data.vat === null ? [] : [{ label: 'VAT', value: data.vat }]),
    { label: 'Total', value: data.total, total: true },
  ])
</script>

<Panel title="Lines" icon={icons.Receipt} count={data.lines.length} meta={money(data.total)}>
  <Table dense columns={lines} rows={data.lines} totals={rates.length > 1 ? [] : totals} />
  {#if rates.length > 1}<Table dense columns={taxed} rows={rates} {totals} />{/if}
</Panel>
