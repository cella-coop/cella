<script lang="ts">
  import { icons, Panel, money, Table, type Column } from '@cella/org-ui'
  import type { Detail, Share } from '../../models/distribution.ts'

  // The split as the statutes set it: each share, its percent and its
  // amount, which add up to the surplus ruled off under them. The
  // overview's panel.
  let { data }: { data: Detail; id: string } = $props()

  const names: Record<Share['kind'], string> = {
    work: 'Work share, to the workers',
    legal: 'Legal reserve',
    development: 'Development fund',
    interest: 'Interest on capital',
  }
  const columns: Column<Share>[] = [
    { key: 'kind', label: 'Share', value: (p) => names[p.kind] },
    { key: 'percent', label: '%', kind: 'number', value: (p) => p.percent },
    { key: 'amount', label: 'Amount', kind: 'money', value: (p) => p.amount },
  ]
</script>

<Panel title="Split" icon={icons.ChartPie} meta="of {money(data.surplus)}">
  <Table dense {columns} rows={data.shares} totals={[{ label: 'Surplus', value: data.surplus, total: true }]} />
</Panel>
