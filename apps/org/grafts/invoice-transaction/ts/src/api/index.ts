// The graft's writes: an invoice event and its posting, in one write; its
// reads, and its slice, which the shell mounts.
import { action, type Slice } from '@cella/org-db'
import { forms } from '@cella/org-invoice/api'
import { annul, issue, payment } from '../handlers/post.ts'
import { postings } from '../drivers/posting.ts'
import { invoices } from './imports.ts'

export { annul, issue, payment } from '../handlers/post.ts'
export { postings } from '../drivers/posting.ts'

// An invoice's postings on its page, and its issue, payments and void
// replaced by the writes that post them to the books in the same verdict;
// and invoices imported to issue, each posted.
export const slice: Slice = {
  name: 'invoice-transaction',
  imports: { invoices },
  extends: {
    invoices: {
      item: postings,
      actions: {
        issue: action('invoice:invoice:issue', (form) => forms.issue(form), issue),
        payment: action('invoice:invoice:payment', (form, id) => forms.payment(form, id ?? ''), payment),
        void: action('invoice:invoice:void', (form, id) => forms.voiding(form, id ?? ''), annul),
      },
    },
  },
}
