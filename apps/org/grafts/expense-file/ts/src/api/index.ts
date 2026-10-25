// The graft's writes, reads and slice, which the shell mounts: a claim
// carrying its receipt, replacing the expense feat's, and on an
// expense's page its receipts and another attached.
import { action, type Slice } from '@cella/org-db'
import { forms as expense } from '@cella/org-expense/api'
import { forms as file } from '@cella/org-file/api'
import { attach, capture } from '../handlers/index.ts'
import { counts, receipts } from '../drivers/receipt.ts'

export { attach, capture } from '../handlers/index.ts'
export { counts, receipts } from '../drivers/receipt.ts'

export const slice: Slice = {
  name: 'expense-file',
  extends: {
    expenses: {
      list: counts,
      item: async (db, id) => ({ receipts: await receipts(db, id) }),
      actions: {
        capture: action(
          'expense:expense:capture',
          (form, _, deps) => ({
            ...expense.capture(form, deps.actor),
            file: form.file('file') ? file.store(form, 'file', 'expense-receipt', deps.actor) : null,
          }),
          capture,
        ),
        attach: action(
          'expense-file:expense:attach',
          (form, id, deps) => ({ expense: id ?? '', file: file.store(form, 'file', 'expense-receipt', deps.actor) }),
          attach,
        ),
      },
    },
  },
}
