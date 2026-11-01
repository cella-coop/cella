import type { Outcome } from '@cella/org-actions'
import { personal, write, type Deps, type Write } from '@cella/org-db'
import { enrolling, entering } from '@cella/org-person/api'
import type { actions } from '../models/actions.ts'
import { contracts, type Hire, type Hired } from '../models/worker.ts'

type Action = keyof typeof actions

// The hire: the worker and their contract, recorded on the verdict date,
// with their first device, enrolled by no device, so they sign their own
// time from their first day. Someone the co-op knows already, as a member,
// is the same person and keeps their name; someone new becomes a person.
// The register of the staff copies the name, which is personal data: the
// log commits to it and the vault keeps it. The payload commits to the
// key; the label stays out. `employment.hires` checks the write made the
// row, and `employment.carries` that it enrolled the device.
export function hiring(input: Hire): Write<Hired> {
  if (!contracts.includes(input.contract)) {
    throw new Error(`“${input.contract}” is no contract: ${contracts.join(', ')}`)
  }
  const key = input.key.trim().toLowerCase()
  if (!/^[0-9a-f]{64}$/.test(key)) {
    throw new Error('a device key is 32 bytes in hex, as the worker’s device shows it')
  }
  return {
    op: 'employment:worker:hire' satisfies Action,
    // The key as the payload restates it, so the member signs that.
    request: { ...input, key },
    state: async (tx) => {
      const taken = await tx.query('SELECT FROM employment.worker WHERE address = $1', [input.worker])
      if (taken.rowCount) {
        throw new Error(`${input.worker} is a worker's address already`)
      }
      await entering(tx, { address: input.worker, name: input.name })
      const { rows } = await tx.query<{ hired: string }>(
        `INSERT INTO employment.worker (address, name, job, contract, start, until, minutes, hired)
         VALUES ($1, $2, $3, $4, $5, $6, $7, cella.verdict_date()) RETURNING to_char(hired, 'YYYY-MM-DD') AS hired`,
        [input.worker, input.name, input.job, input.contract, input.start, input.until ?? null, input.minutes],
      )
      await enrolling(tx, { key, address: input.worker, label: input.label.trim() })
      return {
        worker: input.worker,
        job: input.job,
        contract: input.contract,
        start: input.start,
        until: input.until ?? null,
        minutes: input.minutes,
        hired: rows[0].hired,
        key,
      }
    },
    payload: (v) => ({ ...v, name: personal('employment.worker.name', input.worker, input.name) }),
  }
}

export async function hire(input: Hire, deps: Deps): Promise<Outcome<(typeof actions)['employment:worker:hire'], Hired>> {
  return write(deps, hiring(input))
}
