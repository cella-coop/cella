// Where a distribution stands in the books: the entry that posted it, if
// it was distributed, and whether it waits on its posting.
export interface Posted {
  entry: string | null
  approved: boolean
  distributed: boolean
}
