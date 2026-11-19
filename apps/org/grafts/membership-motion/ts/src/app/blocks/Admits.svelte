<script lang="ts">
  import { icons, Panel, Table, type Column } from '@cella/org-ui'
  import { verbs, type Asked, type OnMotion } from '../../models/admission.ts'

  // What the motion asks of members: whom it admits, with the shares
  // each subscribes, whom it suspends or lets go.
  let { data }: { data: OnMotion; id: string } = $props()

  const columns: Column<Asked>[] = [
    { key: 'member', label: 'Member', kind: 'person', value: (a) => a.member },
    { key: 'kind', label: 'Asks', value: (a) => verbs[a.kind] },
    { key: 'shares', label: 'Shares', kind: 'number', value: (a) => a.shares },
  ]
</script>

{#if data.asked.length}
  <Panel title="Members" icon={icons.Users} count={data.asked.length}>
    <Table dense {columns} rows={data.asked} href={(a: Asked) => `/people/${a.member}`} />
  </Panel>
{/if}
