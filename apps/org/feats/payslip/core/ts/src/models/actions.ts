import { confluent, ordered, type Actions } from '@cella/org-actions'

export const actions = {
  // fixes a month's payslips from the salaries and the approved time; a
  // month has one run, so a second is refused
  'payslip:run:generate': ordered({ power: 'prepare-payroll' }),
  // makes the run's figures final and posts them; once
  'payslip:run:approve': ordered({ power: 'approve-payroll' }),
  // money leaves the bank for the run's pay and charges; a run is paid
  // once, so two payments of it cannot both stand
  'payslip:run:pay': ordered({ power: 'pay-payroll' }),
  // each save carries the whole merged snapshot, so the later receipt holds every edit before it
  'payslip:body:save': confluent({ power: 'discuss' }),
} satisfies Actions
