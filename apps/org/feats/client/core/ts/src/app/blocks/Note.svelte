<script lang="ts">
  import { Field, Form, Section } from '@cella/org-ui'
  import type { Client } from '../../models/client.ts'

  // The client's note, a field of its own: the last writer wins it.
  let { data }: { data: Client; id: string } = $props()
</script>

<Section title="Note">
  <Form action="note" submit="Save note" tone="quiet" reset={false}>
    <Field label="Note" name="note" rows={4} value={data.note} wide />
  </Form>
</Section>
