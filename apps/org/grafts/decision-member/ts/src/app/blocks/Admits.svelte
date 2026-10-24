<script lang="ts">
  import { Section, Table, type Column } from '@cella/org-ui'
  import type { Admission } from '../../models/admission.ts'

  // Whom the decision admits, with the shares each subscribes: what is
  // being decided, when it is an admission.
  let { data }: { data: Admission[]; id: string } = $props()

  const columns: Column<Admission>[] = [
    { key: 'name', label: 'Member', kind: 'title', value: (a) => a.name ?? a.member },
    { key: 'member', label: 'Address', kind: 'mono', value: (a) => a.member },
    { key: 'shares', label: 'Shares', kind: 'number', value: (a) => a.shares },
  ]
</script>

{#if data.length}
  <Section title="Admits" count={data.length}>
    <Table {columns} rows={data} href={(a: Admission) => `/members/${a.member}`} />
  </Section>
{/if}
