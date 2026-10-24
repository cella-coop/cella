<script lang="ts">
  import { date, Field, Form, Section, Table, type Column } from '@cella/org-ui'
  import type { OnMeeting, Tabled } from '../../models/tabled.ts'

  // The decisions the agenda tables, by the item that tables each, and
  // where each stands; and while the meeting is scheduled, tabling an
  // open one as a new item, titled as the decision unless named.
  let { data }: { data: OnMeeting; id: string } = $props()

  const columns: Column<Tabled>[] = [
    { key: 'n', label: 'Item', kind: 'number', value: (t) => t.n },
    { key: 'name', label: 'Decision', kind: 'title', value: (t) => `${t.decision}, ${t.name}` },
    { key: 'circle', label: 'Circle', value: (t) => t.circle },
    {
      key: 'state',
      label: 'Stands',
      kind: 'badge',
      value: (t) => (t.closed ? `closed ${date(t.closed)}` : `open until ${date(t.deadline)}`),
      tone: (t) => (t.closed ? 'neutral' : 'accent'),
    },
  ]
  const open = $derived(data.decisions.filter((d) => !d.closed).map((d) => ({ value: d.id, label: `${d.id}, ${d.title}` })))
</script>

<Section title="Decisions tabled" count={data.tabled.length}>
  <Table {columns} rows={data.tabled} href={(t: Tabled) => `/decisions/${t.decision}`} />
  {#if data.open && open.length}
    <Form action="table" submit="Table decision" tone="quiet" inline>
      <Field label="Decision" name="decision" options={open} value={open[0].value} />
      <Field label="Item" name="title" placeholder="as the decision" />
      <Field label="Presenter" name="presenter" />
      <Field label="Minutes" name="minutes" type="number" />
    </Form>
  {/if}
</Section>
