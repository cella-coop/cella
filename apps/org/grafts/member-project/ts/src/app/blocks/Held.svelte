<script lang="ts">
  import { Section, Table, type Column } from '@cella/org-ui'
  import type { Held } from '../../models/share.ts'

  // The shares of project budgets this member may spend.
  let { data }: { data: Held[]; id: string } = $props()

  const columns: Column<Held>[] = [
    { key: 'title', label: 'Project', kind: 'title', value: (h) => h.title },
    { key: 'amount', label: 'Share', kind: 'money', value: (h) => h.amount },
    { key: 'granted', label: 'Granted', kind: 'date', value: (h) => h.granted },
  ]
</script>

{#if data.length}
  <Section title="Budget shares" count={data.length}>
    <Table {columns} rows={data} href={(h: Held) => `/projects/${h.project}`} />
  </Section>
{/if}
