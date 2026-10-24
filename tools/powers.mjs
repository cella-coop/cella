// powers: the power each write needs is registered in SQL, in cella.power,
// which the rules read and which is the source of truth, and mirrored in
// the op's label in ops.ts, which the TypeScript reads. This keeps the two
// equal: every power in one is in the other, with the same amount field.

import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'

// What each ops.ts declares, imported as the TypeScript reads it.
export async function declared(repo, dirs) {
  const out = []
  for (const dir of dirs) {
    const file = join(repo, dir, 'src', 'models', 'ops.ts')
    if (!existsSync(file)) {
      continue
    }
    const { ops } = await import(pathToFileURL(file).href)
    for (const [op, label] of Object.entries(ops ?? {})) {
      out.push({ op, power: label.power ?? null, amount: label.amount ?? null, file: join(dir, 'src', 'models', 'ops.ts') })
    }
  }
  return out
}

// Where ops.ts and cella.power disagree. `ops` lists every declared op,
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
      errors.push(`${r.owner}: registers a power on ${r.op}, which no ops.ts declares`)
    } else if (!o.power) {
      errors.push(`${o.file}: ${r.op} needs ${say(r)} in cella.power, which its label does not name`)
    }
  }
  return errors
}
