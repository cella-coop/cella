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

// The fields a client write may set; each is its own register.
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

// Which fields a write changed; the log commits to these names, never to
// the values, which may be a person's.
export interface Changed {
  client: string
  fields: string[]
}
