export interface Named {
  id: string
  name: string
}

// Whom a project is for, and the contacts it may be linked to.
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
