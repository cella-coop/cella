<script lang="ts">
  import { icons, Panel, Table, money, type Column } from '@cella/org-ui'
  import type { Line, Sheet } from '../../models/statement.ts'

  // A worker's part of the year's work share, basis by basis: what it
  // divides by for them, the weight the terms give the basis, the whole
  // portion it divides and their part of it; the parts add up to theirs,
  // ruled off under them. The statement's overview panel.
  let { data }: { data: Sheet; id: string } = $props()

  const names: Record<Line['basis'], string> = { salary: 'By pay', hours: 'By time worked', equal: 'In equal parts' }
  const quantity = (l: Line) =>
    l.basis === 'salary' ? `${money(l.quantity)} paid` : l.basis === 'hours' ? `${Math.round(l.quantity / 6) / 10} h approved` : 'one part'
  const columns: Column<Line>[] = [
    { key: 'basis', label: 'Basis', value: (l) => names[l.basis] },
    { key: 'quantity', label: 'Their basis', value: quantity },
    { key: 'weight', label: 'Weight %', kind: 'number', value: (l) => l.weight },
    { key: 'portion', label: 'Portion', kind: 'money', value: (l) => l.portion },
    { key: 'amount', label: 'Their part', kind: 'money', value: (l) => l.amount },
  ]
</script>

<Panel title="Work share, by basis" icon={icons.ChartPie} count={data.lines.length}>
  <Table dense {columns} rows={data.lines} totals={[{ label: 'Their part', value: data.amount, total: true }]} />
</Panel>
