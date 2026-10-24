<script lang="ts">
  import { Section, Table, type Column } from '@cella/org-ui'
  import type { Posted } from '../../models/posting.ts'

  // The entries the expense's approval and reimbursement posted.
  let { data }: { data: Posted[]; id: string } = $props()

  const columns: Column<Posted>[] = [
    { key: 'entry', label: 'Entry', kind: 'mono', value: (p) => p.entry },
    { key: 'event', label: 'Event', value: (p) => p.event },
    { key: 'date', label: 'Date', kind: 'date', value: (p) => p.date },
    { key: 'account', label: 'Account', kind: 'mono', value: (p) => p.account },
    { key: 'debit', label: 'Debit', kind: 'money', value: (p) => (p.side === 'debit' ? p.cents : null) },
    { key: 'credit', label: 'Credit', kind: 'money', value: (p) => (p.side === 'credit' ? p.cents : null) },
  ]
</script>

{#if data.length}
  <Section title="Postings" count={data.length}>
    <Table {columns} rows={data} href={(p: Posted) => `/transactions/${p.entry}`} />
  </Section>
{/if}
