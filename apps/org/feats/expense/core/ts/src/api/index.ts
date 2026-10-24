// The feat's public writes, POST /api/expense/<op> once the server exists,
// the write specs and form readers a graft composes, its reads, and its
// slice, which the shell mounts.
import { action, type Slice } from '@cella/org-db'
import { capture, refuse, submit } from '../handlers/index.ts'
import { expense, expenses } from '../drivers/expense.ts'
import * as forms from './forms.ts'

export { approve, approving, capture, capturing, refuse, reimburse, reimbursing, submit } from '../handlers/index.ts'
export { expense, expenses } from '../drivers/expense.ts'
export * as forms from './forms.ts'

// The expenses, a claim as the acting member, and on an expense's page
// submitting or refusing it. Approving and reimbursing post to the books,
// so their writes are the expense-transaction graft's.
export const slice: Slice = {
  name: 'expense',
  collections: {
    expenses: {
      list: expenses,
      about: async () => ({ today: new Date().toISOString().slice(0, 10) }),
      item: expense,
      index: async (db) => (await expenses(db)).map((e) => ({ id: e.id, title: e.label, sub: `${e.id}, ${e.status}` })),
      actions: {
        capture: action('expense:expense:capture', (form, _, deps) => forms.capture(form, deps.actor), capture),
        submit: action('expense:expense:submit', (_, id) => ({ expense: id ?? '' }), submit),
        refuse: action('expense:expense:refuse', (_, id) => ({ expense: id ?? '' }), refuse),
      },
    },
  },
}
