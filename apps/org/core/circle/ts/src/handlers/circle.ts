import type { Outcome } from '@cella/org-actions'
import { write, type Deps } from '@cella/org-db'
import type { actions } from '../models/actions.ts'
import type { Amend, Amended, Arrange, Arranged, Create, Created, Icon, Iconed, Terms } from '../models/circle.ts'

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
        `SELECT name, purpose, procedure FROM circle.circle WHERE id = $1 FOR UPDATE`,
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

// Arranges a circle's features, replaced by the listing given: citing the
// motion that arranges them, `circle:circle:arrange`, or, citing none, at
// once by the actor's own power over the circle, `circle:feature:arrange`.
// Its entry carries the listing and the one it replaced, each as
// `circle.features` spells them, so a motion's and a holder's fold alike.
export async function arrange(input: Arrange, deps: Deps): Out<'circle:circle:arrange' | 'circle:feature:arrange', Arranged> {
  return write(deps, {
    op: (input.motion ? 'circle:circle:arrange' : 'circle:feature:arrange') satisfies Action,
    request: input,
    state: async (tx) => {
      const { rows } = await tx.query<{ was: string }>(`SELECT circle.features(id) AS was FROM circle.circle WHERE id = $1 FOR UPDATE`, [input.circle])
      await tx.query(`DELETE FROM circle.feature WHERE circle = $1`, [input.circle])
      await tx.query(
        `INSERT INTO circle.feature (circle, feat, position, "group")
         SELECT $1, l.feat, l.position, l."group" FROM circle.listed($2) l
         ON CONFLICT DO NOTHING`,
        [input.circle, input.features],
      )
      return { circle: input.circle, was: rows[0]?.was ?? '' }
    },
    payload: (v) => ({ circle: v.circle, features: input.features, was: v.was, ...(input.motion ? { motion: input.motion } : {}) }),
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
