<script lang="ts">
  import { Section, Table, type Column } from '@cella/org-ui'
  import type { Claim } from '../../models/claim.ts'

  // What a member spent for the co-op, and where each claim stands.
  let { data }: { data: Claim[]; id: string } = $props()

  const columns: Column<Claim>[] = [
    { key: 'label', label: 'Expense', value: (c) => c.label },
    { key: 'day', label: 'Spent on', kind: 'date', value: (c) => c.day },
    { key: 'total', label: 'Amount', kind: 'money', value: (c) => c.total },
    { key: 'status', label: 'Status', kind: 'badge', value: (c) => c.status },
  ]
</script>

{#if data.length}
  <Section title="Expenses" count={data.length}>
    <Table {columns} rows={data} href={(c: Claim) => `/expenses/${c.id}`} />
  </Section>
{/if}
