<script lang="ts">
  import { Section, Table, type Column } from '@cella/org-ui'

  // The work share's portion by time worked, as it would divide by each
  // member's approved hours that year; the parts add up to the portion
  // to the cent. Once approved, the parts are the statements'.
  type Part = { id: string; member: string; minutes: number; amount: number }
  let { data }: { data: Part[]; id: string } = $props()

  const columns: Column<Part>[] = [
    { key: 'member', label: 'Member', kind: 'mono', value: (p) => p.member },
    { key: 'hours', label: 'Hours approved', kind: 'number', value: (p) => Math.round(p.minutes / 6) / 10 },
    { key: 'amount', label: 'Part', kind: 'money', value: (p) => p.amount },
  ]
</script>

{#if data.length}
  <Section title="Work share by time worked, as it would divide" count={data.length}>
    <Table {columns} rows={data} href={(p: Part) => `/people/${p.member}`} />
  </Section>
{/if}
