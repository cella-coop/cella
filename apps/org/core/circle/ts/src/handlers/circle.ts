import type { Outcome } from '@cella/org-actions'
import { write, type Db, type Deps } from '@cella/org-db'
import type { actions } from '../models/actions.ts'
import type { Amend, Amended, Arrange, Arranged, Create, Created, Hidden, Hide, Icon, Iconed, Show, Shown, Terms } from '../models/circle.ts'

type Action = keyof typeof actions
type Out<O extends Action, T> = Promise<Outcome<(typeof actions)[O], T>>

// Creates a circle, citing the motion that creates it: beside every other
// and inside none, deciding by consent until a motion changes it. Its
// entry names the default bundle in force on the verdict date, the
// mandates on the roles every circle has, which its members and its roles
// hold there from that day with no further motion.
export async function create(input: Create, deps: Deps): Out<'circle:circle:create', Created> {
  return write(deps, {
    op: 'circle:circle:create' satisfies Action,
    request: input,
    state: async (tx) => {
      await tx.query(`INSERT INTO circle.circle (id, name, purpose) VALUES ($1, $2, $3)`, [input.id, input.name, input.purpose])
      const { rows } = await tx.query<{ bundle: string[] }>(`SELECT circle.bundle(cella.verdict_date()) AS bundle`)
      return { circle: input.id, bundle: rows[0].bundle.map(Number) }
    },
    payload: (v) => ({ circle: v.circle, name: input.name, purpose: input.purpose, bundle: v.bundle, motion: input.motion }),
  })
}

const terms = ['name', 'purpose', 'procedure'] as const

// Amends a circle, citing the motion that changes it: its name, its
// purpose or its procedure from the verdict date, its id never. Its
// entry carries each term it changed and what it was.
export async function amend(input: Amend, deps: Deps): Out<'circle:circle:amend', Amended> {
  const given: Terms = Object.fromEntries(terms.filter((t) => input[t] !== undefined && input[t] !== null).map((t) => [t, input[t]]))
  return write(deps, {
    op: 'circle:circle:amend' satisfies Action,
    request: input,
    state: async (tx) => {
      const { rows } = await tx.query<Required<Terms>>(
        `SELECT name, purpose, procedure FROM circle.circle WHERE id = $1 FOR NO KEY UPDATE`,
        [input.circle],
      )
      const was: Terms = Object.fromEntries(Object.keys(given).map((t) => [t, rows[0]?.[t as keyof Terms] ?? null]))
      await tx.query(
        `UPDATE circle.circle SET name = coalesce($2, name), purpose = coalesce($3, purpose), procedure = coalesce($4, procedure) WHERE id = $1`,
        [input.circle, given.name ?? null, given.purpose ?? null, given.procedure ?? null],
      )
      return { circle: input.circle, was }
    },
    payload: (v) => ({ circle: v.circle, ...given, was: v.was, motion: input.motion }),
  })
}

// Arranges the co-op's layout of features at its root, replaced by the
// listing given: citing the motion that arranges it,
// `circle:circle:arrange`, or, citing none, at once by the actor's own
// power over the root, `circle:feature:arrange`. It takes the root's lock
// first, in a statement of its own, so the layout it reads after is the
// newest, which a concurrent arrangement may have changed while it
// waited. A listing `circle.listing_flaw` refuses lays nothing, for the
// guard to refuse it in its words. Each group keeps its id where the
// listing keeps or renames it (`circle.grouped`). Its entry carries the
// listing, the ids of its groups in order and the layout it replaced, as
// `circle.features` spells it, so a motion's and a holder's fold alike.
export async function arrange(input: Arrange, deps: Deps): Out<'circle:circle:arrange' | 'circle:feature:arrange', Arranged> {
  return write(deps, {
    op: (input.motion ? 'circle:circle:arrange' : 'circle:feature:arrange') satisfies Action,
    request: input,
    state: async (tx) => {
      const locked = await tx.query(`SELECT id FROM circle.circle WHERE id = $1 AND assembly FOR NO KEY UPDATE`, [input.circle])
      if (!locked.rowCount) {
        return { circle: input.circle, groups: [], was: '' }
      }
      const { rows } = await tx.query<{ was: string; flaw: string | null }>(
        `SELECT w.was, circle.listing_flaw($1, $2, w.was) AS flaw FROM (SELECT circle.features($1) AS was) w`,
        [input.circle, input.features],
      )
      const was = rows[0]?.was ?? ''
      if (rows[0]?.flaw) {
        return { circle: input.circle, groups: [], was }
      }
      const grouped = await tx.query<{ groups: string[] }>(`SELECT circle.grouped($1) AS groups`, [input.features])
      const groups = grouped.rows[0]?.groups ?? []
      await tx.query(`SELECT circle.lay($1, $2)`, [input.features, groups])
      return { circle: input.circle, groups, was }
    },
    payload: (v) => ({ circle: v.circle, features: input.features, groups: v.groups, was: v.was, ...(input.motion ? { motion: input.motion } : {}) }),
  })
}

