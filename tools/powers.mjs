// powers: every action declares the power it needs, registered in SQL,
// which the guards read and which is the source of truth: in cella.power
// for a power an individual mandate or a right grants, or in
// motion.cites for one a collective mandate grants, used by a motion of
// its circle, or in motion.stance_power for the one a procedure gives the
// seats on a motion's roll. It is mirrored in the action's label in
// actions.ts, which the TypeScript reads. This keeps the two equal: every power in one is
// in the other, with the same amount field. No action is allowed by
// omission: the one with no power, the log's first entry, declares the
// check `first`, which SQL must back. And every power is one a co-op can
// grant: a mandate a fixture adopts names it. Every action folds, too:
// a slice's SQL registers how its entry applies to the state before it
// (architecture.md, "Folds").

import { existsSync, readdirSync, readFileSync } from 'node:fs'
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
// motion carries with the power its circle's collective mandate grants;
// `stances`, the rows of motion.stance_power, the power a stance needs,
// which a motion's procedure gives the seats on its roll.
export function agree(ops, registered, cites = [], stances = []) {
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
  const given = new Map(stances.map((s) => [s.op, s]))
  for (const s of stances) {
    const o = known.get(s.op)
    if (!o) {
      errors.push(`${s.owner}: lists ${s.op} in motion.stance_power, which no actions.ts declares`)
    } else if (byOp.has(s.op) || cited.has(s.op)) {
      errors.push(`${o.file}: ${s.op} is listed in motion.stance_power and registered elsewhere: a stance's power is its procedure's alone`)
    } else if (s.power !== o.power || o.amount) {
      errors.push(`${o.file}: ${s.op} needs ${say(o)}, but motion.stance_power lists it with ${s.power}, which a procedure gives the seats on a roll and caps no amount`)
    }
  }
  for (const o of ops.filter((o) => o.power && !given.has(o.op))) {
    const r = byOp.get(o.op)
    const c = cited.get(o.op)
    if (r && c) {
      errors.push(`${o.file}: ${o.op} is registered in cella.power and listed in motion.cites: a power is a seat's or a motion's, never both`)
    } else if (c) {
      if (c.power !== o.power || o.amount) {
        errors.push(`${o.file}: ${o.op} needs ${say(o)}, but motion.cites lists it with ${c.power ?? 'no power'}, a collective mandate's, which caps no amount`)
      }
    } else if (!r) {
      errors.push(`${o.file}: ${o.op} needs ${say(o)}, which no SQL registers in cella.power, motion.cites or motion.stance_power`)
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
const checks = new Set(['first'])

// Where an action is allowed by omission: it names no power, and declares no
// check, or one that no SQL backs. `found` holds the literal rows the SQL
// registers: `guards` in cella.guard. A stance on a roll, `roll`, is no
// check: it needs the power its procedure gives the seats on the roll.
// What is the actor's own, `self`, is
// no check, with a power or without one: it needs the power their right
// grants, every person's, member's or employee's. Nor is a seat: what a
// seat allows is its roles' mandates, its circle's participant role among
// them. Nor is a passed motion, `decided`: what it carries needs the power
// its circle's collective mandate grants.
export function covered(ops, found) {
  const errors = []
  const judged = new Set(found.guards.map((r) => r.op))
  const none = new Set(['roll', 'self', 'seat', 'decided'])
  for (const o of ops.filter((o) => o.check === 'roll')) {
    errors.push(`${o.file}: ${o.op} checks roll, which is no check: a stance needs the power its procedure gives the seats on the roll, so name it, vote, and list it in motion.stance_power`)
  }
  for (const o of ops.filter((o) => o.check === 'self')) {
    errors.push(`${o.file}: ${o.op} checks self, which is no check: what is the actor's own needs the power their right grants, every person's, member's or employee's, so name the power, as keep-profile or log-time`)
  }
  for (const o of ops.filter((o) => o.check === 'seat')) {
    errors.push(`${o.file}: ${o.op} checks seat, which is no check: a seat allows what its roles' mandates grant, the participant's among them, so name the power, as propose or discuss`)
  }
  for (const o of ops.filter((o) => o.check === 'decided')) {
    errors.push(`${o.file}: ${o.op} checks decided, which is no check: a passed motion carries what its circle's collective mandate grants, so name the power and list it in motion.cites, as admit-member`)
  }
  for (const o of ops.filter((o) => !o.power && !none.has(o.check))) {
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

// Where an action does not fold: no SQL registers a fold on it by
// `cella.lets_fold`, so its entry would leave the log short of the state
// it made. `folds` holds the literal rows the SQL registers, as
// `found.folds`; a graft's fold on another slice's op counts for that op
// as the op's own slice's does.
export function unfolded(ops, folds) {
  const folding = new Set(folds.map((f) => f.op))
  return ops
    .filter((o) => !folding.has(o.op))
    .map((o) => `${o.file}: ${o.op} has no fold: register how its entry applies to the state before it, by cella.lets_fold in its slice's sql/`)
}

// Where a slice reacts to an op (`on`) that no row of `cella.follows` its
// own SQL registers lets an effect follow: the notary refuses every
// effect no row lets follow its cause. `sources` holds each of the
// slice's files, `{ file, owner, text }`; `follows` the rows its SQL
// registers by `cella.lets_follow`, as `found.follows`.
export function unfollowed(sources, follows) {
  const out = []
  for (const { file, owner, text } of sources) {
    for (const [, body] of text.matchAll(/\bon:\s*\{([^}]*)/g)) {
      for (const [, cause] of body.matchAll(/'([a-z-]+:[a-z-]+:[a-z-]+)'\s*:/g)) {
        if (!follows.some((f) => f.owner === owner && f.cause === cause)) {
          out.push(`${file}: reacts to ${cause}, which no cella.lets_follow of ${owner}'s lets an effect follow`)
        }
      }
    }
  }
  return out
}

// The powers a fixture's co-op grants: every mandate and right among the
// policies its closed motions adopt, as the seed adopts them, to a role,
// to a circle or to the people a right names, by the power its sentence
// marks, `{power: pay-supplier}`. `motions` is the fixture's motion.toml
// `[[motion]]` list.
export function mandates(motions, fixture) {
  const out = []
  for (const m of (motions ?? []).filter((m) => m.closed)) {
    for (const a of (m.action ?? []).filter((a) => a.kind === 'policy' && ['mandate', 'right'].includes(a.args?.kind))) {
      for (const [, power] of (a.args.wording ?? '').matchAll(/\{power:\s*([^}]*?)\s*\}/g)) {
        out.push({ power, fixture, motion: m.id })
      }
    }
  }
  return out
}

// Where an action needs a power no co-op can be seen to grant: no
// mandate, collective mandate or right among the fixtures' adopted
// policies names it. A stance's power, listed in motion.stance_power, is
// the procedure's to give the seats on a roll, and no mandate's.
export function granted(ops, grants, stances = []) {
  const given = new Set(stances.map((s) => s.op))
  const powers = new Set(grants.map((g) => g.power))
  const where = [...new Set(grants.map((g) => g.fixture))].join(', ') || 'no fixture'
  return ops
    .filter((o) => o.power && !given.has(o.op) && !powers.has(o.power))
    .map((o) => `${o.file}: ${o.op} needs ${o.power}, which no mandate, collective mandate or right grants in ${where}: adopt one in a fixture's closed motion, or declare the action only once it is built`)
}

// Where a feat keeps a body or threads but not whole, as
// `cella scaffold` writes them (core body's doc, "Threads"): a `body`
// of core body's, a `bytea` column on a table of its schema, needs
// `<feat>:body:save`, needing `discuss`, its fold, its guard on the
// save's `base`, `<feat>.based`, and the session's mount, a `body:` in a
// collection of its slice; a thread's
// `<feat>.comment` table, its replies by `parent`, needs post, resolve
// and react,
// each needing `discuss` and folding, the `<feat>.mention` table and a
// guard on react, which reads whether the circle takes reactions. `feats`
// lists each feat's core package, `{ name, file, mounts }`, `file` its
// actions.ts, `mounts` whether its slice mounts a body; `found` is what
// the SQL check read, its columns, tables, guards and folds.
export function whole(feats, ops, found) {
  const out = []
  const byOp = new Map(ops.map((o) => [o.op, o]))
  const folds = new Set((found.folds ?? []).map((f) => f.op))
  const tables = new Set((found.tables ?? []).map((t) => t.key))
  const needs = (file, F, what, op) => {
    const o = byOp.get(op)
    if (!o) {
      return [`${file}: ${F} keeps ${what} but declares no ${op}: run cella scaffold, or declare it with its power and fold`]
    }
    return [
      ...(o.power === 'discuss' ? [] : [`${file}: ${op} needs ${o.power ?? 'no power'}, but ${what} is discussed: it needs discuss`]),
      ...(folds.has(op) ? [] : [`${file}: ${op} has no fold, so ${what} would not fold: register it by cella.lets_fold`]),
    ]
  }
  // A feat with one body names it the entity `body`, `${F}:body:save` (as
  // task's, project's do), served at POST /api/<feat>/save — but
  // report's own `save` already takes that verb, so its body's is given
  // one by hand.
  const singleVerb = { report: 'save-body' }
  for (const { name: F, file, mounts } of feats) {
    // Its address is POST /api/<feat>/<verb>, the entity playing no part
    // in it, so a feat with several bodies (account's, patronage's) needs
    // a verb of its own for each: its guard's function is still named by
    // its table, `based_<table>`, which finds it whatever its verb is,
    // `save-<table>`.
    const bodies = (found.columns ?? []).filter((c) => c.key.split('.')[0] === F && c.key.endsWith('.body') && c.type === 'bytea')
    for (const body of bodies) {
      const table = body.key.split('.')[1]
      const what = `a body in ${body.key}`
      if (bodies.length === 1) {
        const op = `${F}:body:${singleVerb[F] ?? 'save'}`
        out.push(...needs(file, F, what, op))
        if (!(found.guards ?? []).some((g) => g.op === op && g.fn === `${F}.based(jsonb)`)) {
          out.push(`${file}: ${F} keeps ${what} but no guard ${F}.based on ${op}: a save whose base is not the body it replaces would erase another editor's`)
        }
        continue
      }
      const based = `${F}.based_${table}`
      const guard = (found.guards ?? []).find((g) => g.fn === `${based}(jsonb)`)
      if (!guard) {
        out.push(`${file}: ${F} keeps ${what} but no guard ${based} on its save: a save whose base is not the body it replaces would erase another editor's`)
        continue
      }
      out.push(...needs(file, F, what, guard.op))
    }
    if (bodies.length && mounts < bodies.length) {
      const named = bodies.map((b) => b.key).join(', ')
      out.push(
        mounts
          ? `${file}: ${F} keeps bodies in ${named} but mounts only ${mounts} in core body's session: each collection names body: { circle, saved, save }`
          : `${file}: ${F} keeps a body in ${named} but mounts none in core body's session: its collection names body: { circle, saved, save }`,
      )
    }
    if (tables.has(`${F}.comment`) && (found.columns ?? []).some((c) => c.key === `${F}.comment.parent`)) {
      const what = `threads in ${F}.comment`
      for (const verb of ['post', 'resolve', 'react']) {
        out.push(...needs(file, F, what, `${F}:comment:${verb}`))
      }
      if (!tables.has(`${F}.mention`)) {
        out.push(`${file}: ${F} keeps ${what} but no ${F}.mention: a comment's mentions are rows the Inbox reads`)
      }
      if (!(found.guards ?? []).some((g) => g.op === `${F}:comment:react` && g.owner === F)) {
        out.push(`${file}: ${F} keeps ${what} but no guard on ${F}:comment:react: a reaction is refused where its circle turned reactions off`)
      }
    }
  }
  return out
}

// The feats, or one feat's one kind, whose record keeps no body of its
// own, by architecture, not by oversight: a motion's text is its own,
// adopted once and never a live document (architecture.md, "Threads"); a
// document's content keeps its drafts and versions already, core body's
// own blocks under a richer session than a single save (core/body's
// index.md, "The model"); patronage's statements are a view grouping
// `patronage.part`'s rows, kept by the distribution's approval, with no
// row of its own a column could be added to.
const bodyless = new Set(['document', 'motion', 'patronage/statements'])

// A top-level key's whole object literal, by brace depth, from the first
// `collections: {` the text holds: `{ accounts: '… accounts: { … } …',
// periods: '…' }`. Both a slice's `api/index.ts` (or `api/slice.ts`,
// where a graft's writes move it there) and its `app/index.ts` shape
// their collections the same way, so the one reader finds a collection's
// mount and its page alike.
function blocks(text, of) {
  const m = text.match(new RegExp(`\\b${of}:\\s*\\{`))
  const out = {}
  if (!m) {
    return out
  }
  let i = m.index + m[0].length
  let depth = 1
  while (i < text.length && depth > 0) {
    if (depth === 1) {
      const key = /^\s*(\w+):\s*\{/.exec(text.slice(i))
      if (key) {
        const at = i + key[0].length - 1
        let d = 1
        let j = at + 1
        while (j < text.length && d > 0) {
          d += text[j] === '{' ? 1 : text[j] === '}' ? -1 : 0
          j++
        }
        out[key[1]] = text.slice(at, j)
        i = j
        continue
      }
    }
    depth += text[i] === '{' ? 1 : text[i] === '}' ? -1 : 0
    i++
  }
  return out
}

// Every kind a record page shows mounts a body: `cella scaffold body
// <feat>`, or by hand for a feat with more than one kind, as account's
// and patronage's are. `feats` is `whole`'s list, with each feat's
// package directory added; a feat with no `app/index.ts` (none today) is
// skipped, and so is one core's own rule governs (circles, people,
// mandates, the log), since core is not a feat `embodied` is given.
export function embodied(repo, feats) {
  const out = []
  for (const { name: F, dir } of feats) {
    if (bodyless.has(F)) {
      continue
    }
    const appIndex = join(repo, dir, 'src', 'app', 'index.ts')
    if (!existsSync(appIndex)) {
      continue
    }
    const api = join(repo, dir, 'src', 'api')
    const apiText = existsSync(join(api, 'index.ts')) ? readFileSync(join(api, 'index.ts'), 'utf8') : ''
    const apiBlocks = { ...blocks(apiText, 'collections'), ...(existsSync(join(api, 'slice.ts')) ? blocks(readFileSync(join(api, 'slice.ts'), 'utf8'), 'collections') : {}) }
    const pages = blocks(readFileSync(appIndex, 'utf8'), 'collections')
    for (const [kind, page] of Object.entries(pages)) {
      if (!/\bpage:\s*\{/.test(page) || bodyless.has(`${F}/${kind}`)) {
        continue
      }
      if (!/^\s+body:\s*[{\w]/m.test(apiBlocks[kind] ?? '')) {
        out.push(`${appIndex}: ${F}'s ${kind} has a record page but mounts no body: every record has one, by cella scaffold body ${F}, or by hand where ${F} keeps more than one kind's`)
      }
    }
  }
  return out
}
