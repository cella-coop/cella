// powers: the power each action needs is registered in SQL, which the
// guards read and which is the source of truth: in cella.power for a
// power an individual mandate grants, held through a seat, or in
// motion.cites for one a collective mandate grants, used by a motion of
// its circle. It is mirrored in the action's label in actions.ts, which
// the TypeScript reads. This keeps the two equal: every power in one is
// in the other, with the same amount field. And no action is allowed by
// omission: one with no power declares the check that allows it, which
// SQL must back.

import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'

// What each actions.ts declares, imported as the TypeScript reads it.
export async function declared(repo, dirs) {
  const out = []
  for (const dir of dirs) {
    const file = join(repo, dir, 'src', 'models', 'actions.ts')
    if (!existsSync(file)) {
      continue
    }
    const { actions } = await import(pathToFileURL(file).href)
    for (const [op, label] of Object.entries(actions ?? {})) {
      out.push({ op, power: label.power ?? null, amount: label.amount ?? null, check: label.check ?? null, file: join(dir, 'src', 'models', 'actions.ts') })
    }
  }
  return out
}

// Where actions.ts and the SQL disagree. `ops` lists every declared
// action by its id, `op`, with or without a power; `registered`, the rows
// of cella.power; `cites`, the rows of motion.cites, each an action a
// motion carries with the power its circle's collective mandate grants.
export function agree(ops, registered, cites = []) {
  const errors = []
  const byOp = new Map()
  for (const r of registered) {
    if (byOp.has(r.op)) {
      errors.push(`${r.owner}: registers a power on ${r.op} twice`)
    }
    byOp.set(r.op, r)
  }
  const cited = new Map()
  for (const c of cites) {
    if (cited.has(c.op)) {
      errors.push(`${c.owner}: lists ${c.op} in motion.cites twice`)
    }
    cited.set(c.op, c)
  }
  const known = new Map(ops.map((o) => [o.op, o]))
  const say = (x) => (x.power ? `${x.power}${x.amount ? ` up to its ${x.amount}` : ''}` : 'no power')
  for (const o of ops.filter((o) => o.power)) {
    const r = byOp.get(o.op)
    const c = cited.get(o.op)
    if (r && c) {
      errors.push(`${o.file}: ${o.op} is registered in cella.power and listed in motion.cites: a power is a seat's or a motion's, never both`)
    } else if (c) {
      if (c.power !== o.power || o.amount) {
        errors.push(`${o.file}: ${o.op} needs ${say(o)}, but motion.cites lists it with ${c.power ?? 'no power'}, a collective mandate's, which caps no amount`)
      }
    } else if (!r) {
      errors.push(`${o.file}: ${o.op} needs ${say(o)}, which no SQL registers in cella.power or motion.cites`)
    } else if (r.power !== o.power || (r.amount ?? null) !== (o.amount ?? null)) {
      errors.push(`${o.file}: ${o.op} needs ${say(o)}, but cella.power registers ${say(r)}`)
    }
  }
  for (const r of registered) {
    const o = known.get(r.op)
    if (!o) {
      errors.push(`${r.owner}: registers a power on ${r.op}, which no actions.ts declares`)
    } else if (!o.power) {
      errors.push(`${o.file}: ${r.op} needs ${say(r)} in cella.power, which its label does not name`)
    }
  }
  for (const c of cites) {
    const o = known.get(c.op)
    if (!o) {
      errors.push(`${c.owner}: lists ${c.op} in motion.cites, which no actions.ts declares`)
    } else if (!o.power) {
      errors.push(`${o.file}: ${c.op} needs ${c.power ?? 'no power'} in motion.cites, which its label does not name`)
    }
  }
  return errors
}

// The checks a label may declare, each backed by a guard registered on the
// action in cella.guard.
const checks = new Set(['self', 'roll', 'first'])

// Where an action is allowed by omission: it names no power, and declares no
// check, or one that no SQL backs. `found` holds the literal rows the SQL
// registers: `guards` in cella.guard. A seat is no check, with a power or
// without one: what a seat allows is its roles' mandates, its circle's
// participant role among them. Nor is a passed motion, `decided`: what it
// carries needs the power its circle's collective mandate grants.
export function covered(ops, found) {
  const errors = []
  const judged = new Set(found.guards.map((r) => r.op))
  for (const o of ops.filter((o) => o.check === 'seat')) {
    errors.push(`${o.file}: ${o.op} checks seat, which is no check: a seat allows what its roles' mandates grant, the participant's among them, so name the power, as propose or discuss`)
  }
  for (const o of ops.filter((o) => o.check === 'decided')) {
    errors.push(`${o.file}: ${o.op} checks decided, which is no check: a passed motion carries what its circle's collective mandate grants, so name the power and list it in motion.cites, as admit-member`)
  }
  for (const o of ops.filter((o) => !o.power && o.check !== 'seat' && o.check !== 'decided')) {
    if (!o.check) {
      errors.push(`${o.file}: ${o.op} names neither a power nor a check: no action is allowed by omission`)
    } else if (!checks.has(o.check)) {
      errors.push(`${o.file}: ${o.op} declares the check ${o.check}, which is none of ${[...checks].join(', ')}`)
    } else if (!judged.has(o.op)) {
      errors.push(`${o.file}: ${o.op} checks ${o.check}, but no SQL registers a guard on it in cella.guard`)
    }
  }
  return errors
}
