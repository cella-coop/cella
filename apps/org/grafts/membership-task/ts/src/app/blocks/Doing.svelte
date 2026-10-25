<script lang="ts">
  import { Section, Table, type Column } from '@cella/org-ui'
  import type { Doing } from '../../models/assignment.ts'

  // The tasks this member does that are not done yet.
  let { data }: { data: Doing[]; id: string } = $props()

  const columns: Column<Doing>[] = [
    { key: 'title', label: 'Task', kind: 'title', value: (t) => t.title },
    { key: 'priority', label: 'Priority', kind: 'badge', value: (t) => t.priority },
    { key: 'due', label: 'Due', kind: 'date', value: (t) => t.due },
    { key: 'status', label: 'Status', kind: 'badge', value: (t) => t.status },
  ]
</script>

<Section title="Tasks" count={data.length}>
  <Table {columns} rows={data} href={(t: Doing) => `/tasks/${t.id}`} />
</Section>
