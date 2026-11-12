import type { App } from '@cella/org-ui'
import { app as membership } from '@cella/org-membership/app'
import { app as motion } from '@cella/org-motion/app'
import { app as document } from '@cella/org-document/app'
import { app as contact } from '@cella/org-contact/app'
import { app as invoice } from '@cella/org-invoice/app'
import { app as account } from '@cella/org-account/app'
import { app as patronage } from '@cella/org-patronage/app'
import { app as transaction } from '@cella/org-transaction/app'
import { app as project } from '@cella/org-project/app'
import { app as task } from '@cella/org-task/app'
import { app as timesheet } from '@cella/org-timesheet/app'
import { app as employment } from '@cella/org-employment/app'
import { app as file } from '@cella/org-file/app'
import { app as imports } from '@cella/org-import/app'
import { seats as membershipSeats } from '@cella/org-membership/app'
import { circles as motionCircles } from '@cella/org-motion/app'
import { circles as membershipMotionCircles } from '@cella/org-graft-membership-motion/app'
import { app as membershipMotion } from '@cella/org-graft-membership-motion/app'
import { app as documentMotion } from '@cella/org-graft-document-motion/app'
import { app as contactInvoice } from '@cella/org-graft-contact-invoice/app'
import { app as invoiceTransaction } from '@cella/org-graft-invoice-transaction/app'
import { app as accountTransaction } from '@cella/org-graft-account-transaction/app'
import { app as contactProject } from '@cella/org-graft-contact-project/app'
import { app as invoiceProject } from '@cella/org-graft-invoice-project/app'
import { app as membershipProject } from '@cella/org-graft-membership-project/app'
import { app as membershipTask } from '@cella/org-graft-membership-task/app'
import { app as projectTask } from '@cella/org-graft-project-task/app'
import { app as projectTimesheet } from '@cella/org-graft-project-timesheet/app'
import { app as expense } from '@cella/org-expense/app'
import { app as bill } from '@cella/org-bill/app'
import { app as payslip } from '@cella/org-payslip/app'
import { app as report } from '@cella/org-report/app'
import { app as accountMotion } from '@cella/org-graft-account-motion/app'
import { app as accountMembership } from '@cella/org-graft-account-membership/app'
import { app as accountMembershipTransaction } from '@cella/org-graft-account-membership-transaction/app'
import { app as accountMembershipPayslipTransaction } from '@cella/org-graft-account-membership-payslip-transaction/app'
import { app as accountMembershipPatronage } from '@cella/org-graft-account-membership-patronage/app'
import { app as accountMembershipPatronageTransaction } from '@cella/org-graft-account-membership-patronage-transaction/app'
import { app as motionPatronage } from '@cella/org-graft-motion-patronage/app'
import { app as patronagePayslip } from '@cella/org-graft-patronage-payslip/app'
import { app as patronageTimesheet } from '@cella/org-graft-patronage-timesheet/app'
import { app as patronageTransaction } from '@cella/org-graft-patronage-transaction/app'
import { app as expenseMembership } from '@cella/org-graft-expense-membership/app'
import { app as expenseProject } from '@cella/org-graft-expense-project/app'
import { app as expenseTransaction } from '@cella/org-graft-expense-transaction/app'
import { app as billTransaction } from '@cella/org-graft-bill-transaction/app'
import { app as payslipTransaction } from '@cella/org-graft-payslip-transaction/app'
import { app as meeting } from '@cella/org-meeting/app'
import { circles as meetingCircles } from '@cella/org-meeting/app'
import { circles as meetingMembershipCircles } from '@cella/org-graft-meeting-membership/app'
import { app as meetingMotion } from '@cella/org-graft-meeting-motion/app'
import { app as documentMeeting } from '@cella/org-graft-document-meeting/app'
import { app as meetingMembership } from '@cella/org-graft-meeting-membership/app'
import { app as employmentMembershipMotion } from '@cella/org-graft-employment-membership-motion/app'
import { app as documentMembership } from '@cella/org-graft-document-membership/app'
import { app as employmentMembership } from '@cella/org-graft-employment-membership/app'
import { app as employmentPayslip } from '@cella/org-graft-employment-payslip/app'
import { app as employmentTimesheet } from '@cella/org-graft-employment-timesheet/app'
import { app as employmentProjectTimesheet } from '@cella/org-graft-employment-project-timesheet/app'
import { app as employmentFile } from '@cella/org-graft-employment-file/app'
import { app as fileMembership } from '@cella/org-graft-file-membership/app'
import { app as expenseFile } from '@cella/org-graft-expense-file/app'

// The client sides above core, matching the server's (`server/feats/`) by
// name: each feat's views and pages, each graft's extensions, and the
// root's own: the cards of the work collections, whose fields come from
// several grafts no one graft may name together.
const root: App = {
  name: 'org',
  extends: {
    projects: { look: { cards: ['contact', 'progress', 'budget', 'used'] } },
    tasks: { look: { cards: ['assignee', 'project', 'priority', 'due'] } },
  },
}

export const feats: App[] = [
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
  report,
  employmentMembershipMotion,
  documentMembership,
  membershipSeats.app,
  motionCircles.app,
  membershipMotionCircles.app,
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
  payslipTransaction,
  meetingCircles.app,
  meetingMotion,
  documentMeeting,
  meetingMembership,
  meetingMembershipCircles.app,
  employmentMembership,
  employmentPayslip,
  employmentTimesheet,
  employmentProjectTimesheet,
  employmentFile,
  fileMembership,
  expenseFile,
  root,
]
