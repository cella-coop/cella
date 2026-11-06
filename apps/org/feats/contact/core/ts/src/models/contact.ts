export type Kind = 'company' | 'person'

// The client role's lifecycle: a contact that is no client has none.
export type Stage = 'lead' | 'active' | 'inactive'
export const stages: Stage[] = ['lead', 'active', 'inactive']

export interface Address {
  street: string
  city: string
  region?: string
  postal_code: string
  // ISO 3166-1 alpha-2.
  country: string
}

// A contact as the feat reads it. `client` is the client role's stage,
// null for a contact the co-op does not bill.
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
  client: Stage | null
  archived: boolean
}

// The fields a write may set; each is its own register, the client role
// among them, set to a stage or cleared with null.
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
  client?: Stage | null
  archived?: boolean
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
