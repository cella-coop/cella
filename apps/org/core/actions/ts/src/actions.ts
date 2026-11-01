// Every action a feat declares carries one of three labels, and the label
// decides its path. Until rung 2 every action still goes through the server;
// the label is in the type now so later rungs move paths without a rewrite.

export type Label = 'confluent' | 'bounded' | 'ordered'

// The motion an ordered action waits on, whose outcome the notary folds
// from signed votes. Without one, the notary checks the action's guards alone.
export type Decide = 'consent' | 'majority'

// The power an action needs, which the actor must hold through a mandate on
// the verdict date, and the payload field holding its amount in cents when
// the mandate's limit caps it. The owning feat registers the same in
// `cella.power`, the source of truth; `cella check feats` keeps the two
// equal. An action with no power declares the check that allows it instead,
// and nothing is allowed by omission.
export interface Grant {
  power?: string
  amount?: string
  check?: Check
}

// Who may take an action that needs no power, each a guard registered on
// the action in `cella.guard`, or for `decided` a row in `motion.cites`:
// - `self`: the actor's own, such as their profile or their devices;
// - `roll`: a member on the roll of the motion the action names;
// - `decided`: the motion the action cites closed and passed;
// - `first`: the log's first entry, as the state a scope held before its
//   log is carried in once.
// A seat is no check: what it allows is its roles' mandates, its circle's
// participant role among them.
export type Check = 'self' | 'roll' | 'decided' | 'first'

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
