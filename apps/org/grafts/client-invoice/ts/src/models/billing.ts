// Whom an invoice bills, and the clients it may be linked to.
export interface Billed {
  client: { id: string; name: string } | null
  clients: { id: string; name: string }[]
}

// An invoice a client is billed by, amounts in cents.
export interface Bill {
  id: string
  label: string
  issued: string
  total: number
  owed: number
  state: string
}

// What a client owes and is owed back, from its invoices' standing.
export interface Owing {
  owed: number
  credit: number
}
