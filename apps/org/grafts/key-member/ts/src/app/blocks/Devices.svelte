<script lang="ts">
  import { Devices } from '@cella/org-key/app'
  import type { Keys } from '../../models/index.ts'

  // A member's devices, the keys that sign their writes, as the key feat
  // lists an address's.
  let { data, id }: { data: Keys; id: string } = $props()
</script>

<Devices data={data.devices} {id} />
