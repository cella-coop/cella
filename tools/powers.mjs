// powers: the power each action needs is registered in SQL, in cella.power,
// which the guards read and which is the source of truth, and mirrored in
// the action's label in actions.ts, which the TypeScript reads. This keeps the two
// equal: every power in one is in the other, with the same amount field.
// And no action is allowed by omission: one with no power declares the
// check that allows it, which SQL must back.

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

// Where actions.ts and cella.power disagree. `ops` lists every declared
// action by its id, `op`,
// with or without a power; `registered`, the rows of cella.power.
export function agree(ops, registered) {
  const errors = []
  const byOp = new Map()
  for (const r of registered) {
    if (byOp.has(r.op)) {
      errors.push(`${r.owner}: registers a power on ${r.op} twice`)
    }
    byOp.set(r.op, r)
  }
  const known = new Map(ops.map((o) => [o.op, o]))
  const say = (x) => (x.power ? `${x.power}${x.amount ? ` up to its ${x.amount}` : ''}` : 'no power')
  for (const o of ops.filter((o) => o.power)) {
    const r = byOp.get(o.op)
    if (!r) {
      errors.push(`${o.file}: ${o.op} needs ${say(o)}, which no SQL registers in cella.power`)
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
  return errors
}

// The checks a label may declare, and what backs each: a guard registered
// on the action in cella.guard, or for `decided` a row in decision.cites, to
// which the graft that counts a decision's roll attaches its guard.
const checks = new Set(['self', 'roll', 'seat', 'decided', 'first'])

// Where an action is allowed by omission: it names no power, and declares no
// check, or one that no SQL backs. `found` holds the literal rows the SQL
// registers: `guards` in cella.guard and `cites` in decision.cites.
export function covered(ops, found) {
  const errors = []
  const judged = new Set(found.guards.map((r) => r.op))
  const cited = new Set(found.cites.map((c) => c.op))
  for (const o of ops.filter((o) => !o.power)) {
    if (!o.check) {
      errors.push(`${o.file}: ${o.op} names neither a power nor a check: no action is allowed by omission`)
    } else if (!checks.has(o.check)) {
      errors.push(`${o.file}: ${o.op} declares the check ${o.check}, which is none of ${[...checks].join(', ')}`)
    } else if (o.check === 'decided' && !cited.has(o.op)) {
      errors.push(`${o.file}: ${o.op} is decided, but no SQL lists it in decision.cites`)
    } else if (o.check !== 'decided' && !judged.has(o.op)) {
      errors.push(`${o.file}: ${o.op} checks ${o.check}, but no SQL registers a guard on it in cella.guard`)
    }
  }
  return errors
}
