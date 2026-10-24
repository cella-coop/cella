<script lang="ts">
  import { Field, Form, Section } from '@cella/org-ui'
  import type { Charged } from '../../models/charge.ts'

  // The project whose work the invoice bills, and naming it.
  let { data }: { data: Charged; id: string } = $props()

  const options = $derived(data.projects.map((p) => ({ value: p.id, label: p.title })))
</script>

<Section title={data.project ? `Bills ${data.project.title}` : 'Bills no project'}>
  <Form action="charge" submit={data.project ? 'Move to project' : 'Name project'} tone="quiet" inline>
    <Field label="Project" name="project" {options} placeholder="Choose a project" value={data.project?.id ?? ''} required />
  </Form>
</Section>
