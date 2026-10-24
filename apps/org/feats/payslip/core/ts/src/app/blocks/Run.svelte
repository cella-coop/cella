<script lang="ts">
  import { Form } from '@cella/org-ui'
  import type { Payslip } from '../../models/payslip.ts'

  // The writes on this payslip's run, the month's whole payroll: approving
  // it, which makes it final and posts it, then paying it from the bank.
  let { data }: { data: Payslip; id: string } = $props()
</script>

{#if data.state === 'prepared'}
  <Form action="approve" submit="Approve the {data.month} run" tone="primary" />
{:else if data.state === 'approved'}
  <Form action="pay" submit="Pay the {data.month} run" tone="primary" />
{/if}
