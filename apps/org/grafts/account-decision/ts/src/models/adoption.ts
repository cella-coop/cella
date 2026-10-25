// A decision of the members that moves to adopt the capital's terms,
// and where each stands.
export interface Adoption {
  id: string
  terms: string
  from: number
  decision: string
  title: string
  closed: string | null
  adopted: string | null
}
