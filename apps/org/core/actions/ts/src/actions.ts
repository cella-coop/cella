// Every action a feat declares carries one of three labels, and the label
// decides its path. Until rung 2 every action still goes through the server;
// the label is in the type now so later rungs move paths without a rewrite.

export type Label = 'confluent' | 'bounded' | 'ordered'

// The motion an ordered action waits on, whose outcome the notary folds
// from signed votes. Without one, the notary checks the action's guards alone.
export type Decide = 'consent' | 'majority'

// The power an action needs and the payload field holding its amount in
// cents when the mandate's limit caps it. An individual mandate grants
// it, or a right: the actor holds it through a seat on the verdict date,
// or as one of the people a right names, every person, member or
// employee, and the owning feat registers the same in `cella.power`, the
// source of truth.
// Or a collective mandate grants it, for an action a passed motion
// carries: the motion's circle holds it, and the graft that cites the
// motion registers the same in `motion.cites` instead. `cella check
// feats` keeps the label and the SQL equal. An action with no power
// declares the check that allows it instead, and nothing is allowed by
// omission.
export interface Grant {
  power?: string
  amount?: string
  check?: Check
}

// Who may take an action that needs no power, each a guard registered on
// the action in `cella.guard`:
// - `roll`: a member on the roll of the motion the action names;
// - `first`: the log's first entry, as the state a scope held before its
//   log is carried in once.
// What is the actor's own is no check: it needs the power their right
// grants, and the feat's guard that it is theirs. A seat is no check:
// what it allows is its roles' mandates, its circle's participant role
// among them. Nor is a passed motion: what it carries needs the power its
// circle's collective mandate grants.
export type Check = 'roll' | 'first'

export interface Confluent extends Grant {
  label: 'confluent'
}

// Spends a right granted in advance: a budget share, an invoice series,
// a draw limit. Works offline until the right runs out (rung 2).
export interface Bounded extends Grant {
  label: 'bounded'
  right: string
}

export interface Ordered extends Grant {
  label: 'ordered'
  decide?: Decide
  // Names the state the action must find unchanged, as adoption names its base.
  base?: string
}

export type Action = Confluent | Bounded | Ordered

export const confluent = (g: Grant = {}): Confluent => ({ label: 'confluent', ...g })
export const bounded = (right: string, g: Grant = {}): Bounded => ({ label: 'bounded', right, ...g })
export const ordered = (o: Omit<Ordered, 'label'> = {}): Ordered => ({ label: 'ordered', ...o })

// One permission per action, its id `<feat>:<entity>:<verb>`, served as
// POST /api/<feat>/<verb>.
export type Permission = `${string}:${string}:${string}`

export type Actions = Record<Permission, Action>

// An ordered action is Pending until its verdict; the others never wait. Until
// rung 2 every action still meets the server's guards and triggers, so any of
// them may be Refused: an unbalanced entry, a comment quoting text its
// version lacks, a stance on a closed motion.
export type Outcome<O extends Action, T> = O extends Ordered
  ? Pending | Settled<T> | Refused
  : Settled<T> | Refused

export interface Pending {
  state: 'pending'
  receipt: number
}

export interface Settled<T> {
  state: 'settled'
  entry: number
  value: T
}

export interface Refused {
  state: 'refused'
  verdict: number
  reason: string
}
