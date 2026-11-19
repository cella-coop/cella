<script lang="ts">
  import { icons, Panel, Table, type Column } from '@cella/org-ui'
  import type { Line, Run } from '../../models/run.ts'

  // What each line of the file came to: the write it made and how, with
  // the guard's reason where it was refused.
  let { data }: { data: Run; id: string } = $props()

  // The table keys its rows by id: a line's is its number.
  const rows = $derived(data.lines.map((l) => ({ ...l, id: String(l.line) })))
  const tones = { settled: 'positive', pending: 'accent', refused: 'negative', failed: 'warning' } as const
  const columns: Column<Line>[] = [
    { key: 'line', label: 'Line', kind: 'number', value: (l) => l.line },
    { key: 'label', label: 'What', value: (l) => l.label },
    { key: 'op', label: 'Write', kind: 'mono', value: (l) => l.op },
    { key: 'state', label: 'Outcome', kind: 'badge', value: (l) => l.state, tone: (l) => tones[l.state] },
    { key: 'why', label: 'Entry or reason', value: (l) => (l.entry ? `entry ${l.entry}` : (l.reason ?? '')) },
  ]
</script>

<Panel
  title={data.dry ? 'What it would make' : 'What it made'}
  icon={icons.FileArrowUp}
  count={data.lines.length}
  meta={[`${data.settled} settled`, data.refused ? `${data.refused} refused` : null]}
>
  <Table dense {columns} {rows} />
</Panel>
