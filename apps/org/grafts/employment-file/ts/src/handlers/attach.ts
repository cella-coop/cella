import type { Outcome } from '@cella/org-actions'
import { write, type Deps } from '@cella/org-db'
import { committed, request, storing } from '@cella/org-file/api'
import type { Stored } from '@cella/org-file/models'
import type { actions } from '../models/actions.ts'
import type { Attach, Attached } from '../models/record.ts'

const op = 'employment-file:worker:attach' satisfies keyof typeof actions

// Files a record for a worker in one write: the file stored about them, of
// class payroll, and kept on their file. The log commits to its name and
// BLAKE3; `employment_file.files` checks the rest.
export async function attach(input: Attach, deps: Deps): Promise<Outcome<(typeof actions)[typeof op], Attached>> {
  let stored: Stored | null = null
  return write(deps, {
    op,
    request: { worker: input.worker, file: request(input.file) },
    state: async (tx) => {
      stored = await storing(tx, { ...input.file, class: 'payroll', subject: input.worker }, deps.actor)
      await tx.query('INSERT INTO employment_file.record (worker, file) VALUES ($1, $2)', [input.worker, stored.file])
      return { worker: input.worker, file: stored.file }
    },
    payload: (v) => ({ ...(stored ? committed(stored, input.file.name) : {}), worker: v.worker }),
  })
}
