// A device a member enrols for their own address: its public key in hex,
// generated on the device, whose private key never leaves it.
export interface Enrol {
  address: string
  label: string
  key: string
}

export interface Enrolled {
  address: string
  label: string
  key: string
  enrolled: string
}

// A device, by its public key in hex, that its member revokes from
// another of their devices.
export interface Revoke {
  key: string
}

export interface Revoked {
  key: string
  revoked: string
}
