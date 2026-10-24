<script lang="ts">
  import { Section, Table, type Column } from '@cella/org-ui'
  import type { Payslip } from '../../models/payslip.ts'

  // The payslip line by line: gross pay, the employee's contributions
  // taken from it, net pay, and what the employer pays on top.
  let { data }: { data: Payslip; id: string } = $props()

  type Line = { id: string; label: string; amount: number }
  const lines = $derived<Line[]>([
    { id: 'gross', label: 'Gross pay', amount: data.gross },
    { id: 'employee', label: 'Employee contributions', amount: -data.employee },
    { id: 'net', label: 'Net pay', amount: data.net },
    { id: 'employer', label: 'Employer contributions', amount: data.employer },
    { id: 'cost', label: 'Cost to the co-op', amount: data.cost },
  ])
  const columns: Column<Line>[] = [
    { key: 'label', label: 'Line', value: (l) => l.label },
    { key: 'amount', label: 'Amount', kind: 'money', value: (l) => l.amount },
  ]
</script>

<Section title="Payslip">
  <Table {columns} rows={lines} />
</Section>
