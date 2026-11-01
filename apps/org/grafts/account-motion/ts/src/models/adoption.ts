// A motion of the members that moves to adopt the capital's terms,
// and where each stands.
export interface Adoption {
  id: string
  terms: string
  from: number
  motion: string
  title: string
  closed: string | null
  adopted: string | null
}
