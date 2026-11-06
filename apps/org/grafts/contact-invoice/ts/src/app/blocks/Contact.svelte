<script lang="ts">
  import { Field, Form, Section } from '@cella/org-ui'
  import type { Billed } from '../../models/billing.ts'

  // An invoice names whom it bills as text; the link to a client, a
  // contact holding the client role, is this graft's, and an unlinked
  // invoice is unbilled, not invalid. Only clients are offered.
  let { data }: { data: Billed; id: string } = $props()

  const options = $derived(data.contacts.map((c) => ({ value: c.id, label: c.name })))
</script>

<Section title={data.contact ? 'Billed client' : 'Unbilled: link a client'}>
  <Form action="link" submit={data.contact ? 'Move to client' : 'Link client'} tone="quiet" inline>
    <Field label="Client" name="contact" {options} value={data.contact?.id ?? options[0]?.value} />
  </Form>
</Section>
