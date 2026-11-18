import type { Permission, Refused, Settled } from '@cella/org-actions'
import { plain, type Proof, type Signer } from '@cella/org-sign'
import { forgone, outcomes, type Done } from './slice.ts'

export * from './slice.ts'
export * from './import.ts'
export * from './read.ts'
export * from './schema.ts'
export * from './query.ts'

// The one thing a handler needs of a connection; a `pg` Client or pool
// client fits it.
export interface Db {
  query<R = Record<string, unknown>>(text: string, values?: unknown[]): Promise<{ rows: R[]; rowCount: number | null }>
}

// Lends one connection, inside a transaction of its own, for as long as
// `fn` runs: committed when it returns, rolled back when it throws.
export type Borrow = <T>(fn: (db: Db) => Promise<T>) => Promise<T>

// A pool a server borrows from, as a `pg` Pool is one.
export interface Pool {
  connect(): Promise<Db & { release(e?: Error): void }>
}

// A server's borrows from `pool`, each as `role` reading for `actor`, the
// signed-in person, or for no one: the transaction sets both for itself
// alone before `fn`'s first query, so every row-level policy reads as
// them, and both clear themselves as it commits or rolls back. A
// connection goes back reading as no one with no reset, even after a
// borrow that threw; one whose rollback fails is closed.
export function lending(pool: Pool, role: string) {
  return async <T>(actor: string | null, fn: (db: Db) => Promise<T>): Promise<T> => {
    const client = await pool.connect()
    try {
      await client.query('BEGIN')
      await client.query(`SELECT set_config('role', $1, true), set_config('cella.actor', $2, true)`, [role, actor ?? ''])
      const value = await fn(client)
      await client.query('COMMIT')
      client.release()
      return value
    } catch (e) {
      await client.query('ROLLBACK').then(
        () => client.release(),
        (r: Error) => client.release(r),
      )
      throw e
    }
  }
}

// A transaction on one connection held throughout, as a test holds one,
// lent as a server's borrow lends one.
export const holding =
  (db: Db): Borrow =>
  async (fn) => {
    await db.query('BEGIN')
    try {
      const value = await fn(db)
      await db.query('COMMIT')
      return value
    } catch (e) {
      await db.query('ROLLBACK')
      throw e
    }
  }

export interface Deps {
  // What a handler reads on before its write. Nothing read here binds the
  // write: its guards read again inside its transaction.
  db: Db
  // Lends the connection a write's transaction runs on, once it is
  // signed; left out, as by a test holding one connection throughout, the
  // transaction runs on `db`.
  borrow?: Borrow
  // The member the write is for.
  actor: string
  // Signs the write's request as the actor's device; the notary checks it.
  sign: Signer
  // The reactions to a write of `op`, every slice's, each run with the
  // write's request: the shell's, which `write` runs in the write's
  // transaction after its verdict, so each write they make is an effect
  // citing it. Left out, as by a test of one slice, nothing reacts.
  react?: (op: Permission, request: unknown, deps: Deps) => Promise<Done[]>
  // Set while a write's transaction is open, for the reactions to it: a
  // write made under it is an effect, not a decision of its own.
  effect?: Effect
}

// Where an effect is written: the transaction of the decision it follows,
// the entry it cites, how many effects from its decision that entry is,
// and the decision's proof, which names the device that signed it.
export interface Effect {
  tx: Db
  cause: number
  depth: number
  proof: Proof
}

export interface Write<T> {
  op: Permission
  // What the member asks for, which their device signs.
  request: unknown
  // The state change, inside the transaction, before the verdict; `proof`
  // names the device that signed.
  state: (tx: Db, proof: Proof) => Promise<T>
  // What the log commits to; it holds a digest of this, never the payload.
  payload: (value: T) => Record<string, unknown>
}

// A personal value in a payload: the notary commits to it, under a fresh
// salt, and keeps the value in the vault, never in the log. `field` is a
// column registered in `cella.personal`, as `schema.table.column`;
// `subject` whose it is, by their address or id. A null is no personal
// data and stays null, so a field a write clears folds as null.
export const personal = (field: string, subject: string, value: unknown) =>
  value === null || value === undefined ? null : { $personal: { field, subject, value } }

// An erasure in a payload: the notary erases the subject's personal data
// of the classes named, or of every class, as it settles.
export const erasure = (subject: string, classes?: string[]) => ({ $erase: classes ? { subject, classes } : { subject } })

