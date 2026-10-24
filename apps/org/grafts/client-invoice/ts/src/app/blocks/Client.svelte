<script lang="ts">
  import { Field, Form, Section } from '@cella/org-ui'
  import type { Billed } from '../../models/billing.ts'

  // An invoice names whom it bills as text; the link to a client record is
  // this graft's, and an unlinked invoice is unbilled, not invalid.
  let { data }: { data: Billed; id: string } = $props()

  const options = $derived(data.clients.map((c) => ({ value: c.id, label: c.name })))
</script>

<Section title={data.client ? 'Billed client' : 'Unbilled: link a client'}>
  <Form action="link" submit={data.client ? 'Move to client' : 'Link client'} tone="quiet" inline>
    <Field label="Client" name="client" {options} value={data.client?.id ?? options[0]?.value} />
  </Form>
</Section>
