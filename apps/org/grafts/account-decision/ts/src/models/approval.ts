// The decision approving an allocation's split, and where it stands.
export interface Approval {
  id: string
  allocation: string
  year: number
  decision: string
  title: string
  closed: string | null
  allocated: string | null
}
