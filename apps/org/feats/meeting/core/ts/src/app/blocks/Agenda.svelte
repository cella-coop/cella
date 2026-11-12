<script lang="ts">
  import { Field, Form, Ordered, Section, type Column } from '@cella/org-ui'
  import type { Detail, Item } from '../../models/meeting.ts'
  import { useAgenda } from '../../hooks/useAgenda.ts'

  // The agenda, in order: each item's title, who presents it and for how
  // long. While the meeting is scheduled its members drag items into
  // order, remove them and add more; holding it fixes the agenda.
  let { data, id }: { data: Detail; id: string } = $props()

  const agenda = useAgenda(
    () => data.agenda,
    () => id,
  )
  const open = $derived(data.status === 'scheduled')
  const columns: Column<Item>[] = [
    { key: 'title', label: 'Item', value: (i) => i.title },
    { key: 'presenter', label: 'Presenter', value: (i) => i.presenter || null },
    { key: 'minutes', label: 'Length', value: (i) => (i.minutes ? `${i.minutes} min` : null) },
  ]
</script>

<Section title="Agenda" count={data.agenda.length}>
  <Ordered
    name="agenda"
    rows={agenda.items}
    {columns}
    fixed={!open}
    onmove={(from, to) => agenda.move(from, to)}
    onremove={(item: Item) => agenda.remove(item.id)}
  />
  {#if open}
    <Form action="item" submit="Add item" tone="quiet" inline>
      <Field label="Item" name="title" required />
      <Field label="Presenter" name="presenter" />
      <Field label="Minutes" name="minutes" type="number" />
    </Form>
  {/if}
</Section>
