import type { Outcome } from '@cella/org-ops'
import { personal, write, type Deps, type Write } from '@cella/org-db'
import type { ops } from '../models/ops.ts'
import { contracts, type Hire, type Hired } from '../models/worker.ts'

type Op = keyof typeof ops

// The hire as a write a graft may extend in its transaction, as key-worker
// does with the worker's first device: the worker and their contract,
// recorded on the verdict date. The name is personal data: the log
// commits to it and the vault keeps it; `worker.hires` checks the write
// made the row.
export function hiring(input: Hire): Write<Hired> {
  if (!contracts.includes(input.contract)) {
    throw new Error(`“${input.contract}” is no contract: ${contracts.join(', ')}`)
  }
  return {
    op: 'worker:worker:hire' satisfies Op,
    request: input,
    state: async (tx) => {
      const taken = await tx.query('SELECT FROM worker.worker WHERE address = $1', [input.worker])
      if (taken.rowCount) {
        throw new Error(`${input.worker} is a worker's address already`)
      }
      const { rows } = await tx.query<{ hired: string }>(
        `INSERT INTO worker.worker (address, name, job, contract, start, until, minutes, hired)
         VALUES ($1, $2, $3, $4, $5, $6, $7, cella.verdict_date()) RETURNING to_char(hired, 'YYYY-MM-DD') AS hired`,
        [input.worker, input.name, input.job, input.contract, input.start, input.until ?? null, input.minutes],
      )
      return {
        worker: input.worker,
        job: input.job,
        contract: input.contract,
        start: input.start,
        until: input.until ?? null,
        minutes: input.minutes,
        hired: rows[0].hired,
      }
    },
    payload: (v) => ({ ...v, name: personal('worker.worker.name', input.worker, input.name) }),
  }
}

export async function hire(input: Hire, deps: Deps): Promise<Outcome<(typeof ops)['worker:worker:hire'], Hired>> {
  return write(deps, hiring(input))
}
