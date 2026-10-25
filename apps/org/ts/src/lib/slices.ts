import { icons, type Added, type App, type Column, type Look, type Nav, type Owned, type Pin, type Preset, type Shift, type Widget } from '@cella/org-ui'
import { presets } from '@cella/org-ui/models'
import { app as log } from '@cella/org-log/app'
import { app as key } from '@cella/org-key/app'
import { app as member } from '@cella/org-member/app'
import { app as circle } from '@cella/org-circle/app'
import { app as decision } from '@cella/org-decision/app'
import { app as document } from '@cella/org-document/app'
import { app as client } from '@cella/org-client/app'
import { app as invoice } from '@cella/org-invoice/app'
import { app as account } from '@cella/org-account/app'
import { app as transaction } from '@cella/org-transaction/app'
import { app as project } from '@cella/org-project/app'
import { app as task } from '@cella/org-task/app'
import { app as timesheet } from '@cella/org-timesheet/app'
import { app as worker } from '@cella/org-worker/app'
import { app as circleMember } from '@cella/org-graft-circle-member/app'
import { app as circleDecision } from '@cella/org-graft-circle-decision/app'
import { app as keyMember } from '@cella/org-graft-key-member/app'
import { app as circleDecisionMember } from '@cella/org-graft-circle-decision-member/app'
import { app as decisionMember } from '@cella/org-graft-decision-member/app'
import { app as decisionDocument } from '@cella/org-graft-decision-document/app'
import { app as clientInvoice } from '@cella/org-graft-client-invoice/app'
import { app as invoiceTransaction } from '@cella/org-graft-invoice-transaction/app'
import { app as accountTransaction } from '@cella/org-graft-account-transaction/app'
import { app as clientProject } from '@cella/org-graft-client-project/app'
import { app as invoiceProject } from '@cella/org-graft-invoice-project/app'
import { app as memberProject } from '@cella/org-graft-member-project/app'
import { app as memberTask } from '@cella/org-graft-member-task/app'
import { app as memberTimesheet } from '@cella/org-graft-member-timesheet/app'
import { app as projectTask } from '@cella/org-graft-project-task/app'
import { app as projectTimesheet } from '@cella/org-graft-project-timesheet/app'
import { app as expenseInvoiceProjectTimesheet } from '@cella/org-graft-expense-invoice-project-timesheet/app'
import { app as expense } from '@cella/org-expense/app'
import { app as payslip } from '@cella/org-payslip/app'
import { app as accountDecision } from '@cella/org-graft-account-decision/app'
import { app as accountMember } from '@cella/org-graft-account-member/app'
import { app as accountMemberTransaction } from '@cella/org-graft-account-member-transaction/app'
import { app as accountMemberPayslipTransaction } from '@cella/org-graft-account-member-payslip-transaction/app'
import { app as accountPayslip } from '@cella/org-graft-account-payslip/app'
import { app as accountTimesheet } from '@cella/org-graft-account-timesheet/app'
import { app as expenseMember } from '@cella/org-graft-expense-member/app'
import { app as expenseProject } from '@cella/org-graft-expense-project/app'
import { app as expenseTransaction } from '@cella/org-graft-expense-transaction/app'
import { app as memberPayslip } from '@cella/org-graft-member-payslip/app'
import { app as payslipTransaction } from '@cella/org-graft-payslip-transaction/app'
import { app as meeting } from '@cella/org-meeting/app'
import { app as circleMeeting } from '@cella/org-graft-circle-meeting/app'
import { app as circleMeetingMember } from '@cella/org-graft-circle-meeting-member/app'
import { app as decisionMeeting } from '@cella/org-graft-decision-meeting/app'
import { app as documentMeeting } from '@cella/org-graft-document-meeting/app'
import { app as meetingMember } from '@cella/org-graft-meeting-member/app'
import { app as decisionMemberWorker } from '@cella/org-graft-decision-member-worker/app'
import { app as documentMember } from '@cella/org-graft-document-member/app'
import { app as keyWorker } from '@cella/org-graft-key-worker/app'
import { app as memberWorker } from '@cella/org-graft-member-worker/app'
import { app as payslipWorker } from '@cella/org-graft-payslip-worker/app'
import { app as timesheetWorker } from '@cella/org-graft-timesheet-worker/app'
import { app as projectTimesheetWorker } from '@cella/org-graft-project-timesheet-worker/app'

// The client sides the shell mounts, matching the server's slices by
// name: each feat's views and pages, each graft's extensions, and the
// root's own: the cards of the work collections, whose fields come from
// several grafts no one graft may name together.
const root: App = {
  name: 'org',
  extends: {
    projects: { look: { cards: ['client', 'progress', 'budget', 'used'] } },
    tasks: { look: { cards: ['assignee', 'project', 'priority', 'due'] } },
  },
}

