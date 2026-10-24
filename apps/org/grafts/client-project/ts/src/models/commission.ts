export interface Named {
  id: string
  name: string
}

// Whom a project is for, and the clients it may be linked to.
export interface For {
  client: Named | null
  clients: Named[]
}

// A project a client commissioned.
export interface Commissioned {
  id: string
  title: string
  started: string
  due: string | null
  budget: number | null
}
