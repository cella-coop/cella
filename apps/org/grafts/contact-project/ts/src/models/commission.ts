export interface Named {
  id: string
  name: string
}

// Whom a project is for, and the clients it may be linked to: the
// contacts holding the client role, archived ones left out.
export interface For {
  contact: Named | null
  contacts: Named[]
}

// A project a contact commissioned.
export interface Commissioned {
  id: string
  title: string
  started: string
  due: string | null
  budget: number | null
}