// SQLSTATE triggered_action_exception: a guard, a feat's trigger or the
// notary's signature check refused.
const REFUSED = '09000'

const code = (e: unknown) => (e as { code?: string }).code

// What a server lends a write from `using`: reads that borrow a
// connection for each statement alone, and a connection for each
// transaction, so a write waiting on its signer holds none.
export function lent(using: Borrow): Pick<Deps, 'db' | 'borrow'> {
  return {
    db: { query: <R>(text: string, values?: unknown[]) => using((db) => db.query<R>(text, values)) },
    borrow: using,
  }
}

// SQLSTATEs deadlock_detected and serialization_failure: Postgres rolled
// the transaction back whole, so it may run again.
const AGAIN = new Set(['40P01', '40001'])
const TRIES = 3

// Runs a write's transaction, and again, up to three times in all, after a
// short jittered pause, where Postgres rolled it back for a deadlock or a
// serialization failure. Safe: the request is signed once, before, and
// the same proof is submitted again; a rolled-back attempt appended
// nothing to the log, its verdict, receipt and effects undone with it, so
// nothing posts twice and nothing is signed twice. A handler's state
// writes the database alone, so running it again redoes nothing outside
// it. An effect is never retried alone: its error rolls back its
// decision, which is retried whole.
async function retrying<T>(attempt: () => Promise<T>): Promise<T> {
  for (let n = 1; ; n++) {
    try {
      return await attempt()
    } catch (e) {
      if (!AGAIN.has(code(e) ?? '') || n >= TRIES) {
        throw e
      }
      await new Promise((r) => setTimeout(r, 10 * n + Math.random() * 40))
    }
  }
}

// One write, one transaction: signed first, as the member's device does
// before sending, with no connection held, then the transaction of a
// connection borrowed for it alone, begun with `cella.begin`, then the
// state change, then `cella.submit`, then its effects, then the borrow
// commits, retried whole where Postgres rolled it back for a deadlock
// (`retrying`). A state table takes rows only in a begun transaction, and one
// commits only with its verdict. A refusal raises inside submit, so the
// borrow rolls the state and the verdict back together and the refusal
// uses no verdict number. Inside a write's transaction (`deps.effect`), a
// write is an effect of it instead, which no one signs (`effect`).
export async function write<T>(deps: Deps, w: Write<T>): Promise<Settled<T> | Refused> {
  if (deps.effect) {
    return effect(deps, deps.effect, w)
  }
  const request = plain(w.request)
  const proof = await deps.sign(w.op, request)
  const borrow = deps.borrow ?? holding(deps.db)
  try {
    return await retrying(() => borrow((db) => transact(db, deps, w, request, proof)))
  } catch (e) {
    if (code(e) !== REFUSED) {
      throw e
    }
    // A refusal is numbered by the last verdict it was judged after.
    const { rows } = await borrow((db) => db.query<{ n: string }>('SELECT n FROM cella.head'))
    return { state: 'refused', verdict: Number(rows[0].n), reason: (e as Error).message }
  }
}

async function transact<T>(db: Db, deps: Deps, w: Write<T>, request: unknown, proof: Proof): Promise<Settled<T>> {
  const { actor } = deps
  // The transaction reads as the actor, and as a write's: its state
  // change sees the whole state, as the guards do.
  await db.query(`SELECT set_config('cella.actor', $1, true), set_config('cella.writing', 'on', true)`, [actor])
  await db.query(`SELECT cella.begin($1, $2, decode($3, 'hex'))`, [w.op, actor, proof.device])
  const value = await w.state(db, proof)
  // Deferred checks, such as an entry balancing, refuse before the
  // verdict rather than at commit, after it.
  await db.query('SET CONSTRAINTS ALL IMMEDIATE')
  const { rows } = await db.query<{ verdict: string }>(
    'SELECT verdict FROM cella.submit($1, $2, $3, $4)',
    [w.op, w.payload(value), actor, { request, ...proof }],
  )
  const entry = Number(rows[0].verdict)
  const then = await reacting(deps, w.op, request, { tx: db, cause: entry, depth: 0, proof })
  // A decision stands only with the effects it requires: one refused
  // refuses it whole, as a guard would.
  const lost = await lacking(db, w.op, then)
  if (lost) {
    throw Object.assign(new Error(`${w.op} needs ${lost.op}, which was refused: ${lost.reason}`), { code: REFUSED })
  }
  const settled: Settled<T> = { state: 'settled', entry, value }
  outcomes.set(settled, then)
  return settled
}

