<script lang="ts">
  import { Field, Form, Section } from '@cella/org-ui'
  import { priorities as levels } from '@cella/org-task/models'
  import type { Tasks } from '../../models/filing.ts'

  // A new task already in the project, under one of its open milestones
  // if chosen, under the project's tasks, which its Tasks tab lists as
  // the tasks collection scoped to it.
  let { data }: { data: Tasks; id: string } = $props()

  const priorities = levels.map((p) => ({ value: p, label: p }))
  const milestones = $derived([{ value: '', label: 'None' }, ...data.milestones])
</script>

{#if !data.archived}
  <Section title="New task">
    <Form action="task" submit="Add task" tone="quiet" inline>
      <Field label="Title" name="title" required />
      <Field label="Milestone" name="milestone" options={milestones} value="" />
      <Field label="Priority" name="priority" options={priorities} value="normal" />
    </Form>
  </Section>
{/if}
