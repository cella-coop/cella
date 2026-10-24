// Which project an invoice bills, and the projects it may name.
export interface Charged {
  project: { id: string; title: string } | null
  projects: { id: string; title: string }[]
}

// An invoice of a project's, amounts in cents.
export interface Billed {
  id: string
  label: string
  issued: string
  net: number
  voided: string | null
}

// A project's invoices, and what they invoiced net of voids.
export interface Invoiced {
  invoices: Billed[]
  net: number
}
