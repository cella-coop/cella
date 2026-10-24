import type { Device } from '@cella/org-key/models'

// An invitation that carries the invitee's first device: the public key
// in hex their device made, whose private key never leaves it, and the
// label they gave the device.
export interface Invite {
  address: string
  name: string
  key: string
  label: string
}

// A first device waiting on its member's admission, or enrolled by it.
export interface First {
  key: string
  label: string
  enrolled: string | null
}

// A member's keys on their page: the first device their invitation
// carried, and every device enrolled under their address.
export interface Keys {
  first: First | null
  devices: Device[]
}
