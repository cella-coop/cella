import { icons, type App } from '@cella/org-ui'
import { states, tones, type Payslip } from '../models/payslip.ts'
import Prepare from './blocks/Prepare.svelte'
import Run from './blocks/Run.svelte'
import Slip from './blocks/Slip.svelte'
import { Body } from '@cella/org-body/app'

// The feat's client side: every payslip in a table; preparing a month's
// run; and a payslip's page,
// with its run's approval and payment, which opens on its pay, line by
// line, then its notes.
export const app: App = {
  name: 'payslip',
  collections: {
    payslips: {
      view: {
        title: 'Payslips',
        caption: 'Each month’s pay run, from salaries and approved time, approved and paid',
        icon: icons.Money,
        create: Prepare,
        columns: [
          { key: 'label', label: 'Worker', kind: 'title', role: 'title', value: (p: Payslip & { label: string }) => p.label },
          { key: 'month', label: 'Month', kind: 'badge', role: 'hidden', value: (p: Payslip) => p.month },
          { key: 'member', label: 'Member', kind: 'person', role: 'hidden', value: (p: Payslip) => p.member },
          { key: 'hours', label: 'Hours', kind: 'number', role: 'hidden', value: (p: Payslip) => p.hours },
          { key: 'gross', label: 'Gross', kind: 'money', role: 'meta', value: (p: Payslip) => p.gross },
          { key: 'employee', label: 'Employee contributions', kind: 'money', role: 'hidden', value: (p: Payslip) => p.employee },
          { key: 'net', label: 'Net', kind: 'money', role: 'meta', value: (p: Payslip) => p.net },
          { key: 'employer', label: 'Employer contributions', kind: 'money', role: 'hidden', value: (p: Payslip) => p.employer },
          { key: 'cost', label: 'Cost', kind: 'money', role: 'hidden', value: (p: Payslip) => p.cost },
          { key: 'state', label: 'Run', kind: 'badge', role: 'meta', value: (p: Payslip) => p.state, tone: (p: Payslip) => tones[p.state] },
        ],
        // A pay run is a month: grouped by it, the latest first, each
        // worker's slip in it by name.
        look: { layout: 'list', by: 'month', sort: { field: 'month', dir: 'desc' }, lanes: { state: [...states] } },
      },
      page: {
        eyebrow: 'Payslip',
        title: (p: Payslip) => `Payslip ${p.month}`,
        properties: (p: Payslip) => [
          { label: 'Run', value: p.state, kind: 'badge', tone: tones[p.state] },
          { label: 'Member', value: p.member, kind: 'person', href: `/people/${p.member}` },
        ],
        activity: (p: Payslip) => [
          ...(p.paid ? [{ at: p.paid, text: 'paid' }] : []),
          ...(p.approved ? [{ at: p.approved, text: 'approved', who: p.approver ?? undefined }] : []),
          { at: p.generated, text: 'prepared' },
        ],
        layout: 'panels',
        body: Body,
        blocks: [Slip],
        actions: Run,
      },
    },
  },
}
