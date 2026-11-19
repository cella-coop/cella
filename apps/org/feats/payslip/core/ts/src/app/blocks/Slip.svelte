<script lang="ts">
  import { icons, Panel, Table, type Total } from '@cella/org-ui'
  import type { Payslip } from '../../models/payslip.ts'

  // The payslip line by line: gross pay, the employee's contributions
  // taken from it, net pay ruled off, and what the employer pays on top,
  // its cost ruled off: the overview's first panel.
  let { data }: { data: Payslip; id: string } = $props()

  const lines: Total[] = $derived([
    { label: 'Gross pay', value: data.gross },
    { label: 'Employee contributions', value: -data.employee },
    { label: 'Net pay', value: data.net, total: true },
    { label: 'Employer contributions', value: data.employer },
    { label: 'Cost to the coop', value: data.cost, total: true },
  ])
</script>

<Panel title="Pay" icon={icons.Money} meta="{data.hours} h">
  <Table dense columns={[]} rows={[]} totals={lines} />
</Panel>
