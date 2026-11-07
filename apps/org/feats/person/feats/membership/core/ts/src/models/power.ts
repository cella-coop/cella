// A power a person holds on the verdict date and what through: a seat's
// mandate, in the circle of the seat it is held by, by the tenure that
// holds its role, or by the seat alone for the participant's; or a right
// the form gives every person, member or employee. Amounts in cents.
export interface Power {
  id: string
  power: string
  // By a seat: the mandate, its circle, its role and the tenure that holds
  // it, none for the participant's every seat holds.
  mandate: string | null
  circle: string | null
  circleName: string | null
  role: string | null
  roleName: string | null
  tenure: string | null
  since: string | null
  until: string | null
  limit: number | null
  budget: number | null
  per: 'month' | 'year' | null
  scope: string | null
  // The name of the circle a scope names, none for `own` or no scope.
  scopeName: string | null
  // By a right: whom the form gives it.
  right: 'person' | 'member' | 'employee' | null
}
