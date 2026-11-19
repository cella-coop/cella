<script lang="ts">
  import { Field, Form, Section, Table, type Column } from '@cella/org-ui'
  import type { Month, Months } from '../../models/sheet.ts'

  // A worker's timesheets, a month of each circle they worked for: they
  // submit their own open months, and someone else approves a submitted
  // one, which closes it to new entries of that circle.
  let { data }: { data: Months; id: string } = $props()

  const columns: Column<Month>[] = [
    { key: 'month', label: 'Month', kind: 'title', value: (m) => m.month },
    { key: 'circle', label: 'Circle', value: (m) => m.circle },
    { key: 'hours', label: 'Hours', kind: 'number', value: (m) => m.hours },
    { key: 'billable', label: 'Billable', kind: 'number', value: (m) => m.billable },
    {
      key: 'state',
      label: 'State',
      kind: 'badge',
      value: (m) => m.state,
      tone: (m) => (m.state === 'approved' ? 'positive' : m.state === 'submitted' ? 'accent' : 'neutral'),
    },
    { key: 'approver', label: 'Approved by', value: (m) => m.approver_name },
  ]
  const choices = (state: Month['state']) =>
    data.months.filter((m) => m.state === state && m.entries > 0).map((m) => ({ value: m.id, label: `${m.month}, ${m.circle}` }))
  const open = $derived(choices('open'))
  const submitted = $derived(choices('submitted'))
</script>

<Section title="Timesheets" count={data.months.length}>
  <Table {columns} rows={data.months} />
  {#if data.own && open.length}
    <Form action="submit" submit="Submit" tone="quiet" inline>
      <Field label="Month" name="month" options={open} value={open[open.length - 1].value} />
    </Form>
  {:else if data.acting && !data.own && submitted.length}
    <Form action="approve" submit="Approve" tone="positive" inline>
      <Field label="Month" name="month" options={submitted} value={submitted[submitted.length - 1].value} />
    </Form>
  {/if}
</Section>
