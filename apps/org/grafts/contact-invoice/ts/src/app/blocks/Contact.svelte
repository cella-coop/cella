<script lang="ts">
  import { Field, Form, Section } from '@cella/org-ui'
  import type { Billed } from '../../models/billing.ts'

  // An invoice names whom it bills as text; the link to a contact record is
  // this graft's, and an unlinked invoice is unbilled, not invalid.
  let { data }: { data: Billed; id: string } = $props()

  const options = $derived(data.contacts.map((c) => ({ value: c.id, label: c.name })))
</script>

<Section title={data.contact ? 'Billed contact' : 'Unbilled: link a contact'}>
  <Form action="link" submit={data.contact ? 'Move to contact' : 'Link contact'} tone="quiet" inline>
    <Field label="Contact" name="contact" {options} value={data.contact?.id ?? options[0]?.value} />
  </Form>
</Section>
