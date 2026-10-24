<script lang="ts">
  import { Field, Form, Section } from '@cella/org-ui'
  import type { Assigned } from '../../models/assignment.ts'

  // Who does the task: giving it to an active member, or to no one. The
  // last assignment wins.
  let { data }: { data: Assigned; id: string } = $props()

  const options = $derived([{ value: '', label: 'No one' }, ...data.members.map((m) => ({ value: m.address, label: m.name }))])
</script>

<Section title={data.assignee ? `Assigned to ${data.assignee.name}` : 'Unassigned'}>
  <Form action="assign" submit={data.assignee ? 'Reassign' : 'Assign'} tone="quiet" inline>
    <Field label="Assignee" name="member" {options} value={data.assignee?.address ?? ''} />
  </Form>
</Section>
