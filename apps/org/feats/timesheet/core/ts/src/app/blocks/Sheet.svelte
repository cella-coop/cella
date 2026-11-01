<script lang="ts">
  import { Field, Form, type Viewer } from '@cella/org-ui'
  import type { Detail } from '../../models/timesheet.ts'

  // The month's writes: its member corrects an entry down while the month
  // is not approved, submits it while it is open, and someone else
  // approves it once submitted, which closes it to new entries and to
  // corrections. The guards refuse anyone else.
  let { data, viewer }: { data: Detail; id: string; viewer?: Viewer | null } = $props()

  const own = $derived(viewer?.actor === data.member)
</script>

{#if own && data.sheet.state !== 'approved'}
  <Form action="correct" submit="Correct" tone="quiet" inline>
    <Field label="Hours worked" name="hours" value={String(data.hours)} required />
  </Form>
{/if}
{#if data.sheet.state === 'open'}
  <Form action="submit" submit="Submit {data.month}" tone="quiet" />
{:else if data.sheet.state === 'submitted'}
  <Form action="approve" submit="Approve {data.month}" tone="quiet" />
{/if}
