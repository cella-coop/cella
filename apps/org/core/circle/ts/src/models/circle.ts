// The id of a procedure the motion feat holds: consent, majority, two
// thirds or one of the co-op's own.
export type Procedure = string

// A circle as the feat reads it: none is within another, and one only
// is the assembly.
export interface Circle {
  id: string
  name: string
  assembly: boolean
  purpose: string
  procedure: Procedure
}

// `circle` is one circle, or `*` for a role every working circle has.
export interface Role {
  id: string
  circle: string
  name: string
  duty: string
}

// A grant of one power to one grantee, here a role of the circle: the
// values of the mandate policy that grants it, which it names by its id;
// amounts in cents.
export interface Mandate {
  id: string
  grantee: string
  power: string
  policy: string
  limit: number | null
  budget: number | null
  per: 'month' | 'year' | null
  // What it covers: a circle's id, `own`, the circle its holder holds
  // the role in, or null, the whole co-op.
  scope: string | null
  issuer: string
  from: string
  until: string | null
  revoked: string | null
}


export interface Detail extends Circle {
  // The circles that issued what this circle and its roles hold, and
  // those it issued to: how the mandates link it to the others, since
  // circles never nest.
  issuers: { id: string; name: string }[]
  issued: { id: string; name: string }[]
  roles: Role[]
  // The mandates granted to its roles, as the Mandates collection reads
  // them.
  mandates: Standing[]
}

// A circle someone may work for, as a form offers it.
export interface Sat {
  id: string
  name: string
}

// A circle the co-op selector offers as a lens, whether it is the
// assembly, the co-op's root, which is no lens, whether the member sits
// in it, and its features spelt as one listing (`circle.features`).
export interface Lens {
  id: string
  name: string
  assembly: boolean
  sits: boolean
  features: string
}

// The circles a person sits in as a form offers them, the one a record
// would be worked for first where they sit in it, the others in turn.
export const offering = (sat: Sat[], first: string | null): Sat[] => [
  ...sat.filter((c) => c.id === first),
  ...sat.filter((c) => c.id !== first),
]

// A circle to create, by the motion that creates it, which the write
// cites.
export interface Create {
  id: string
  name: string
  purpose: string
  motion: string
}

// What a circle may be changed in, by the motion that amends it: its
// name, its purpose, its procedure and its features, each left as it is
// where none is given. Its features are one listing, in the circle's
// order, an accordion's run after its name and a colon, the runs
// separated by semicolons: `Books: account, transaction; contact`.
export interface Terms {
  name?: string | null
  purpose?: string | null
  procedure?: Procedure | null
  features?: string | null
}

// A circle to amend, by the motion that changes it, which the write cites.
export interface Amend extends Terms {
  circle: string
  motion: string
}

// The circle amended and what each term it changed was.
export interface Amended {
  circle: string
  was: Terms
}

// What a role may be changed in, by the motion that amends it: its name,
// its duty and its cap, each left as it is where none is given; a cap
// given as null is none, which lifts the role's.
export interface Duties {
  name?: string | null
  duty?: string | null
  holders?: number | null
}

// A role to make in a circle, or in every working circle (`*`), by the
// motion that makes it, which the write cites; no cap, uncapped. It names
// no id: the make takes one from its name (`circle.role_key`).
export interface Make {
  circle: string
  name: string
  duty: string
  holders: number | null
  motion: string
}

// A role to amend, by the motion that changes it, which the write cites.
export interface Remake extends Duties {
  role: string
  motion: string
}

// The role amended and what each term it changed was.
export interface Remade {
  role: string
  was: Duties
}

// The circle created and the default bundle it holds from its first day:
// the mandates on the roles every circle has, in force that day, by id.
export interface Created {
  circle: string
  bundle: number[]
}

// A mandate as its page and the Mandates collection read it: its grant,
// the circle its grantee is of, none for a role every working circle
// has, and whether it stands on the verdict date, is yet to be, or has
// ended, by its revocation or its term, and since when.
export interface Standing extends Mandate {
  granteeName: string
  // The issuer's name, and the name of the circle its scope covers, none
  // for `own` or the whole co-op.
  issuerName: string
  scopeName: string | null
  circle: string | null
  procedure: string | null
  parent: string | null
  state: 'stands' | 'pending' | 'revoked' | 'expired'
  since: string
}

// A mandate at a depth: down its chain, the root's 0, or below the
// mandate it is issued under, its own 0.
export type Depth = Standing & { depth: number }

// A mandate's page: the mandate, its chain from the root the assembly
// issued down to itself, and every mandate issued under it, down its
// provenance tree, each with its depth below it; and whether the links
// above the highest one the reader reads are withheld from them, that
// link's parent one they do not read.
export interface Provenance extends Standing {
  chain: Depth[]
  under: Depth[]
  withheld: boolean
}
