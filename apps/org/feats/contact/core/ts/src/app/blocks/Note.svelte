<script lang="ts">
  import { Field, Form, Section } from '@cella/org-ui'
  import type { Contact } from '../../models/contact.ts'

  // The contact's note, a field of its own: the last writer wins it.
  let { data }: { data: Contact; id: string } = $props()
</script>

<Section title="Note">
  <Form action="note" submit="Save note" tone="quiet" reset={false}>
    <Field label="Note" name="note" rows={4} value={data.note} wide />
  </Form>
</Section>
