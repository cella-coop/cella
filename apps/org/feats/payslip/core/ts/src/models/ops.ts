import { ordered, type Ops } from '@cella/org-ops'

export const ops = {
  // fixes a month's payslips from the salaries and the approved time; a
  // month has one run, so a second is refused
  'payslip:run:generate': ordered({ power: 'prepare-payroll' }),
  // makes the run's figures final and posts them; once
  'payslip:run:approve': ordered({ power: 'approve-payroll' }),
  // money leaves the bank for the run's pay and charges; a run is paid
  // once, so two payments of it cannot both stand
  'payslip:run:pay': ordered({ power: 'pay-payroll' }),
} satisfies Ops
