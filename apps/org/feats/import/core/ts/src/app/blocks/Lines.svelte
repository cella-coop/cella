<script lang="ts">
  import { Section, Table, type Column } from '@cella/org-ui'
  import type { Line, Run } from '../../models/run.ts'

  // What each line of the file came to: the write it made and how, with
  // the rule's reason where it was refused.
  let { data }: { data: Run; id: string } = $props()

  const tones = { settled: 'positive', pending: 'accent', refused: 'negative', failed: 'warning' } as const
  const columns: Column<Line>[] = [
    { key: 'line', label: 'Line', kind: 'number', value: (l) => l.line },
    { key: 'label', label: 'What', value: (l) => l.label },
    { key: 'op', label: 'Write', kind: 'mono', value: (l) => l.op },
    { key: 'state', label: 'Outcome', kind: 'badge', value: (l) => l.state, tone: (l) => tones[l.state] },
    { key: 'why', label: 'Entry or reason', value: (l) => (l.entry ? `entry ${l.entry}` : (l.reason ?? '')) },
  ]
</script>

<Section title={data.dry ? 'What it would make' : 'What it made'} count={data.lines.length}>
  <Table {columns} rows={data.lines} />
</Section>
