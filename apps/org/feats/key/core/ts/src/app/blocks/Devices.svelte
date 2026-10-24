<script lang="ts">
  import { Section, Table } from '@cella/org-ui'
  import type { Device } from '../../models/key.ts'
  import { columns } from '../views/devices.ts'

  // An address's devices: the keys that sign its writes.
  let { data }: { data: Device[]; id: string } = $props()
  const shown = columns.filter((c) => c.key !== 'address')
</script>

<Section title="Devices" count={data.length}>
  <Table columns={shown} rows={data} />
</Section>
