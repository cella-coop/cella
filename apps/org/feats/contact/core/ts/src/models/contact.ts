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
// null for a contact the coop does not bill. A person contact's
// `person` is the address core person knows them by, and their name,
// email and phone are core's; a company's are its own.
export interface Contact {
  id: string
  kind: Kind
  person: string | null
  name: string
  form: string | null
  email: string | null
  phone: string | null
  parent: string | null
  tags: string[]
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
  client?: Stage | null
  archived?: boolean
}

// A company, by its own name, or a person, by the address `person`
// names: one the coop knows keeps their name, email and phone, and one
// new to it is brought in with those given here.
export interface Add extends Fields {
  id: string
  name: string
  person?: string
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

// A person contact erased, and the core person whose contact details
// were erased with them.
export interface Erased {
  contact: string
  person: string | null
}
