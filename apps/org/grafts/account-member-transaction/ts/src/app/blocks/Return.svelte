<script lang="ts">
  import { Button, Note, Section, Table, money, type Column } from '@cella/org-ui'
  import type { Figure } from '../../models/patronage.ts'

  // A year's return to the federation: each figure, the law it answers
  // to and whether that was checked, and the whole as CSV to file.
  let { data, id }: { data: Figure[]; id: string } = $props()

  const shown = (f: Figure) => (f.unit === 'cents' ? money(Number(f.value)) : f.unit === 'percent' ? `${f.value} %` : (f.value ?? ''))
  const columns: Column<Figure>[] = [
    { key: 'label', label: 'Figure', value: (f) => f.label },
    { key: 'value', label: 'Value', value: shown },
    { key: 'source', label: 'Source', value: (f) => f.source },
    { key: 'verified', label: 'Checked', kind: 'badge', value: (f) => (f.verified ? 'checked' : 'unverified'), tone: (f) => (f.verified ? 'positive' : 'warning') },
  ]
  const cell = (v: unknown) => `"${String(v ?? '').replaceAll('"', '""')}"`
  const csv = $derived(
    [
      ['figure', 'label', 'value', 'unit', 'source', 'checked'],
      ...data.map((f) => [f.id, f.label, f.unit === 'cents' ? (Number(f.value) / 100).toFixed(2) : f.value, f.unit === 'cents' ? 'EUR' : f.unit, f.source, f.verified ? 'yes' : 'no']),
    ]
      .map((row) => row.map(cell).join(','))
      .join('\r\n'),
  )
</script>

{#if data.length}
  <Section title="Return to the federation" count={data.length}>
    <Table {columns} rows={data} />
    <Note text="Which figures the CG SCOP’s annual return and the révision coopérative ask for is not verified against their forms; the figures marked unverified are offered, not required." />
    <Button href={`data:text/csv;charset=utf-8,${encodeURIComponent(csv)}`} download={`${id}-return.csv`}>Export CSV</Button>
  </Section>
{/if}
