<script lang="ts">
  import { Field, Form, Section } from '@cella/org-ui'
  import type { For } from '../../models/commission.ts'

  // Whom the project is for, a client, a contact holding the client role;
  // a project with none is the co-op's own. Only clients are offered.
  let { data }: { data: For; id: string } = $props()

  const options = $derived(data.contacts.map((c) => ({ value: c.id, label: c.name })))
</script>

<Section title={data.contact ? `For ${data.contact.name}` : 'The co-op’s own: link a client'}>
  <Form action="link" submit={data.contact ? 'Move to client' : 'Link client'} tone="quiet" inline>
    <Field label="Client" name="contact" {options} value={data.contact?.id ?? options[0]?.value} />
  </Form>
</Section>
