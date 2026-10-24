<script lang="ts">
  import { Field, Form, Section, Table, type Column } from '@cella/org-ui'
  import { priorities as levels } from '@cella/org-task/models'
  import type { Listed, Tasks } from '../../models/filing.ts'

  // The project's tasks, open ones first, and a new task already in it,
  // under one of its open milestones if chosen.
  let { data }: { data: Tasks; id: string } = $props()

  const columns: Column<Listed>[] = [
    { key: 'title', label: 'Task', kind: 'title', value: (t) => t.title },
    { key: 'phase', label: 'Milestone', value: (t) => t.phase },
    { key: 'priority', label: 'Priority', kind: 'badge', value: (t) => t.priority },
    { key: 'due', label: 'Due', kind: 'date', value: (t) => t.due },
    { key: 'status', label: 'Status', kind: 'badge', value: (t) => t.status },
  ]
  const priorities = levels.map((p) => ({ value: p, label: p }))
  const milestones = $derived([{ value: '', label: 'None' }, ...data.milestones])
</script>

<Section title="Tasks" count={data.tasks.length}>
  <Table {columns} rows={data.tasks} href={(t: Listed) => `/tasks/${t.id}`} />
  {#if !data.archived}
    <Form action="task" submit="Add task" tone="quiet" inline>
      <Field label="Title" name="title" required />
      <Field label="Milestone" name="milestone" options={milestones} value="" />
      <Field label="Priority" name="priority" options={priorities} value="normal" />
    </Form>
  {/if}
</Section>
