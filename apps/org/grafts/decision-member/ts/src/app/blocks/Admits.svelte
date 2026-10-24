<script lang="ts">
  import { Section, Table, type Column } from '@cella/org-ui'
  import { verbs, type Asked } from '../../models/admission.ts'

  // What the decision asks of members: whom it admits, with the shares
  // each subscribes, whom it suspends or lets go.
  let { data }: { data: Asked[]; id: string } = $props()

  const columns: Column<Asked>[] = [
    { key: 'name', label: 'Member', kind: 'title', value: (a) => a.name ?? a.member },
    { key: 'kind', label: 'It', value: (a) => verbs[a.kind] },
    { key: 'member', label: 'Address', kind: 'mono', value: (a) => a.member },
    { key: 'shares', label: 'Shares', kind: 'number', value: (a) => a.shares },
  ]
</script>

{#if data.length}
  <Section title="Members" count={data.length}>
    <Table {columns} rows={data} href={(a: Asked) => `/members/${a.member}`} />
  </Section>
{/if}
