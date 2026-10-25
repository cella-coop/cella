import type { Outcome } from '@cella/org-ops'
import { write, type Deps } from '@cella/org-db'
import type { ops } from '../models/ops.ts'
import type { Marked, Read } from '../models/reading.ts'

const op = 'document-member:version:read' satisfies keyof typeof ops

// Marks a version read by the member, on the verdict date; marking it
// again keeps the first day. `document_member.reads` refuses anyone's but
// the actor's own.
export async function read(input: Read, deps: Deps): Promise<Outcome<(typeof ops)[typeof op], Marked>> {
  return write(deps, {
    op,
    request: input,
    state: async (tx) => {
      const { rows } = await tx.query<{ read: string }>(
        `INSERT INTO document_member.reading (version, member, read) VALUES ($1, $2, cella.verdict_date())
         ON CONFLICT (version, member) DO UPDATE SET read = document_member.reading.read
         RETURNING to_char(read, 'YYYY-MM-DD') AS read`,
        [input.version, input.member],
      )
      return { ...input, read: rows[0].read }
    },
    payload: (v) => ({ ...v }),
  })
}