export const apps: App[] = [
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
  decisionMemberWorker,
  documentMember,
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
  payslipTransaction,
  circleMeeting,
  decisionMeeting,
  documentMeeting,
  meetingMember,
  circleMeetingMember,
  memberWorker,
  payslipWorker,
  timesheetWorker,
  keyWorker,
  projectTimesheetWorker,
  root,
]

// The co-op's home until a viewer pins their own: what a managing
// director looks at first, the cash, what clients owe, the projects'
// margins, the decisions open and the meetings ahead. The root's, since
// it runs over the fields of several slices no one slice joins.
export const home: Pin[] = [
  { collection: 'accounts', kind: 'kpi', title: 'Cash', measure: { op: 'sum', field: 'balance' }, where: [{ field: 'cash', is: ['cash'] }] },
  { collection: 'invoices', kind: 'kpi', title: 'Owed by clients', measure: { op: 'sum', field: 'owed' } },
  { collection: 'invoices', kind: 'kpi', title: 'Overdue', measure: { op: 'sum', field: 'owed' }, where: [{ field: 'state', is: ['overdue'] }] },
  { collection: 'projects', kind: 'kpi', title: 'Margin on projects', measure: { op: 'sum', field: 'margin' } },
  { collection: 'decisions', kind: 'kpi', title: 'Open decisions', measure: { op: 'count' }, where: [{ field: 'state', is: ['open'] }] },
  { collection: 'meetings', kind: 'kpi', title: 'Meetings ahead', measure: { op: 'count' }, where: [{ field: 'status', is: ['scheduled'] }] },
  { collection: 'invoices', kind: 'chart', title: 'Invoiced by month', measure: { op: 'sum', field: 'total' }, by: 'issued' },
  { collection: 'projects', kind: 'chart', title: 'Projects by watch', measure: { op: 'count' }, by: 'watch' },
]

export const collection = (name: string): Owned | undefined => apps.find((a) => a.collections?.[name])?.collections?.[name]

// What each slice adds to a collection, by the slice's name.
export const extensions = (name: string): { slice: string; extension: Added }[] =>
  apps.flatMap((a) => (a.extends?.[name] ? [{ slice: a.name, extension: a.extends[name] }] : []))

// A collection's columns: its owner's, then each extension's over the
// fields it adds to the rows.
export const columns = (name: string): Column[] => [
  ...(collection(name)?.view.columns ?? []),
  ...extensions(name).flatMap((e) => e.extension.columns ?? []),
]

// The dashboard a collection's owner and extensions declare, if they do.
export const dashboard = (name: string): Widget[] | undefined => {
  const declared = [...(collection(name)?.view.dashboard ?? []), ...extensions(name).flatMap((e) => e.extension.dashboard ?? [])]
  return declared.length ? declared : undefined
}

// How a collection looks before a view changes it: its owner's look, each
// extension's overriding it.
export const look = (name: string): Look =>
  Object.assign({}, collection(name)?.view.look, ...extensions(name).map((e) => e.extension.look ?? {}))

// The board moves a collection's slices make writes.
export const shifts = (name: string): Shift[] => [
  ...(collection(name)?.view.shifts ?? []),
  ...extensions(name).flatMap((e) => e.extension.shifts ?? []),
]

// The views a collection offers as tabs: its declared presets and All.
export const views = (name: string): Preset[] =>
  presets([...(collection(name)?.view.views ?? []), ...extensions(name).flatMap((e) => e.extension.views ?? [])])

const order = ['home', 'governance', 'work', 'finance', 'platform']

// The sidebar: the co-op's home and what waits on the acting member, then
// each group's collections. `counts` are the counted collections' rows
// for the acting member, by address.
export const nav = (counts: Record<string, number> = {}): Nav =>
  order
    .map((group) => ({
      group,
      items: [
        ...(group === 'home' ? [{ href: '/', title: 'Home', icon: icons.House }] : []),
        ...apps.flatMap((a) =>
          Object.entries(a.collections ?? {})
            .filter(([, c]) => c.view.group === group)
            .map(([name, c]) => ({ href: `/${name}`, title: c.view.title, icon: c.view.icon, count: counts[`/${name}`] })),
        ),
      ],
    }))
    .filter((g) => g.items.length)

// The collections the sidebar counts for the acting member.
export const counted = (): string[] =>
  apps.flatMap((a) => Object.entries(a.collections ?? {}).flatMap(([name, c]) => (c.view.counted ? [name] : [])))
