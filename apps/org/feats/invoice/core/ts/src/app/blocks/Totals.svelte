<script lang="ts">
  import { Stats } from '@cella/org-ui'
  import type { Listed } from '../../models/invoice.ts'

  // What clients owe, what is overdue, and what the co-op owes back.
  let { rows }: { rows: Listed[]; about: unknown } = $props()

  const sum = (f: (i: Listed) => number) => rows.reduce((s, i) => s + f(i), 0)
  const owed = $derived(sum((i) => i.owed))
  const overdue = $derived(rows.filter((i) => i.overdue))
  const credit = $derived(sum((i) => i.credit))
</script>

<Stats
  items={[
    { label: 'Owed', value: owed, kind: 'money' },
    { label: 'Overdue', value: overdue.reduce((s, i) => s + i.owed, 0), kind: 'money', tone: overdue.length ? 'warning' : undefined },
    { label: 'Credit owed back', value: credit, kind: 'money' },
  ]}
/>
