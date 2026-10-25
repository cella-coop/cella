import { icons, type App } from '@cella/org-ui'
import { states, tones, type Payslip } from '../models/payslip.ts'
import Prepare from './blocks/Prepare.svelte'
import Run from './blocks/Run.svelte'
import Slip from './blocks/Slip.svelte'

// The feat's client side: every payslip in a table, with a dashboard of
// the payroll by month; preparing a month's run; and a payslip's page,
// line by line, with its run's approval and payment.
export const app: App = {
  name: 'payslip',
  collections: {
    payslips: {
      view: {
        group: 'finance',
        title: 'Payslips',
        caption: 'Each month’s pay run, from salaries and approved time, approved and paid',
        icon: icons.Money,
        create: Prepare,
        columns: [
          { key: 'label', label: 'Payslip', kind: 'title', role: 'title', value: (p: Payslip) => `Payslip ${p.month}` },
          { key: 'month', label: 'Month', kind: 'badge', role: 'hidden', value: (p: Payslip) => p.month },
          { key: 'member', label: 'Member', kind: 'mono', role: 'hidden', value: (p: Payslip) => p.member },
          { key: 'hours', label: 'Hours', kind: 'number', role: 'hidden', value: (p: Payslip) => p.hours },
          { key: 'gross', label: 'Gross', kind: 'money', role: 'meta', value: (p: Payslip) => p.gross },
          { key: 'employee', label: 'Employee contributions', kind: 'money', role: 'hidden', value: (p: Payslip) => p.employee },
          { key: 'net', label: 'Net', kind: 'money', role: 'meta', value: (p: Payslip) => p.net },
          { key: 'employer', label: 'Employer contributions', kind: 'money', role: 'hidden', value: (p: Payslip) => p.employer },
          { key: 'cost', label: 'Cost', kind: 'money', role: 'hidden', value: (p: Payslip) => p.cost },
          { key: 'state', label: 'Run', kind: 'badge', role: 'meta', value: (p: Payslip) => p.state, tone: (p: Payslip) => tones[p.state] },
        ],
        look: { layout: 'table', lanes: { state: [...states] } },
        dashboard: [
          { kind: 'kpi', title: 'Gross pay', measure: { op: 'sum', field: 'gross' } },
          { kind: 'kpi', title: 'Net pay', measure: { op: 'sum', field: 'net' } },
          { kind: 'kpi', title: 'Cost to the co-op', measure: { op: 'sum', field: 'cost' } },
          { kind: 'kpi', title: 'Awaiting payment', measure: { op: 'sum', field: 'net' }, where: [{ field: 'state', is: ['prepared', 'approved'] }] },
          { kind: 'chart', title: 'Payroll by month', measure: { op: 'sum', field: 'cost' }, by: 'month' },
          { kind: 'chart', title: 'Gross pay by month', measure: { op: 'sum', field: 'gross' }, by: 'month' },
        ],
      },
      page: {
        eyebrow: 'Payslip',
        title: (p: Payslip) => `Payslip ${p.month}`,
        subtitle: (p: Payslip) => `${p.member}, run ${p.state}`,
        properties: (p: Payslip) => [
          { label: 'Run', value: p.state, kind: 'badge', tone: tones[p.state] },
          { label: 'Gross', value: p.gross, kind: 'money' },
          { label: 'Net', value: p.net, kind: 'money' },
          { label: 'Hours', value: p.hours, kind: 'number' },
          { label: 'Member', value: p.member, kind: 'mono', href: `/members/${p.member}` },
        ],
        activity: (p: Payslip) => [
          ...(p.paid ? [{ at: p.paid, text: 'paid' }] : []),
          ...(p.approved ? [{ at: p.approved, text: 'approved', who: p.approver ?? undefined }] : []),
          { at: p.generated, text: 'prepared' },
        ],
        blocks: [Slip],
        actions: Run,
      },
    },
  },
}
