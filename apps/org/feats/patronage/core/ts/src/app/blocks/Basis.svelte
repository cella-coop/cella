<script lang="ts">
  import { Section, Table, money, type Column } from '@cella/org-ui'
  import type { Line, Sheet } from '../../models/statement.ts'

  // A worker's part of the year's work share, basis by basis: what it
  // divides by for them, the weight the terms give the basis, the whole
  // portion it divides and their part of it; the parts add up to theirs.
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

<Section title="Work share, by basis" count={data.lines.length}>
  <Table {columns} rows={data.lines} />
</Section>
