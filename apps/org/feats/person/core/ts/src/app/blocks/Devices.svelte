<script lang="ts">
  import { Section, Table } from '@cella/org-ui'
  import type { Device } from '../../models/device.ts'
  import { columns } from '../views/devices.ts'

  // A person's devices: the keys that sign their writes.
  let { data }: { data: { devices: Device[] }; id: string } = $props()
  const shown = columns.filter((c) => c.key !== 'address')
</script>

<Section title="Devices" count={data.devices.length}>
  <Table columns={shown} rows={data.devices} />
</Section>
