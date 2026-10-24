<script lang="ts">
  import { Field, Form, Section } from '@cella/org-ui'
  import type { Filed } from '../../models/rebill.ts'

  // The project an expense was spent for, to bill on to its client, and
  // filing it under another; only its member may.
  let { data }: { data: Filed; id: string } = $props()

  const options = $derived(data.projects.map((p) => ({ value: p.id, label: p.title })))
</script>

<Section title="Billed on to">
  <Form action="rebill" submit="File" tone="quiet" inline reset={false}>
    <Field label="Project" name="project" {options} value={data.project ?? ''} placeholder="the co-op’s own" />
  </Form>
</Section>
