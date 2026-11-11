// A person as core reads them; `id` is their address. Whether they are
// a member or a worker is the feats', membership's and employment's,
// which add their fields beside these.
export interface Person {
  id: string
  address: string
  name: string
  email: string | null
  phone: string | null
}

// Someone a child's write brings in, by the address they sign with: an
// invitation, or a hire. A person already known keeps their name.
export interface Enter {
  address: string
  name: string
}

// A person's own fields; only those given change. Email and phone are
// optional, and the person may erase them (`forget`).
export interface Profile {
  person: string
  name?: string
  email?: string | null
  phone?: string | null
}

// The fields a profile write changed: the log commits to their values,
// which are personal data, and keeps them in the vault.
export interface Profiled {
  person: string
  fields: string[]
}

// A person erases their own contact details.
export interface Forget {
  person: string
}