// The reactions to a write of `op` that settled as entry `e.cause`, run
// in its transaction, each write they make an effect citing it; five
// effects from the decision at most, as the notary allows.
async function reacting(deps: Deps, op: Permission, request: unknown, e: Effect): Promise<Done[]> {
  if (!deps.react || e.depth >= 5) {
    return []
  }
  return deps.react(op, request, { ...deps, db: e.tx, borrow: undefined, effect: { ...e, depth: e.depth + 1 } })
}

// The first effect among `then` that `op` requires, by `cella.follows`,
// and that was refused.
async function lacking(tx: Db, op: Permission, then: Done[]): Promise<Done | undefined> {
  const refused = then.filter((d) => d.state === 'refused')
  if (!refused.length) {
    return undefined
  }
  const { rows } = await tx.query<{ op: string }>('SELECT op FROM cella.follows WHERE cause = $1 AND required', [op])
  return refused.find((d) => rows.some((r) => r.op === d.op))
}

// An effect: no signature, the decision's transaction, and a savepoint of
// its own. Its state, then `cella.follow` citing its cause, then the
// reactions to it, each an effect citing it. A refusal rolls it back to
// its savepoint and records it forgone (`cella.forgo`) with the refusal's
// reason, and the decision and the other effects stand. An effect it
// requires refused rolls it back with every effect after it and forgoes
// each, its own reason naming the refusal.
async function effect<T>(deps: Deps, e: Effect, w: Write<T>): Promise<Settled<T> | Refused> {
  const { tx } = e
  const savepoint = `effect_${e.depth}`
  const request = plain(w.request)
  await tx.query(`SAVEPOINT ${savepoint}`)
  let entry: number
  let value: T
  try {
    // The decision made its checks immediate; an effect's own, such as an
    // entry balancing, wait for its state, as a decision's do.
    await tx.query('SET CONSTRAINTS ALL DEFERRED')
    value = await w.state(tx, e.proof)
    await tx.query('SET CONSTRAINTS ALL IMMEDIATE')
    const { rows } = await tx.query<{ verdict: string }>('SELECT verdict FROM cella.follow($1, $2, $3)', [w.op, w.payload(value), e.cause])
    entry = Number(rows[0].verdict)
  } catch (err) {
    if (code(err) !== REFUSED) {
      throw err
    }
    await tx.query(`ROLLBACK TO SAVEPOINT ${savepoint}`)
    await tx.query(`RELEASE SAVEPOINT ${savepoint}`)
    return forgo(tx, w.op, e.cause, (err as Error).message)
  }
  const then = await reacting(deps, w.op, request, { ...e, cause: entry })
  const lost = await lacking(tx, w.op, then)
  if (lost) {
    await tx.query(`ROLLBACK TO SAVEPOINT ${savepoint}`)
    await tx.query(`RELEASE SAVEPOINT ${savepoint}`)
    const why = `${w.op} is forgone with ${lost.op}, which it requires: ${lost.reason}`
    const out = await forgo(tx, w.op, e.cause, why)
    outcomes.set(out, await forgoing(tx, then, out.verdict, why))
    return out
  }
  await tx.query(`RELEASE SAVEPOINT ${savepoint}`)
  const settled: Settled<T> = { state: 'settled', entry, value }
  outcomes.set(settled, then)
  return settled
}

// An effect recorded forgone, citing `cause`; its verdict is the entry
// that records it.
async function forgo(tx: Db, op: Permission, cause: number, reason: string): Promise<Refused> {
  const { rows } = await tx.query<{ verdict: string }>('SELECT verdict FROM cella.forgo($1, $2, $3)', [op, cause, reason])
  const out: Refused = { state: 'refused', verdict: Number(rows[0].verdict), reason }
  forgone.add(out)
  return out
}

// The effects a forgone cause had, rolled back with it, each forgone again
// citing the cause's forgone entry: a settled one with the cause's reason,
// one already forgone with its own.
async function forgoing(tx: Db, then: Done[], cause: number, why: string): Promise<Done[]> {
  const out: Done[] = []
  for (const d of then) {
    const f = await forgo(tx, d.op, cause, d.state === 'refused' && d.reason ? d.reason : why)
    out.push({ op: d.op, state: 'refused', entry: f.verdict, verdict: f.verdict, reason: f.reason, forgone: true, then: await forgoing(tx, d.then, f.verdict, why) })
  }
  return out
}
