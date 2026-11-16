<script lang="ts">
  import { Field, Form, Section } from '@cella/org-ui'
  import type { Pot } from '../../models/share.ts'

  // Who runs the project, Linear's lead and members, independent of who
  // edits it: both from active membership, the lead one of them or no
  // one, the members as many as join it. The last crew written replaces
  // the whole of it; more than one member, comma-separated.
  let { data }: { data: Pot; id: string } = $props()

  const options = $derived([{ value: '', label: 'No one' }, ...data.members.map((m) => ({ value: m.address, label: m.name }))])
  const named = $derived(data.crew.map((m) => m.name).join(', ') || 'no one yet')
</script>

<Section title="Led by {data.lead?.name ?? 'no one'}, crewed by {named}">
  <Form action="crew" submit="Set crew" tone="quiet" inline>
    <Field label="Lead" name="lead" {options} value={data.lead?.address ?? ''} />
    <Field
      label="Members"
      name="members"
      list={data.members.map((m) => m.address)}
      placeholder="thomas@lanterne.example, amina@lanterne.example"
      value={data.crew.map((m) => m.address).join(', ')}
    />
  </Form>
</Section>
