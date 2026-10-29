import type { Action, Collection, Extension, Reaction, Slice, Source } from '@cella/org-db'
import type { Permission } from '@cella/org-ops'
import { slice as log } from '@cella/org-log/api'
import { slice as person } from '@cella/org-person/api'
import { slice as membership } from '@cella/org-membership/api'
import { slice as circle } from '@cella/org-circle/api'
import { slice as decision } from '@cella/org-decision/api'
import { slice as document } from '@cella/org-document/api'
import { slice as client } from '@cella/org-client/api'
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
import { slice as circleMembership } from '@cella/org-graft-circle-membership/api'
import { slice as circleDecision } from '@cella/org-graft-circle-decision/api'
import { slice as circleDecisionMembership } from '@cella/org-graft-circle-decision-membership/api'
import { slice as decisionMembership } from '@cella/org-graft-decision-membership/api'
import { slice as decisionDocument } from '@cella/org-graft-decision-document/api'
import { slice as clientInvoice } from '@cella/org-graft-client-invoice/api'
import { slice as invoiceTransaction } from '@cella/org-graft-invoice-transaction/api'
import { slice as accountTransaction } from '@cella/org-graft-account-transaction/api'
import { slice as clientProject } from '@cella/org-graft-client-project/api'
import { slice as invoiceProject } from '@cella/org-graft-invoice-project/api'
import { slice as membershipProject } from '@cella/org-graft-membership-project/api'
import { slice as membershipTask } from '@cella/org-graft-membership-task/api'
import { slice as projectTask } from '@cella/org-graft-project-task/api'
import { slice as projectTimesheet } from '@cella/org-graft-project-timesheet/api'
import { slice as expenseInvoiceProjectTimesheet } from '@cella/org-graft-expense-invoice-project-timesheet/api'
import { slice as expense } from '@cella/org-expense/api'
import { slice as bill } from '@cella/org-bill/api'
import { slice as payslip } from '@cella/org-payslip/api'
import { slice as accountDecision } from '@cella/org-graft-account-decision/api'
import { slice as accountMembership } from '@cella/org-graft-account-membership/api'
import { slice as accountMembershipTransaction } from '@cella/org-graft-account-membership-transaction/api'
import { slice as accountMembershipPayslipTransaction } from '@cella/org-graft-account-membership-payslip-transaction/api'
import { slice as accountMembershipPatronage } from '@cella/org-graft-account-membership-patronage/api'
import { slice as accountMembershipPatronageTransaction } from '@cella/org-graft-account-membership-patronage-transaction/api'
import { slice as decisionPatronage } from '@cella/org-graft-decision-patronage/api'
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
import { slice as circleMeeting } from '@cella/org-graft-circle-meeting/api'
import { slice as circleMeetingMembership } from '@cella/org-graft-circle-meeting-membership/api'
import { slice as decisionMeeting } from '@cella/org-graft-decision-meeting/api'
import { slice as documentMeeting } from '@cella/org-graft-document-meeting/api'
import { slice as meetingMembership } from '@cella/org-graft-meeting-membership/api'
import { slice as decisionEmploymentMembership } from '@cella/org-graft-decision-employment-membership/api'
import { slice as documentMembership } from '@cella/org-graft-document-membership/api'
import { slice as employmentMembership } from '@cella/org-graft-employment-membership/api'
import { slice as employmentPayslip } from '@cella/org-graft-employment-payslip/api'
import { slice as employmentTimesheet } from '@cella/org-graft-employment-timesheet/api'
import { slice as circleMembershipTimesheet } from '@cella/org-graft-circle-membership-timesheet/api'
import { slice as circleExpenseMembership } from '@cella/org-graft-circle-expense-membership/api'
import { slice as circleMembershipPayslip } from '@cella/org-graft-circle-membership-payslip/api'
import { slice as employmentProjectTimesheet } from '@cella/org-graft-employment-project-timesheet/api'
import { slice as employmentFile } from '@cella/org-graft-employment-file/api'
import { slice as fileMembership } from '@cella/org-graft-file-membership/api'
import { slice as expenseFile } from '@cella/org-graft-expense-file/api'
import { slice as circleFileMembership } from '@cella/org-graft-circle-file-membership/api'
import { kinds, run } from './import.ts'

// The server sides the shell mounts: each feat's collections, each graft's
// extensions of the feats it joins, and the root's own, which may join
// feats no graft joins: an import, which runs the writes of whichever
// slices read the file's kind and records the run in the import feat
// (`import.ts`).
const root: Slice = {
  name: 'org',
  extends: {
    imports: {
      about: async () => ({ kinds: kinds().map(({ kind, title, formats }) => ({ kind, title, formats })) }),
      actions: { run: { op: 'import:run:record', run: (form, deps, id) => run.run(form, deps, id) } },
    },
  },
}

