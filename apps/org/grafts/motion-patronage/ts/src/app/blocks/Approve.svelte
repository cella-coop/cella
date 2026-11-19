<script lang="ts">
  import { Field, Form } from '@cella/org-ui'
  import type { Approval } from '../../models/approval.ts'

  // Approving the split, citing the motion that approves it: it settles
  // only if that motion closed and passed and the year's books are
  // closed, and makes each worker's part.
  let { data }: { data: Approval[]; id: string } = $props()

  const open = $derived(data.filter((a) => !a.approved))
  const options = $derived(open.map((a) => ({ value: a.motion, label: `${a.motion}, ${a.title}` })))
</script>

{#if open.length}
  <Form action="approve" submit="Approve" tone="positive" inline>
    <Field label="Decided by" name="motion" {options} value={options[0]?.value} />
  </Form>
{/if}
