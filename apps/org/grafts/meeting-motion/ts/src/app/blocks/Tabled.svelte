<script lang="ts">
  import { date, Field, Form, Section, Table, type Column } from '@cella/org-ui'
  import type { OnMeeting, Tabled } from '../../models/tabled.ts'

  // The motions the agenda tables, by the item that tables each, and
  // where each stands; and while the meeting is scheduled, tabling an
  // open one as a new item, titled as the motion unless named.
  let { data }: { data: OnMeeting; id: string } = $props()

  const columns: Column<Tabled>[] = [
    { key: 'n', label: 'Item', kind: 'number', value: (t) => t.n },
    { key: 'name', label: 'Motion', kind: 'title', value: (t) => `${t.motion}, ${t.name}` },
    { key: 'circle', label: 'Circle', value: (t) => t.circle },
    {
      key: 'state',
      label: 'Stands',
      kind: 'badge',
      value: (t) => (t.closed ? `closed ${date(t.closed)}` : `open until ${date(t.deadline)}`),
      tone: (t) => (t.closed ? 'neutral' : 'accent'),
    },
  ]
  const open = $derived(data.motions.filter((d) => !d.closed).map((d) => ({ value: d.id, label: `${d.id}, ${d.title}` })))
</script>

<Section title="Motions tabled" count={data.tabled.length}>
  <Table {columns} rows={data.tabled} href={(t: Tabled) => `/motions/${t.motion}`} />
  {#if data.open && open.length}
    <Form action="table" submit="Table motion" tone="quiet" inline>
      <Field label="Motion" name="motion" options={open} value={open[0].value} />
      <Field label="Item" name="title" placeholder="as the motion" />
      <Field label="Presenter" name="presenter" />
      <Field label="Minutes" name="minutes" type="number" />
    </Form>
  {/if}
</Section>
