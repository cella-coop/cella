<script lang="ts">
  import { Field, Form } from '@cella/org-ui'
  import { statuses, type Task } from '../../models/task.ts'

  // The task's status, as its board column: a move to any status short of
  // done, and completing it. The last write to the status wins it.
  let { data }: { data: Task; id: string } = $props()

  const options = $derived(statuses.filter((s) => s !== 'done' && s !== data.status).map((s) => ({ value: s, label: s })))
</script>

<Form action="move" submit="Move" tone="quiet" inline>
  <Field label="Status" name="status" {options} value={options[0]?.value} />
</Form>
{#if data.status !== 'done'}
  <Form action="complete" submit="Complete" tone="primary" />
{/if}
