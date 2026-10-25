import type { Action, Collection, Db, Extension, Reaction, Slice } from '@cella/org-db'
import type { Permission } from '@cella/org-ops'
import { slice as log } from '@cella/org-log/api'
import { slice as key } from '@cella/org-key/api'
import { slice as member } from '@cella/org-member/api'
import { slice as circle } from '@cella/org-circle/api'
import { slice as decision } from '@cella/org-decision/api'
import { slice as document } from '@cella/org-document/api'
import { slice as client } from '@cella/org-client/api'
import { slice as invoice } from '@cella/org-invoice/api'
import { slice as account } from '@cella/org-account/api'
import { slice as transaction } from '@cella/org-transaction/api'
import { slice as project } from '@cella/org-project/api'
import { slice as task } from '@cella/org-task/api'
import { slice as timesheet } from '@cella/org-timesheet/api'
import { slice as worker } from '@cella/org-worker/api'
import { slice as circleMember } from '@cella/org-graft-circle-member/api'
import { slice as circleDecision } from '@cella/org-graft-circle-decision/api'
import { slice as keyMember } from '@cella/org-graft-key-member/api'
import { slice as circleDecisionMember } from '@cella/org-graft-circle-decision-member/api'
import { slice as decisionMember } from '@cella/org-graft-decision-member/api'
import { slice as decisionDocument } from '@cella/org-graft-decision-document/api'
import { slice as clientInvoice } from '@cella/org-graft-client-invoice/api'
import { slice as invoiceTransaction } from '@cella/org-graft-invoice-transaction/api'
import { slice as accountTransaction } from '@cella/org-graft-account-transaction/api'
import { slice as clientProject } from '@cella/org-graft-client-project/api'
import { slice as invoiceProject } from '@cella/org-graft-invoice-project/api'
import { slice as memberProject } from '@cella/org-graft-member-project/api'
import { slice as memberTask } from '@cella/org-graft-member-task/api'
import { slice as memberTimesheet } from '@cella/org-graft-member-timesheet/api'
import { slice as projectTask } from '@cella/org-graft-project-task/api'
import { slice as projectTimesheet } from '@cella/org-graft-project-timesheet/api'
import { slice as expenseInvoiceProjectTimesheet } from '@cella/org-graft-expense-invoice-project-timesheet/api'
import { slice as expense } from '@cella/org-expense/api'
import { slice as payslip } from '@cella/org-payslip/api'
import { slice as accountDecision } from '@cella/org-graft-account-decision/api'
import { slice as accountMember } from '@cella/org-graft-account-member/api'
import { slice as accountMemberTransaction } from '@cella/org-graft-account-member-transaction/api'
import { slice as accountMemberPayslipTransaction } from '@cella/org-graft-account-member-payslip-transaction/api'
import { slice as accountPayslip } from '@cella/org-graft-account-payslip/api'
import { slice as accountTimesheet } from '@cella/org-graft-account-timesheet/api'
import { slice as expenseMember } from '@cella/org-graft-expense-member/api'
import { slice as expenseProject } from '@cella/org-graft-expense-project/api'
import { slice as expenseTransaction } from '@cella/org-graft-expense-transaction/api'
import { slice as memberPayslip } from '@cella/org-graft-member-payslip/api'
import { slice as payslipTimesheet } from '@cella/org-graft-payslip-timesheet/api'
import { slice as payslipTransaction } from '@cella/org-graft-payslip-transaction/api'
import { slice as meeting } from '@cella/org-meeting/api'
import { slice as circleMeeting } from '@cella/org-graft-circle-meeting/api'
import { slice as circleMeetingMember } from '@cella/org-graft-circle-meeting-member/api'
import { slice as decisionMeeting } from '@cella/org-graft-decision-meeting/api'
import { slice as documentMeeting } from '@cella/org-graft-document-meeting/api'
import { slice as meetingMember } from '@cella/org-graft-meeting-member/api'
import { slice as decisionMemberWorker } from '@cella/org-graft-decision-member-worker/api'
import { slice as documentMember } from '@cella/org-graft-document-member/api'
import { slice as keyWorker } from '@cella/org-graft-key-worker/api'
import { slice as memberWorker } from '@cella/org-graft-member-worker/api'
import { slice as payslipWorker } from '@cella/org-graft-payslip-worker/api'
import { slice as timesheetWorker } from '@cella/org-graft-timesheet-worker/api'
import { slice as circleMemberTimesheet } from '@cella/org-graft-circle-member-timesheet/api'
import { slice as circleExpenseMember } from '@cella/org-graft-circle-expense-member/api'
import { slice as circleMemberPayslip } from '@cella/org-graft-circle-member-payslip/api'
import { slice as projectTimesheetWorker } from '@cella/org-graft-project-timesheet-worker/api'

// The server sides the shell mounts: each feat's collections, each graft's
// extensions of the feats it joins, and the root's own, which may join
// feats no graft joins; it joins none today.
const root: Slice = {
  name: 'org',
  extends: {},
}

export const slices: Slice[] = [
  member,
  circle,
  decision,
  document,
  meeting,
  client,
  project,
  task,
  timesheet,
  worker,
  invoice,
  account,
  transaction,
  expense,
  payslip,
  key,
  log,
  circleMember,
  circleDecision,
  circleDecisionMember,
  decisionMember,
  keyMember,
  decisionDocument,
  clientInvoice,
  clientProject,
  invoiceProject,
  memberProject,
  memberTask,
  memberTimesheet,
  projectTask,
  projectTimesheet,
  expenseInvoiceProjectTimesheet,
  invoiceTransaction,
  accountTransaction,
  accountDecision,
  accountMember,
  accountMemberTransaction,
  accountMemberPayslipTransaction,
  accountPayslip,
  accountTimesheet,
  expenseMember,
  expenseProject,
  expenseTransaction,
  memberPayslip,
  payslipTimesheet,
  payslipTransaction,
  circleMeeting,
  decisionMeeting,
  documentMeeting,
  meetingMember,
  circleMeetingMember,
  keyWorker,
  memberWorker,
  payslipWorker,
  timesheetWorker,
  documentMember,
  decisionMemberWorker,
  circleMemberTimesheet,
  circleExpenseMember,
  circleMemberPayslip,
  projectTimesheetWorker,
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

// A graft extends only the collections of the feats it joins; the root
// may join any.
for (const s of slices) {
  for (const [name, extension] of Object.entries(s.extends ?? {})) {
    const mounted = collections.get(name)
    if (!mounted) {
      throw new Error(`${s.name} extends ${name}, which no slice owns`)
    }
    if (s !== root && !s.name.split('-').includes(mounted.owner.name)) {
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

// A collection's rows as the acting member sees them: its owner's and
// those its extensions add, each with the fields its extensions add.
export async function rows(db: Db, name: string, actor: string | null): Promise<{ id: string }[]> {
  const m = collections.get(name)
  if (!m) {
    return []
  }
  const owned = [
    ...(await m.collection.list(db, actor)),
    ...(await Promise.all(m.extensions.map((e) => e.extension.rows?.(db, actor) ?? []))).flat(),
  ]
  const added = await Promise.all(m.extensions.map((e) => e.extension.list?.(db)))
  return owned.map((r) => Object.assign({}, r, ...added.map((a) => a?.[r.id])))
}
