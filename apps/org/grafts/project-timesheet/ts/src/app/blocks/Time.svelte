<script lang="ts">
  import { Field, Form, Section, Stats, Table, type Column } from '@cella/org-ui'
  import type { Time } from '../../models/booking.ts'

  // The project's time: its hours and what its billable hours spent of the
  // budget, who worked them, the latest entries, and logging time
  // against it as the acting member, for the circle they name.
  let { data }: { data: Time; id: string } = $props()

  type Who = Time['members'][number]
  type Row = Time['entries'][number]

  const people: Column<Who>[] = [
    { key: 'member', label: 'Member', kind: 'person', value: (m) => m.member },
    { key: 'hours', label: 'Hours', kind: 'number', value: (m) => m.hours },
    { key: 'billable', label: 'Billable', kind: 'number', value: (m) => m.billable },
  ]
  const latest: Column<Row>[] = [
    { key: 'day', label: 'Day', kind: 'date', value: (e) => e.day },
    { key: 'member', label: 'Member', kind: 'person', value: (e) => e.member },
    { key: 'hours', label: 'Hours', kind: 'number', value: (e) => e.hours },
    { key: 'billable', label: 'Kind', kind: 'badge', value: (e) => (e.billable ? 'billable' : 'internal') },
  ]
  const kinds = [
    { value: 'billable', label: 'billable' },
    { value: 'internal', label: 'internal' },
  ]
</script>

<Section title="Time">
  <Stats
    items={[
      { label: 'Hours', value: data.hours, kind: 'number' },
      { label: 'Billable', value: data.billable, kind: 'number' },
      { label: 'Spent of the budget', value: data.spent, kind: 'money' },
      { label: 'Rate an hour', value: data.hourly, kind: 'money' },
    ]}
  />
  {#if !data.archived}
    <Form action="log" submit="Log time" tone="quiet" inline>
      <Field label="Day" name="day" type="date" value={data.today} required />
      <Field label="Hours" name="hours" placeholder="7" required />
      <Field label="Kind" name="billable" options={kinds} value="billable" />
      {#if data.circles.length}
        <Field label="Circle" name="circle" options={data.circles.map((c) => ({ value: c.id, label: c.name }))} value={data.circles[0].id} />
      {/if}
      <Field label="Note" name="note" />
    </Form>
  {/if}
</Section>

<Section title="By member" count={data.members.length}>
  <Table columns={people} rows={data.members} href={(m: Who) => `/people/${m.member}`} />
</Section>

<Section title="Latest entries" count={data.entries.length}>
  <Table columns={latest} rows={data.entries} href={(e: Row) => `/timesheets/${e.id}`} />
</Section>
