import type { Outcome } from '@cella/org-ops'
import { write, type Deps } from '@cella/org-db'
import type { ops } from '../models/ops.ts'
import type { Recorded, Recording } from '../models/run.ts'

const op = 'import:run:record' satisfies keyof typeof ops

// Records what an import, or a dry run of one, came to, as the importer
// on the verdict date: a line settled or pending counts as settled, and
// any other as refused.
export async function record(input: Recording, deps: Deps): Promise<Outcome<(typeof ops)[typeof op], Recorded>> {
  const settled = input.lines.filter((l) => l.state === 'settled' || l.state === 'pending').length
  const refused = input.lines.length - settled
  return write(deps, {
    op,
    request: { kind: input.kind, name: input.name, dry: input.dry, lines: input.lines.length },
    state: async (tx) => {
      const { rows } = await tx.query<{ id: string }>(
        `INSERT INTO import.run (kind, name, actor, day, dry, settled, refused, lines)
         VALUES ($1, $2, $3, cella.verdict_date(), $4, $5, $6, $7) RETURNING id`,
        [input.kind, input.name, deps.actor, input.dry, settled, refused, JSON.stringify(input.lines)],
      )
      return { run: rows[0].id, kind: input.kind, dry: input.dry, settled, refused }
    },
    payload: (v) => ({ ...v }),
  })
}
