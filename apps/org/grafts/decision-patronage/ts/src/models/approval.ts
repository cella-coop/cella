// The decision approving a distribution's split, and where it stands.
export interface Approval {
  id: string
  distribution: string
  year: number
  decision: string
  title: string
  closed: string | null
  approved: string | null
}
