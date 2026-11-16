// What a member's or a circle's page proposes: a membership admitted,
// suspended or excluded, or a seat given or ended, each an action of the
// graft that carries it out.
export type Asked = 'admit' | 'suspend' | 'exclude' | 'seat' | 'unseat'

export interface Asking {
  kind: Asked
  args: Record<string, string | number>
  deadline: string
  body: string
}

// The circle a proposal goes to.
export interface Decider {
  id: string
  name: string
  procedure: string
}

// On a member's page: what may be proposed of their membership, as it
// stands, and the open motions about them. On one's own page, with no
// membership or only invited, whether one may apply: an employee who has
// not, the motion's deadline starting two weeks on.
export interface Standing {
  member: string
  status: 'invited' | 'active' | 'suspended' | 'exited' | null
  applied: string | null
  own: boolean
  employee: boolean
  until: string
  decider: Decider
  open: { motion: string; title: string; deadline: string }[]
}

// On a circle's page: whom a motion may seat in it and in which role,
// the seats held that one may end, and the circle that decides.
export interface Appointing {
  circle: string
  decider: Decider
  members: { id: string; name: string }[]
  roles: { id: string; name: string }[]
  seats: { id: string; label: string; member: string; role: string | null }[]
}

// An employee's application to join, by their own right: the shares they
// pledge, and the deadline and the reasons of the motion it puts to the
// assembly.
export interface Applying {
  member: string
  shares: number
  deadline: string
  body: string
}

// On a circle's Settings tab: its name, purpose and procedure in force,
// the procedures in force it may take, the circle that decides its
// amendment and the deadline asked, two weeks on, why no write of the
// reader's changes them or makes a role, the roles below them, and the
// name of the circle that arranges its features.
export interface Amending {
  circle: string
  name: string
  purpose: string
  procedure: string
  procedures: { value: string; label: string }[]
  decider: { circle: string; name: string; deadline: string }
  refused: string
  making: string
  roles: Duty[]
  arranger: string
}

// A role on a circle's Settings tab: its circle, `*` for every working
// circle, its name, duty and cap, none an empty one; the circle that
// decides its amendment, and why no write of the reader's changes it.
export interface Duty {
  role: string
  circle: string
  name: string
  duty: string
  holders: string
  decider: { circle: string; name: string; deadline: string }
  refused: string
}

// A circle's page as the graft reads it: whom a motion may seat there,
// and its terms as its Settings tab shows them.
export interface OnCircle extends Appointing {
  amending: Amending
}

// The co-op's particulars, as core's row keeps them, in the order the
// Organization page shows them and the founding words them.
export const particulars = ['name', 'legal_name', 'form', 'capital', 'seat', 'siren', 'rcs', 'vat'] as const
export type Particular = (typeof particulars)[number]
export type Particulars = Record<Particular, string | null> & { policy: string }

// Settings' Organization page: the particulars in force, if a rule
// stands, and the procedure protecting it; the assembly, which alone
// adopts them, and the deadline asked, two weeks on; why no write of the
// reader's changes them; and the scope's address and timezone, which a
// host sets.
export interface Organization {
  particulars: Particulars | null
  protected: string | null
  decider: { circle: string; name: string; deadline: string } | null
  refused: string
  scope: string | null
  timezone: string | null
}

// A circle's features page in Settings: its features in force, spelt as
// one listing (`circle.features`), every feature the co-op installed, by
// its schema, whether the reader arranges them at once, the circle whose
// motion arranges them otherwise, and why no write of the reader's
// changes them.
export interface Featuring {
  circle: string
  name: string
  features: string
  installed: string[]
  may: boolean
  decider: { circle: string; name: string; deadline: string }
  refused: string
}

// A circle's rules page in Settings: each setting core circle registers,
// `on` or `off`, with the value in force for the circle, the rule that
// set it and who did, the circle, the assembly or neither, the default;
// the circle that decides a rule changing it and the deadline asked; and
// why no write of the reader's changes one.
export interface Ruling {
  circle: string
  name: string
  assembly: boolean
  settings: { name: string; value: 'on' | 'off'; policy: string | null; set_by: 'circle' | 'assembly' | 'default'; default: 'on' | 'off' }[]
  decider: { circle: string; name: string; deadline: string }
  refused: string
}
