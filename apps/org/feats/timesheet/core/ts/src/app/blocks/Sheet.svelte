<script lang="ts">
  import { Form } from '@cella/org-ui'
  import type { Detail } from '../../models/timesheet.ts'

  // The month's writes: its member submits it while it is open, and
  // someone else approves it once submitted, which closes it to new
  // entries. The rules refuse anyone else.
  let { data }: { data: Detail; id: string } = $props()
</script>

{#if data.sheet.state === 'open'}
  <Form action="submit" submit="Submit {data.month}" tone="quiet" />
{:else if data.sheet.state === 'submitted'}
  <Form action="approve" submit="Approve {data.month}" tone="quiet" />
{/if}
