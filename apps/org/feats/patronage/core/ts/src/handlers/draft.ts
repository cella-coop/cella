import type { Outcome } from '@cella/org-actions'
import { write, type Deps } from '@cella/org-db'
import type { actions } from '../models/actions.ts'
import type { Draft, Drafted } from '../models/distribution.ts'

type Action = keyof typeof actions
type Out<O extends Action, T> = Promise<Outcome<(typeof actions)[O], T>>

const kinds = ['work', 'legal', 'development', 'interest'] as const

// Drafts a year's split, or drafts it again while it is not approved:
// its surplus, the basis of the terms governing the year, and each share
// at its percent, split from the surplus to the cent with
// `cella.allocate`. The guards decide: `patronage.drafts` that the year has
// adopted terms and the shares make the whole surplus; the law's floors
// are judged when the assembly approves it.
export async function draft(input: Draft, deps: Deps): Out<'patronage:distribution:draft', Drafted> {
  return write(deps, {
    op: 'patronage:distribution:draft' satisfies Action,
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
