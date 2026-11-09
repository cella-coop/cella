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
// values of the mandate policy that grants it, and its sentence as it
// reads; amounts in cents.
export interface Mandate {
  id: string
  grantee: string
  power: string
  policy: string
  sentence: string
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

// What adopting or ending a policy did to the mandates: the mandate its
// policy grants or ended, none for a policy of another kind, and every
// mandate the write revoked, down the provenance tree from the one it
// ended or replaced, that one first.
export interface Granted {
  mandate: number | null
  revoked: number[]
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

// A circle the co-op selector offers as a lens, and whether the member
// sits in it.
export interface Lens {
  id: string
  name: string
  sits: boolean
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
  motion: string | null
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
