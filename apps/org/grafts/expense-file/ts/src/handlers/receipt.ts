import type { Outcome } from '@cella/org-ops'
import { write, type Db, type Deps } from '@cella/org-db'
import { capturing } from '@cella/org-expense/api'
import type { Captured, ops as claims } from '@cella/org-expense/models'
import { committed, request, storing } from '@cella/org-file/api'
import type { Stored } from '@cella/org-file/models'
import type { ops } from '../models/ops.ts'
import type { Attach, Attached, Claim } from '../models/receipt.ts'

// Stores a receipt about the acting member and attaches it to the expense.
async function attaching(tx: Db, expense: string, input: Attach['file'], actor: string): Promise<Stored> {
  const stored = await storing(tx, { ...input, class: 'expense-receipt', subject: actor }, actor)
  await tx.query('INSERT INTO expense_file.receipt (expense, file) VALUES ($1, $2)', [expense, stored.file])
  return stored
}

// Claims an expense with its receipt in one write, replacing the expense
// feat's capture: the claim, then the receipt stored and attached. The
// log commits to the receipt's name and BLAKE3, as to the claim's label;
// `expense_file.attaches` checks the receipt is the member's own.
export async function capture(input: Claim, deps: Deps): Promise<Outcome<(typeof claims)['expense:expense:capture'], Captured & { file?: string }>> {
  const { file, ...claim } = input
  const w = capturing(claim)
  let stored: Stored | null = null
  return write(deps, {
    op: w.op,
    request: { ...claim, file: file ? request(file) : null },
    state: async (tx, proof) => {
      const value = await w.state(tx, proof)
      stored = file ? await attaching(tx, value.expense, file, deps.actor) : null
      return stored ? { ...value, file: stored.file } : value
    },
    payload: (v) => ({ ...w.payload(v), ...(stored && file ? { ...committed(stored, file.name), expense: v.expense } : {}) }),
  })
}

const op = 'expense-file:expense:attach' satisfies keyof typeof ops

// Attaches a receipt to an expense already claimed, its member's own.
export async function attach(input: Attach, deps: Deps): Promise<Outcome<(typeof ops)[typeof op], Attached>> {
  let stored: Stored | null = null
  return write(deps, {
    op,
    request: { expense: input.expense, file: request(input.file) },
    state: async (tx) => {
      stored = await attaching(tx, input.expense, input.file, deps.actor)
      return { expense: input.expense, file: stored.file }
    },
    payload: (v) => ({ ...(stored ? committed(stored, input.file.name) : {}), expense: v.expense }),
  })
}
