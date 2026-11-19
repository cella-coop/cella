// The id of a procedure the motion feat holds: consent, majority, two
// thirds or one of the coop's own.
export type Procedure = string

// A circle as the feat reads it: none is within another, and one only
// is the assembly.
export interface Circle {
  id: string
  name: string
  assembly: boolean
  purpose: string
  procedure: Procedure
  // Its own icon, a slug of the curated set, replacing the collection's;
  // none wears the collection's instead.
  icon: string | null
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
  // the role in, or null, the whole coop.
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

// A circle the coop selector offers as a lens, whether it is the
// assembly, the coop's root, which is no lens, whether the member sits
// in it, and its features spelt as one listing (`circle.features`).
export interface Lens {
  id: string
  name: string
  assembly: boolean
  sits: boolean
  features: string
  // Its own icon, a slug of the curated set, which a reference elsewhere
  // (a cell, a chip, a group's bar) wears in place of the collection's.
  icon: string | null
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
// name, its purpose and its procedure, each left as it is where none is
// given. Its features are arranged apart (`Arrange`).
export interface Terms {
  name?: string | null
  purpose?: string | null
  procedure?: Procedure | null
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

// The coop's layout of features arranged at its root, `circle`,
// replaced by one listing in its order, each feature under a group, a
// group's run after its name and a colon, the runs separated by
// semicolons: `Books: account, transaction; Work: project`. By the motion
// it cites, of a circle holding `arrange-features` over the root, or,
// with none, at once by a holder of it over the root.
export interface Arrange {
  circle: string
  features: string
  motion?: string
}

// The root arranged, the ids its groups keep, in its order, and the
// listing the layout replaced.
export interface Arranged {
  circle: string
  groups: string[]
  was: string
}

// A group of the layout a circle other than the root shows or not, by
// its id, by the motion it cites or, with none, at once by a holder of
// `arrange-features` over the circle.
export interface Show {
  circle: string
  group: string
  shown: boolean
  motion?: string
}

// A feature of the layout a circle other than the root hides or not, as
// a group is shown.
export interface Hide {
  circle: string
  feature: string
  hidden: boolean
  motion?: string
}

// A group shown or not, and whether the circle showed it before.
export interface Shown extends Show {
  was: boolean
}

// A feature hidden or not, and whether the circle hid it before.
export interface Hidden extends Hide {
  was: boolean
}

// A circle's own icon, set or cleared at once by a holder of
// `arrange-features` over it, the same power that arranges its features.
export interface Icon {
  circle: string
  // A slug of the curated set, or none, which clears it.
  icon: string | null
}

export type Iconed = Icon

// What a role may be changed in, by the motion that amends it: its name,
// its duty and its cap, each left as it is where none is given; a cap
// given as null is none, which lifts the role's.
export interface Duties {
  name?: string | null
  duty?: string | null
  holders?: number | null
}

// A role to make in a circle, or in every working circle (`*`), by the
// motion that makes it, which the write cites; no cap, uncapped. Its id
// is the one the motion's proposal took from its name (`circle.role_key`).
export interface Make {
  id: string
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
  // for `own` or the whole coop.
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
