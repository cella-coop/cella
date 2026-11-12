import type { Slice } from '@cella/org-db'
import { slice as membership } from '@cella/org-membership/api'
import { slice as motion } from '@cella/org-motion/api'
import { slice as document } from '@cella/org-document/api'
import { slice as contact } from '@cella/org-contact/api'
import { slice as invoice } from '@cella/org-invoice/api'
import { slice as account } from '@cella/org-account/api'
import { slice as patronage } from '@cella/org-patronage/api'
import { slice as transaction } from '@cella/org-transaction/api'
import { slice as project } from '@cella/org-project/api'
import { slice as task } from '@cella/org-task/api'
import { slice as timesheet } from '@cella/org-timesheet/api'
import { slice as employment } from '@cella/org-employment/api'
import { slice as file } from '@cella/org-file/api'
import { slice as imports } from '@cella/org-import/api'
import { seats as membershipSeats } from '@cella/org-membership/api'
import { circles as motionCircles } from '@cella/org-motion/api'
import { circles as membershipMotionCircles } from '@cella/org-graft-membership-motion/api'
import { slice as membershipMotion } from '@cella/org-graft-membership-motion/api'
import { slice as documentMotion } from '@cella/org-graft-document-motion/api'
import { slice as contactInvoice } from '@cella/org-graft-contact-invoice/api'
import { slice as invoiceTransaction } from '@cella/org-graft-invoice-transaction/api'
import { slice as accountTransaction } from '@cella/org-graft-account-transaction/api'
import { slice as contactProject } from '@cella/org-graft-contact-project/api'
import { slice as invoiceProject } from '@cella/org-graft-invoice-project/api'
import { slice as membershipProject } from '@cella/org-graft-membership-project/api'
import { slice as membershipTask } from '@cella/org-graft-membership-task/api'
import { slice as projectTask } from '@cella/org-graft-project-task/api'
import { slice as projectTimesheet } from '@cella/org-graft-project-timesheet/api'
import { slice as expense } from '@cella/org-expense/api'
import { slice as bill } from '@cella/org-bill/api'
import { slice as payslip } from '@cella/org-payslip/api'
import { reporting } from '@cella/org-report/api'
import { slice as accountMotion } from '@cella/org-graft-account-motion/api'
import { slice as accountMembership } from '@cella/org-graft-account-membership/api'
import { slice as accountMembershipTransaction } from '@cella/org-graft-account-membership-transaction/api'
import { slice as accountMembershipPayslipTransaction } from '@cella/org-graft-account-membership-payslip-transaction/api'
import { slice as accountMembershipPatronage } from '@cella/org-graft-account-membership-patronage/api'
import { slice as accountMembershipPatronageTransaction } from '@cella/org-graft-account-membership-patronage-transaction/api'
import { slice as motionPatronage } from '@cella/org-graft-motion-patronage/api'
import { slice as patronagePayslip } from '@cella/org-graft-patronage-payslip/api'
import { slice as patronageTimesheet } from '@cella/org-graft-patronage-timesheet/api'
import { slice as patronageTransaction } from '@cella/org-graft-patronage-transaction/api'
import { slice as expenseMembership } from '@cella/org-graft-expense-membership/api'
import { slice as expenseProject } from '@cella/org-graft-expense-project/api'
import { slice as expenseTransaction } from '@cella/org-graft-expense-transaction/api'
import { slice as billTransaction } from '@cella/org-graft-bill-transaction/api'
import { slice as payslipTimesheet } from '@cella/org-graft-payslip-timesheet/api'
import { slice as payslipTransaction } from '@cella/org-graft-payslip-transaction/api'
import { slice as meeting } from '@cella/org-meeting/api'
import { circles as meetingCircles } from '@cella/org-meeting/api'
import { circles as meetingMembershipCircles } from '@cella/org-graft-meeting-membership/api'
import { slice as meetingMotion } from '@cella/org-graft-meeting-motion/api'
import { slice as documentMeeting } from '@cella/org-graft-document-meeting/api'
import { slice as meetingMembership } from '@cella/org-graft-meeting-membership/api'
import { slice as employmentMembershipMotion } from '@cella/org-graft-employment-membership-motion/api'
import { slice as documentMembership } from '@cella/org-graft-document-membership/api'
import { slice as employmentMembership } from '@cella/org-graft-employment-membership/api'
import { slice as employmentPayslip } from '@cella/org-graft-employment-payslip/api'
import { slice as employmentTimesheet } from '@cella/org-graft-employment-timesheet/api'
import { slice as membershipTimesheet } from '@cella/org-graft-membership-timesheet/api'
import { slice as membershipPayslip } from '@cella/org-graft-membership-payslip/api'
import { slice as employmentProjectTimesheet } from '@cella/org-graft-employment-project-timesheet/api'
import { slice as employmentFile } from '@cella/org-graft-employment-file/api'
import { slice as fileMembership } from '@cella/org-graft-file-membership/api'
import { slice as expenseFile } from '@cella/org-graft-expense-file/api'
import { kinds, run } from './import.ts'
import { port } from '../analytics.ts'

// The slices above core: every feat's and every graft's server side, and
// the root's own, which may join feats no graft joins: an import, which
// runs the writes of whichever slices read the file's kind and records
// the run in the import feat (`import.ts`). Removing them all leaves core
// standing, as `cella check pruned` proves by building the shell with this
// directory's index emptied (architecture.md, "Removing a feat").
export const root: Slice = {
  name: 'org',
  extends: {
    imports: {
      about: async () => ({ kinds: kinds().map(({ kind, title, formats }) => ({ kind, title, formats })) }),
      actions: { run: { op: 'import:run:record', run: (form, deps, id) => run.run(form, deps, id) } },
    },
  },
}

export const feats: Slice[] = [
  membership,
  motion,
  document,
  meeting,
  contact,
  project,
  task,
  timesheet,
  employment,
  file,
  imports,
  invoice,
  account,
  patronage,
  transaction,
  expense,
  bill,
  payslip,
  reporting(port),
  membershipSeats.slice,
  motionCircles.slice,
  membershipMotionCircles.slice,
  membershipMotion,
  documentMotion,
  contactInvoice,
  contactProject,
  invoiceProject,
  membershipProject,
  membershipTask,
  projectTask,
  projectTimesheet,
  invoiceTransaction,
  accountTransaction,
  accountMotion,
  accountMembership,
  accountMembershipTransaction,
  accountMembershipPayslipTransaction,
  accountMembershipPatronageTransaction,
  accountMembershipPatronage,
  motionPatronage,
  patronageTransaction,
  patronagePayslip,
  patronageTimesheet,
  expenseMembership,
  expenseProject,
  expenseTransaction,
  billTransaction,
  payslipTimesheet,
  payslipTransaction,
  meetingCircles.slice,
  meetingMotion,
  documentMeeting,
  meetingMembership,
  meetingMembershipCircles.slice,
  employmentMembership,
  employmentPayslip,
  employmentTimesheet,
  documentMembership,
  employmentMembershipMotion,
  membershipTimesheet,
  membershipPayslip,
  employmentProjectTimesheet,
  employmentFile,
  fileMembership,
  expenseFile,
  root,
]
