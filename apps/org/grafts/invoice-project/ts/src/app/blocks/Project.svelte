<script lang="ts">
  import { Button, Field, Form, icons, Panel } from '@cella/org-ui'
  import type { Charged } from '../../models/charge.ts'

  // The project whose work the invoice bills: its choice in the body and
  // naming it, or moving the invoice to another, in the footer. A panel
  // of the invoice's overview.
  let { data }: { data: Charged; id: string } = $props()

  const form = $props.id()
  const options = $derived(data.projects.map((p) => ({ value: p.id, label: p.title })))
</script>

<Panel title="Project" icon={icons.Briefcase}>
  <Form id={form} action="charge" bare>
    <Field label="Project" name="project" {options} placeholder="Choose a project" value={data.project?.id ?? ''} required />
  </Form>
  {#snippet actions()}
    <Button type="submit" {form} lead={icons.ArrowRight}>{data.project ? 'Move to project' : 'Name project'}</Button>
  {/snippet}
</Panel>
