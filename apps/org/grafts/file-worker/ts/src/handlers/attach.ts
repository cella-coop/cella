import type { Outcome } from '@cella/org-ops'
import { write, type Deps } from '@cella/org-db'
import { committed, request, storing } from '@cella/org-file/api'
import type { Stored } from '@cella/org-file/models'
import type { ops } from '../models/ops.ts'
import type { Attach, Attached } from '../models/record.ts'

const op = 'file-worker:worker:attach' satisfies keyof typeof ops

// Files a record for a worker in one write: the file stored about them, of
// class payroll, and kept on their file. The log commits to its name and
// BLAKE3; `file_worker.files` checks the rest.
export async function attach(input: Attach, deps: Deps): Promise<Outcome<(typeof ops)[typeof op], Attached>> {
  let stored: Stored | null = null
  return write(deps, {
    op,
    request: { worker: input.worker, file: request(input.file) },
    state: async (tx) => {
      stored = await storing(tx, { ...input.file, class: 'payroll', subject: input.worker }, deps.actor)
      await tx.query('INSERT INTO file_worker.record (worker, file) VALUES ($1, $2)', [input.worker, stored.file])
      return { worker: input.worker, file: stored.file }
    },
    payload: (v) => ({ ...(stored ? committed(stored, input.file.name) : {}), worker: v.worker }),
  })
}
