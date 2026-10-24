<script lang="ts">
  import { Section, Table, type Column } from '@cella/org-ui'

  // The work share, member by member, in proportion to what each was paid
  // in the surplus's year; the parts add up to the share to the cent.
  type Part = { id: string; member: string; basis: number; amount: number }
  let { data }: { data: Part[]; id: string } = $props()

  const columns: Column<Part>[] = [
    { key: 'member', label: 'Member', kind: 'mono', value: (p) => p.member },
    { key: 'basis', label: 'Paid that year', kind: 'money', value: (p) => p.basis },
    { key: 'amount', label: 'Work share', kind: 'money', value: (p) => p.amount },
  ]
</script>

{#if data.length}
  <Section title="Work share, by salary" count={data.length}>
    <Table {columns} rows={data} href={(p: Part) => `/members/${p.member}`} />
  </Section>
{/if}
