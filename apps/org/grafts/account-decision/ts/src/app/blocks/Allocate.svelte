<script lang="ts">
  import { Field, Form } from '@cella/org-ui'
  import type { Approval } from '../../models/approval.ts'

  // Allocating the surplus, citing the decision that approves its split:
  // it settles only if that decision closed and passed, and posts the
  // split to the books.
  let { data }: { data: Approval[]; id: string } = $props()

  const open = $derived(data.filter((a) => !a.allocated))
  const options = $derived(open.map((a) => ({ value: a.decision, label: `${a.decision}, ${a.title}` })))
</script>

{#if open.length}
  <Form action="allocate" submit="Allocate" tone="primary" inline>
    <Field label="Decided by" name="decision" {options} value={options[0]?.value} />
  </Form>
{/if}
