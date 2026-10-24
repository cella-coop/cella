<script lang="ts">
  import { Field, Form, Section } from '@cella/org-ui'
  import type { For } from '../../models/commission.ts'

  // Whom the project is for; a project with no client is the co-op's own.
  let { data }: { data: For; id: string } = $props()

  const options = $derived(data.clients.map((c) => ({ value: c.id, label: c.name })))
</script>

<Section title={data.client ? `For ${data.client.name}` : 'The co-op’s own: link a client'}>
  <Form action="link" submit={data.client ? 'Move to client' : 'Link client'} tone="quiet" inline>
    <Field label="Client" name="client" {options} value={data.client?.id ?? options[0]?.value} />
  </Form>
</Section>
