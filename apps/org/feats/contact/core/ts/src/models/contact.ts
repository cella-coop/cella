export type Kind = 'company' | 'person'
export type Status = 'lead' | 'active' | 'inactive' | 'archived'

export interface Address {
  street: string
  city: string
  region?: string
  postal_code: string
  // ISO 3166-1 alpha-2.
  country: string
}

// A contact as the feat reads it.
export interface Contact {
  id: string
  kind: Kind
  name: string
  form: string | null
  email: string | null
  phone: string | null
  parent: string | null
  tags: string[]
  note: string
  status: Status
}

// The fields a contact write may set; each is its own register.
export interface Fields {
  kind?: Kind
  name?: string
  form?: string | null
  email?: string | null
  phone?: string | null
  address?: Address | null
  parent?: string | null
  tags?: string[]
  note?: string
  status?: Status
}

export interface Add extends Fields {
  id: string
  name: string
}

export interface Update {
  id: string
  fields: Fields
}

export interface Archive {
  id: string
}

// A person among the contacts whose contact data is erased.
export interface Erase {
  id: string
}

// Which fields a write changed; the log commits to them and their values,
// a person's under fresh salts, the values themselves in the vault.
export interface Changed {
  contact: string
  fields: string[]
}
