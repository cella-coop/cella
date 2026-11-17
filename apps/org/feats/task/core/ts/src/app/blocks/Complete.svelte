<script lang="ts">
  import { Form } from '@cella/org-ui'
  import type { Task } from '../../models/task.ts'

  // Completing the task, beside its header; its status is the page's
  // property, changed in its popover, where done is the same completion.
  let { data }: { data: Task; id: string } = $props()
</script>

{#if data.status !== 'done'}
  <Form action="complete" submit="Complete" tone="primary" />
{/if}