export const slices: Slice[] = [
  person,
  membership,
  circle,
  decision,
  document,
  meeting,
  client,
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
  log,
  circleMembership,
  circleDecision,
  circleDecisionMembership,
  decisionMembership,
  decisionDocument,
  clientInvoice,
  clientProject,
  invoiceProject,
  membershipProject,
  membershipTask,
  projectTask,
  projectTimesheet,
  expenseInvoiceProjectTimesheet,
  invoiceTransaction,
  accountTransaction,
  accountDecision,
  accountMembership,
  accountMembershipTransaction,
  accountMembershipPayslipTransaction,
  accountMembershipPatronageTransaction,
  accountMembershipPatronage,
  decisionPatronage,
  patronageTransaction,
  patronagePayslip,
  patronageTimesheet,
  expenseMembership,
  expenseProject,
  expenseTransaction,
  billTransaction,
  payslipTimesheet,
  payslipTransaction,
  circleMeeting,
  decisionMeeting,
  documentMeeting,
  meetingMembership,
  circleMeetingMembership,
  employmentMembership,
  employmentPayslip,
  employmentTimesheet,
  documentMembership,
  decisionEmploymentMembership,
  circleMembershipTimesheet,
  circleExpenseMembership,
  circleMembershipPayslip,
  employmentProjectTimesheet,
  employmentFile,
  fileMembership,
  expenseFile,
  circleFileMembership,
  root,
]

export interface Mounted {
  owner: Slice
  collection: Collection
  extensions: { slice: Slice; extension: Extension }[]
}

const collections = new Map<string, Mounted>()
for (const s of slices) {
  for (const [name, collection] of Object.entries(s.collections ?? {})) {
    if (collections.has(name)) {
      throw new Error(`${s.name} and ${collections.get(name)?.owner.name} both own the collection ${name}`)
    }
    collections.set(name, { owner: s, collection, extensions: [] })
  }
}

// A graft extends only the collections of the feats it joins and of the
// feats they nest in, and a nested feat those of the feats it nests in;
// the root may join any.
const within = new Map(slices.flatMap((s) => (s.within ? [[s.name, s.within] as const] : [])))
const outer = (feat: string): string[] => {
  const up = within.get(feat)
  return up ? [up, ...outer(up)] : []
}
for (const s of slices) {
  for (const [name, extension] of Object.entries(s.extends ?? {})) {
    const mounted = collections.get(name)
    if (!mounted) {
      throw new Error(`${s.name} extends ${name}, which no slice owns`)
    }
    const reach = s.name.split('-').flatMap((f) => [f, ...outer(f)])
    if (s !== root && !reach.includes(mounted.owner.name)) {
      throw new Error(`${s.name} extends ${name}, ${mounted.owner.name}'s, which it does not join`)
    }
    for (const write of Object.keys(extension.actions ?? {})) {
      const other = mounted.extensions.find((e) => e.extension.actions?.[write])
      if (other) {
        throw new Error(`${s.name} and ${other.slice.name} both replace ${name}'s write ${write}`)
      }
    }
    mounted.extensions.push({ slice: s, extension })
  }
}

export const mounted = (name: string) => collections.get(name)

// A write the collection's pages offer: an extension's, which replaces
// the owner's of the same name, as a graft that posts an invoice's issue
// replaces the invoice feat's issue; else the owner's.
export function action(name: string, write: string): Action | undefined {
  const m = collections.get(name)
  if (!m) {
    return undefined
  }
  return m.extensions.map((e) => e.extension.actions?.[write]).find((a) => a) ?? m.collection.actions?.[write]
}

// Every action name, for the routes' action tables.
export const writes = [
  ...new Set(
    [...collections.values()].flatMap((m) => [
      ...Object.keys(m.collection.actions ?? {}),
      ...m.extensions.flatMap((e) => Object.keys(e.extension.actions ?? {})),
    ]),
  ),
]

// The reactions to a settled op, from every slice.
export const reactions = (op: Permission): Reaction[] => slices.flatMap((s) => s.on?.[op] ?? [])

// What a collection's rows are read from: its owner's select, then those
// of the extensions that add rows of their own, and each extension's
// select of the fields it adds to them. `@cella/org-db` composes them
// into one statement, as the acting member reads, and filters, orders and
// pages it there.
export function source(name: string): Source | undefined {
  const m = collections.get(name)
  if (!m) {
    return undefined
  }
  return {
    rows: [m.collection.list, ...m.extensions.map((e) => e.extension.rows)].filter((r) => r !== undefined),
    fields: m.extensions.flatMap((e) => (e.extension.list ? [e.extension.list] : [])),
  }
}
