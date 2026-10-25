<script lang="ts">
  import { Section, Stats, Table, type Column } from '@cella/org-ui'
  import type { Billed, Invoiced } from '../../models/charge.ts'

  // The invoices that bill this project's work, and what they bill net.
  let { data }: { data: Invoiced; id: string } = $props()

  const columns: Column<Billed>[] = [
    { key: 'id', label: 'Invoice', kind: 'title', value: (i) => i.id },
    { key: 'label', label: 'Label', value: (i) => i.label },
    { key: 'issued', label: 'Issued', kind: 'date', value: (i) => i.issued },
    { key: 'net', label: 'Net', kind: 'money', value: (i) => i.net },
    { key: 'voided', label: 'Voided', kind: 'date', value: (i) => i.voided },
  ]
</script>

<Section title="Invoices" count={data.invoices.length}>
  <Stats items={[{ label: 'Net', value: data.net, kind: 'money' }]} />
  <Table {columns} rows={data.invoices} href={(i: Billed) => `/invoices/${i.id}`} />
</Section>
