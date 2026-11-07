<script lang="ts">
  import { Field, Form, Section, Table, type Column } from '@cella/org-ui'
  import type { Detail, Milestone } from '../../models/project.ts'

  // The project's milestones in order: completing one, and adding the
  // next. An archived project changes no more.
  let { data }: { data: Detail; id: string } = $props()

  const columns: Column<Milestone>[] = [
    { key: 'n', label: '#', kind: 'number', value: (m) => m.n },
    { key: 'title', label: 'Milestone', kind: 'title', value: (m) => m.title },
    { key: 'due', label: 'Due', kind: 'date', value: (m) => m.due },
    { key: 'completed', label: 'Completed', kind: 'date', value: (m) => m.completed },
    {
      key: 'state',
      label: 'State',
      kind: 'badge',
      value: (m) => (m.completed ? 'done' : 'open'),
      tone: (m) => (m.completed ? 'positive' : 'accent'),
    },
  ]
  const open = $derived(data.milestones.filter((m) => !m.completed).map((m) => ({ value: String(m.n), label: `${m.n}. ${m.title}` })))
</script>

<Section title="Milestones" count={data.milestones.length}>
  <Table {columns} rows={data.milestones} />
  {#if !data.archived}
    {#if open.length}
      <Form action="complete" submit="Complete" tone="quiet" inline>
        <Field label="Milestone" name="n" options={open} value={open[0].value} />
      </Form>
    {/if}
    <Form action="milestone" submit="Add milestone" tone="quiet" inline>
      <Field label="Title" name="title" required />
      <Field label="Due" name="due" type="date" />
    </Form>
  {/if}
</Section>
