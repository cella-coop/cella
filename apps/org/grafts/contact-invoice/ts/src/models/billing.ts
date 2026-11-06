// Whom an invoice bills, and the contacts it may be linked to.
export interface Billed {
  contact: { id: string; name: string } | null
  contacts: { id: string; name: string }[]
}

// An invoice a contact is billed by, amounts in cents.
export interface Bill {
  id: string
  label: string
  issued: string
  total: number
  owed: number
  state: string
}

// What a contact owes and is owed back, from its invoices' standing.
export interface Owing {
  owed: number
  credit: number
}
