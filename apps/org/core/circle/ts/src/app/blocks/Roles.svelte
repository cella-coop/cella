<script lang="ts">
  import { Button, icons, Panel, Table, type Column } from '@cella/org-ui'
  import type { Detail, Role } from '../../models/circle.ts'

  // The circle's roles, each with its duty, and how many mandates grant
  // them powers, summarising its Roles tab, where they are laid out with
  // their mandates and seats, which its footer opens. The circle's
  // overview panel.
  let { data, id }: { data: Detail; id: string } = $props()

  const columns: Column<Role>[] = [
    { key: 'name', label: 'Role', kind: 'title', value: (r) => r.name },
    { key: 'duty', label: 'Duty', value: (r) => r.duty },
  ]
</script>

{#snippet open()}
  <Button href="/circles/{id}?tab=roles" lead={icons.ArrowRight}>Open the roles</Button>
{/snippet}

<Panel
  title="Roles"
  icon={icons.TreeStructure}
  count={data.roles.length}
  meta={`${data.mandates.length} ${data.mandates.length === 1 ? 'mandate' : 'mandates'}`}
  actions={data.roles.length ? open : undefined}
>
  <Table dense {columns} rows={data.roles} empty="No roles yet" />
</Panel>
