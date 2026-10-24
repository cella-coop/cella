<script lang="ts">
  import { Section, Table, type Column } from '@cella/org-ui'
  import type { Detail, Part } from '../../models/allocation.ts'

  // The split as the statutes set it: each share, its percent and its
  // amount, which add up to the surplus.
  let { data }: { data: Detail; id: string } = $props()

  const names: Record<Part['kind'], string> = {
    work: 'Work share, to the workers',
    legal: 'Legal reserve',
    development: 'Development fund',
    interest: 'Interest on capital',
  }
  const columns: Column<Part>[] = [
    { key: 'kind', label: 'Share', value: (p) => names[p.kind] },
    { key: 'percent', label: '%', kind: 'number', value: (p) => p.percent },
    { key: 'amount', label: 'Amount', kind: 'money', value: (p) => p.amount },
  ]
</script>

<Section title="Split" count={data.shares.length}>
  <Table {columns} rows={data.shares} />
</Section>
