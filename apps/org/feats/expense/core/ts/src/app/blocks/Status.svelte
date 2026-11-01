<script lang="ts">
  import { Form } from '@cella/org-ui'
  import type { Expense } from '../../models/expense.ts'

  // The expense's next writes, as its board columns: its member submits a
  // draft; someone else approves or refuses it, within their mandate's
  // limit and month's budget; finance reimburses it once approved. The
  // guards refuse anyone else.
  let { data }: { data: Expense; id: string } = $props()
</script>

{#if data.status === 'draft'}
  <Form action="submit" submit="Submit" tone="primary" />
{:else if data.status === 'submitted'}
  <Form action="refuse" submit="Refuse" tone="danger" />
  <Form action="approve" submit="Approve" tone="primary" />
{:else if data.status === 'approved'}
  <Form action="reimburse" submit="Reimburse" tone="primary" />
{/if}
