<script lang="ts">
  import { Section, Table, type Column } from '@cella/org-ui'
  import type { Commissioned } from '../../models/commission.ts'

  // The projects this client commissioned.
  let { data }: { data: Commissioned[]; id: string } = $props()

  const columns: Column<Commissioned>[] = [
    { key: 'title', label: 'Project', kind: 'title', value: (p) => p.title },
    { key: 'started', label: 'Started', kind: 'date', value: (p) => p.started },
    { key: 'due', label: 'Due', kind: 'date', value: (p) => p.due },
    { key: 'budget', label: 'Budget', kind: 'money', value: (p) => p.budget },
  ]
</script>

<Section title="Projects" count={data.length}>
  <Table {columns} rows={data} href={(p: Commissioned) => `/projects/${p.id}`} />
</Section>
