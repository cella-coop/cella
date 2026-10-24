import { icons, type App } from '@cella/org-ui'
import Devices from './blocks/Devices.svelte'
import { columns } from './views/devices.ts'

// The feat's client side: the devices collection, and a block listing one
// address's devices, which the root mounts on a member's page.
export const app: App = {
  name: 'key',
  collections: {
    devices: {
      view: { group: 'platform', title: 'Devices', icon: icons.SealCheck, columns, linked: false },
    },
  },
}

export { Devices }