// Shows a group of the layout in a circle, or stops: citing the motion
// that does, `circle:circle:show`, or, citing none, at once by the
// actor's own power over the circle, `circle:group:show`. One row: it
// takes the circle's lock, before its submit takes the log's head as every
// write does (`hold`), reads whether the circle showed the group,
// `was`, and sets it, so its entry carries the row and what it was, and
// two writes of one row are ordered.
export async function show(input: Show, deps: Deps): Out<'circle:circle:show' | 'circle:group:show', Shown> {
  return write(deps, {
    op: (input.motion ? 'circle:circle:show' : 'circle:group:show') satisfies Action,
    request: input,
    state: async (tx) => {
      await tx.query(`SELECT id FROM circle.circle WHERE id = $1 FOR NO KEY UPDATE`, [input.circle])
      const { rows } = await tx.query<{ was: boolean }>(
        `SELECT EXISTS (SELECT FROM circle.shown s WHERE s.circle = $1 AND s."group" = $2) AS was`,
        [input.circle, input.group],
      )
      await tx.query(`SELECT circle.show($1, $2, $3)`, [input.circle, input.group, input.shown])
      return { ...input, was: rows[0]?.was ?? false }
    },
    payload: (v) => ({ circle: v.circle, group: v.group, shown: v.shown, was: v.was, ...(v.motion ? { motion: v.motion } : {}) }),
  })
}

// Hides a feature of the layout in a circle, or stops: citing the motion
// that does, `circle:circle:hide`, or, citing none, at once,
// `circle:feature:hide`, its row and what it was ordered as a group's
// is.
export async function hide(input: Hide, deps: Deps): Out<'circle:circle:hide' | 'circle:feature:hide', Hidden> {
  return write(deps, {
    op: (input.motion ? 'circle:circle:hide' : 'circle:feature:hide') satisfies Action,
    request: input,
    state: async (tx) => {
      await tx.query(`SELECT id FROM circle.circle WHERE id = $1 FOR NO KEY UPDATE`, [input.circle])
      const { rows } = await tx.query<{ was: boolean }>(
        `SELECT EXISTS (SELECT FROM circle.hidden h WHERE h.circle = $1 AND h.feat = $2) AS was`,
        [input.circle, input.feature],
      )
      await tx.query(`SELECT circle.hide($1, $2, $3)`, [input.circle, input.feature, input.hidden])
      return { ...input, was: rows[0]?.was ?? false }
    },
    payload: (v) => ({ circle: v.circle, feature: v.feature, hidden: v.hidden, was: v.was, ...(v.motion ? { motion: v.motion } : {}) }),
  })
}

// Sets or clears a circle's own icon, a cosmetic setting apart from its
// name, purpose, procedure and features, at once by a holder of
// `arrange-features` over it: the last write wins.
export async function icon(input: Icon, deps: Deps): Out<'circle:circle:icon', Iconed> {
  return write(deps, {
    op: 'circle:circle:icon' satisfies Action,
    request: input,
    state: async (tx) => {
      const { rowCount } = await tx.query('UPDATE circle.circle SET icon = $2 WHERE id = $1', [input.circle, input.icon])
      if (!rowCount) {
        throw new Error(`no circle ${input.circle}`)
      }
      return { circle: input.circle, icon: input.icon }
    },
    payload: (v) => ({ ...v }),
  })
}

// Holds the circles named, in their ids' order, as a write about to touch
// them takes them: before its submit takes the log's head, so every write
// takes the circles first and the head after. A close calls it for the
// circles its motion's actions name, since its effects write them after
// its own submit (`show`, `hide`, `arrange` take one circle the same way).
// No key lock: a row referring to a circle is still written meanwhile.
export async function hold(db: Db, circles: string[]): Promise<void> {
  await db.query(`SELECT id FROM circle.circle WHERE id = ANY ($1) ORDER BY id FOR NO KEY UPDATE`, [circles])
}
