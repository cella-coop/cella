<script lang="ts">
  import { Field, Form, Section } from '@cella/org-ui'
  import type { For } from '../../models/commission.ts'

  // Whom the project is for; a project with no contact is the co-op's own.
  let { data }: { data: For; id: string } = $props()

  const options = $derived(data.contacts.map((c) => ({ value: c.id, label: c.name })))
</script>

<Section title={data.contact ? `For ${data.contact.name}` : 'The co-op’s own: link a contact'}>
  <Form action="link" submit={data.contact ? 'Move to contact' : 'Link contact'} tone="quiet" inline>
    <Field label="Contact" name="contact" {options} value={data.contact?.id ?? options[0]?.value} />
  </Form>
</Section>
