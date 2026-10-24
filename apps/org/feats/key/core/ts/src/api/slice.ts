import type { Slice } from '@cella/org-db'
import { devices } from '../drivers/device.ts'

// The feat's server side as the shell mounts it: every device, listed.
// Enrolling and revoking sign from a member's own device, which the dev
// shell does not hold, so neither is offered here.
export const slice: Slice = {
  name: 'key',
  collections: {
    devices: { list: (db) => devices(db) },
  },
}
