<script lang="ts">
  import { Field, Form, Section } from '@cella/org-ui'
  import { stages, type Contact } from '../../models/contact.ts'

  // The client role, a field of its own: a stage of its lifecycle, or none
  // for a contact the co-op does not bill. The last writer wins it.
  let { data }: { data: Contact; id: string } = $props()

  const options = [{ value: '', label: 'No client' }, ...stages.map((s) => ({ value: s, label: `Client, ${s}` }))]
</script>

<Section title={data.client ? `Client, ${data.client}` : 'No client: set the role to bill it'}>
  <Form action="client" submit="Set role" tone="quiet" inline>
    <Field label="Client role" name="client" {options} value={data.client ?? ''} />
  </Form>
</Section>
