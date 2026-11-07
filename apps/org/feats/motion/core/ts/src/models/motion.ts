import type { Left } from '@cella/org-policy'
import type { Message } from './thread.ts'

export type Stance = 'for' | 'against' | 'abstain' | 'consent' | 'object'

export type Method = 'consent' | 'majority'

// Whether every member reads each stance, or each its own alone.
export type Ballot = 'open' | 'secret'

// The stances each method counts.
export const stances: Record<Method, Stance[]> = {
  consent: ['consent', 'object', 'abstain'],
  majority: ['for', 'against', 'abstain'],
}

// How a motion is taken: its method; for a majority, the share of the
// votes cast it needs, at least `[num, den]` of those for and against, or
// none for more for than against; and its quorum, at least `[num, den]`
// of those counted giving a stance; the ballot a motion under it takes
// unless its proposal names the other; and the circle it consults, if any.
export interface Procedure {
  id: string
  label: string
  method: Method
  share: [number, number] | null
  quorum: [number, number]
  ballot: Ballot
  consult: string | null
}

const fraction = ([n, d]: [number, number]) => (n === d ? 'all' : `${n} in ${d}`)

// A procedure's terms in words: "consent", "majority, quorum 1 in 4",
// "2 in 3 of votes cast, quorum 1 in 2", "majority, secret ballot",
// "consent, consulting coordination".
export function terms(p: Procedure): string {
  const method = p.share ? `${fraction(p.share)} of votes cast` : p.method
  const quorum = p.quorum[0] ? `${method}, quorum ${fraction(p.quorum)}` : method
  const ballot = p.ballot === 'secret' ? `${quorum}, secret ballot` : quorum
  return p.consult ? `${ballot}, consulting ${p.consult}` : ballot
}

// A motion as the feat reads it. Its outcome is never stored: the
// membership-motion graft computes it from the stances on its roll.
export interface Motion {
  id: string
  circle: string
  // The grantee it was proposed as, its circle or a role, by id and by
  // name; the id where its reader reads no name.
  author: string
  authorName: string
  title: string
  method: Method
  // The procedure it was proposed under, whose method is its own.
  procedure: string
  ballot: Ballot
  proposed: string
  deadline: string
  closed: string | null
}

// A stance given, by its receipt; the member's latest counts.
export interface Given {
  id: string
  receipt: number
  member: string
  stance: Stance
  at: string
}

// An effect its close carried, as its log entry says: its op, by its
// kind's label where `motion.carries` registers the op, whether it
// settled or was forgone, the entry it follows, the close's or an
// earlier effect's, and a forgone one's reason, null where it is not
// disclosed to the reader.
export interface Effect {
  id: string
  entry: number
  op: string
  label: string | null
  follows: number
  settled: boolean
  reason: string | null
}

export interface Detail extends Motion {
  body: string
  cutoff: number | null
  // The terms of its procedure.
  terms: Procedure
  given: Given[]
  actions: Labelled[]
  // Its deliberation, in the order received.
  messages: Message[]
  // The default policies of a legal form its actions left.
  leaves: Left[]
  // The log entry of its close, and the effects its close carried, in
  // the order logged; none while it is open.
  close: number | null
  effects: Effect[]
}

// An argument an action of a kind takes, as the New form asks for it.
export interface Arg {
  name: string
  label: string
  type: 'text' | 'number'
  optional?: boolean
  // The key of a list of choices in the New form's `about`, which the
  // kind's graft adds, such as the versions a motion may adopt; the
  // form offers them instead of a text box.
  options?: string
}

// A motion as a card draws it, inside a document or a meeting's
// minutes: its title, circle and method, and where it stands.
export interface Summary {
  id: string
  title: string
  circle: string
  author: string
  authorName: string
  method: string
  deadline: string
  closed: string | null
}

// One of an argument's choices.
export interface Choice {
  value: string
  label: string
}

// A kind of thing a motion decides, registered by the graft that
// carries it out.
export interface Kind {
  kind: string
  label: string
  fields: Arg[]
}

// What a motion decides: an action of a registered kind, its arguments
// as the kind names them.
export interface Carried {
  kind: string
  args: Record<string, string | number>
}

export interface Labelled extends Carried {
  id: string
  n: number
  label: string
  // Its kind's arguments, which name what its args hold.
  fields: Arg[]
}

// A proposal: a motion of a circle, open until its deadline, and the
// actions it decides. Its id, the day it is proposed, its procedure and
// its method, its procedure's, are the server's.
export interface Propose {
  circle: string
  title: string
  // The procedure it is decided by, which the graft that knows its
  // requirements gives it, whatever a proposal names; consent where none
  // does, as for the motion feat alone.
  procedure?: string
  // Its ballot, where it is not its procedure's.
  ballot?: Ballot
  // The role it is proposed as, one its proposer holds on the day; its
  // circle where it names none.
  author?: string
  deadline: string
  body: string
  actions: Carried[]
}

export interface Proposed {
  motion: string
  proposed: string
  ballot: Ballot
  author: string
}

// What the New form offers: the kinds of action, the procedures, and the
// circles a motion may be put in, each with the procedure it decides by,
// which a graft joining circles adds.
export interface Offered {
  kinds: Kind[]
  procedures: Procedure[]
  circles?: { id: string; name: string; procedure: string }[]
  authors?: Choice[]
  // The lists of choices the kinds' arguments name, by key.
  [options: string]: unknown
}

export interface Vote {
  motion: string
  member: string
  stance: Stance
}

export interface Cast {
  receipt: number
}

export interface Close {
  motion: string
}

export interface Closed {
  motion: string
  closed: string
  cutoff: number
}

// Adopting the policy a passed motion carries as its action `n`.
export interface Adopt {
  motion: string
  n: number
}

export interface Adopted {
  policy: string
  motion: string
  n: number
  applies: string
  // The BLAKE3 of its wordings, in hex, which the log commits to.
  hash: string
}

// Ending the policy a passed motion's action `n` names.
export interface End {
  motion: string
  n: number
}

export interface Ended {
  policy: string
  motion: string
  n: number
  // The day it ends, the verdict date.
  ends: string
}
