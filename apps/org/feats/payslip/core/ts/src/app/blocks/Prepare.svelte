<script lang="ts">
  import { Field, Form } from '@cella/org-ui'
  import type { Payslip } from '../../models/payslip.ts'

  // A month's pay run: one payslip for each salaried member, from their
  // salary and their approved time. Every member's month must be
  // approved first.
  let { about }: { rows: Payslip[]; about: { month: string } } = $props()
</script>

<Form action="generate" submit="Prepare the run">
  <Field label="Month" name="month" value={about.month} placeholder="YYYY-MM" required />
</Form>
