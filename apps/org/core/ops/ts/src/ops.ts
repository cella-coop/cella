// Every write a feat declares carries one of three labels, and the label
// decides its path. Until rung 2 every write still goes through the server;
// the label is in the type now so later rungs move paths without a rewrite.

export type Label = 'confluent' | 'bounded' | 'ordered'

// The decision an ordered write waits on, whose outcome the notary folds
// from signed votes. Without one, the notary checks the write's rule alone.
export type Decide = 'consent' | 'majority'

// The power a write needs, which the actor must hold through a mandate on
// the verdict date, and the payload field holding its amount in cents when
// the mandate's limit caps it. The owning feat registers the same in
// `cella.power`, the source of truth; `cella check feats` keeps the two
// equal. A write with no power is the actor's own, or is decided.
export interface Grant {
  power?: string
  amount?: string
}

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
// rung 2 every write still meets the server's rules and triggers, so any of
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
