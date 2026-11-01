import type { Outcome } from '@cella/org-ops'
import { write, type Deps } from '@cella/org-db'
import type { ops } from '../models/ops.ts'
import type { Draft, Drafted } from '../models/distribution.ts'
import type { DraftTerms, DraftedTerms } from '../models/terms.ts'

type Op = keyof typeof ops
type Out<O extends Op, T> = Promise<Outcome<(typeof ops)[O], T>>

const kinds = ['work', 'legal', 'development', 'interest'] as const

// Drafts the statutes' terms from a year on, `st-<year>`, or drafts them
// again while they are not adopted; adopted terms never change. The guards
// decide: `patronage.drafts_terms` that they divide the whole work share.
// The members adopt them by a decision that moves to.
export async function draftTerms(input: DraftTerms, deps: Deps): Out<'patronage:terms:draft', DraftedTerms> {
  return write(deps, {
    op: 'patronage:terms:draft' satisfies Op,
    request: input,
    state: async (tx) => {
      const { rows } = await tx.query<{ id: string }>(
        `INSERT INTO patronage.terms (id, "from", salary, hours, equal, capital, interest)
         VALUES ('st-' || $1::integer, $1::integer, $2 / 100.0, $3 / 100.0, $4 / 100.0, $5 / 100.0, $6 / 100.0)
         ON CONFLICT (id) DO UPDATE SET "from" = excluded."from", salary = excluded.salary, hours = excluded.hours,
           equal = excluded.equal, capital = excluded.capital, interest = excluded.interest
         RETURNING id`,
        [input.from, input.salary, input.hours, input.equal, input.capital, input.interest],
      )
      return { ...input, terms: rows[0].id }
    },
    payload: (v) => ({ ...v }),
  })
}

// Drafts a year's split, or drafts it again while it is not approved:
// its surplus, the basis of the terms governing the year, and each share
// at its percent, split from the surplus to the cent with
// `cella.allocate`. The guards decide: `patronage.drafts` that the year has
// adopted terms and the shares make the whole surplus; the law's floors
// are judged when the assembly approves it.
export async function draft(input: Draft, deps: Deps): Out<'patronage:distribution:draft', Drafted> {
  return write(deps, {
    op: 'patronage:distribution:draft' satisfies Op,
    request: input,
    state: async (tx) => {
      // A year with no adopted terms takes `mix` as a placeholder, which
      // never stands: `patronage.drafts` refuses the write.
      const { rows } = await tx.query<{ id: string }>(
        `INSERT INTO patronage.distribution (id, year, surplus, basis)
         VALUES ($1::integer::text, $1::integer, cella.amount($2::bigint), coalesce(patronage.basis_of(patronage.terms_for($1::integer)), 'mix'))
         ON CONFLICT (year) DO UPDATE SET surplus = excluded.surplus, basis = excluded.basis
         RETURNING id`,
        [input.year, input.surplus],
      )
      const id = rows[0].id
      const percents = kinds.map((k) => input[k])
      await tx.query('DELETE FROM patronage.share WHERE distribution = $1', [id])
      if (percents.some((p) => p > 0)) {
        await tx.query(
          `INSERT INTO patronage.share (distribution, kind, percent, amount)
           SELECT $1, k.kind, k.hundredths / 100.0, cella.amount((cella.allocate(cella.amount($2::bigint), $4::bigint[]))[k.n])
           FROM unnest($3::text[], $4::bigint[]) WITH ORDINALITY AS k (kind, hundredths, n)
           WHERE k.hundredths > 0`,
          [id, input.surplus, kinds, percents],
        )
      }
      return { ...input, distribution: id }
    },
    payload: (v) => ({ ...v }),
  })
}
