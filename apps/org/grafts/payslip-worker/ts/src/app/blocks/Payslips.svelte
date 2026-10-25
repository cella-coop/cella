<script lang="ts">
  import { Section, Table, type Column } from '@cella/org-ui'
  import type { Pay } from '../../models/pay.ts'

  // A worker's payslips, month by month.
  let { data }: { data: Pay; id: string } = $props()

  type Row = Pay['payslips'][number]
  const columns: Column<Row>[] = [
    { key: 'month', label: 'Month', value: (p) => p.month },
    { key: 'gross', label: 'Gross', kind: 'money', value: (p) => p.gross },
    { key: 'net', label: 'Net', kind: 'money', value: (p) => p.net },
    { key: 'state', label: 'Run', kind: 'badge', value: (p) => p.state },
  ]
</script>

{#if data.payslips.length}
  <Section title="Payslips" count={data.payslips.length}>
    <Table {columns} rows={data.payslips} href={(p: Row) => `/payslips/${p.id}`} />
  </Section>
{/if}
