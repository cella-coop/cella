import type { Device } from '@cella/org-key/models'
import type { Hire } from '@cella/org-worker/models'

// A hire that carries the worker's first device: the public key in hex
// their device made, whose private key never leaves it, and the label
// they gave the device.
export interface Hiring extends Hire {
  key: string
  label: string
}

// A worker's devices on their page, every one enrolled under their
// address.
export interface Keys {
  devices: Device[]
}
