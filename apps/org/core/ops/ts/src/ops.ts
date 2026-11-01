// Every write a feat declares carries one of three labels, and the label
// decides its path. Until rung 2 every write still goes through the server;
// the label is in the type now so later rungs move paths without a rewrite.

export type Label = 'confluent' | 'bounded' | 'ordered'

// The decision an ordered write waits on, whose outcome the notary folds
// from signed votes. Without one, the notary checks the write's guard alone.
export type Decide = 'consent' | 'majority'

// The power a write needs, which the actor must hold through a mandate on
// the verdict date, and the payload field holding its amount in cents when
// the mandate's limit caps it. The owning feat registers the same in
// `cella.power`, the source of truth; `cella check feats` keeps the two
// equal. A write with no power declares the check that allows it instead,
// and nothing is allowed by omission.
export interface Grant {
  power?: string
  amount?: string
  check?: Check
}

// Who may make a write that needs no power, each a guard registered on the
// op in `cella.guard`, or for `decided` a row in `decision.cites`:
// - `self`: the actor's own, such as their profile or their devices;
// - `roll`: a member on the roll of the decision the write names;
// - `seat`: a member seated in the circle the write concerns;
// - `decided`: the decision the write cites closed and passed;
// - `first`: the log's first entry, as the state a scope held before its
//   log is carried in once.
export type Check = 'self' | 'roll' | 'seat' | 'decided' | 'first'

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
  // Names the state the write must find unchanged, as adoption names its base.
  base?: string
}

export type Op = Confluent | Bounded | Ordered

export const confluent = (g: Grant = {}): Confluent => ({ label: 'confluent', ...g })
export const bounded = (right: string, g: Grant = {}): Bounded => ({ label: 'bounded', right, ...g })
export const ordered = (o: Omit<Ordered, 'label'> = {}): Ordered => ({ label: 'ordered', ...o })

// One permission per write, `<feat>:<entity>:<op>`, served as POST /api/<feat>/<op>.
export type Permission = `${string}:${string}:${string}`

export type Ops = Record<Permission, Op>

// An ordered write is Pending until its verdict; the others never wait. Until
// rung 2 every write still meets the server's guards and triggers, so any of
// them may be Refused: an unbalanced entry, a comment quoting text its
// version lacks, a stance on a closed decision.
export type Outcome<O extends Op, T> = O extends Ordered
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
