<script lang="ts">
  import { Button, verb, Field, Form, icons, Panel } from '@cella/org-ui'
  import type { Filed } from '../../models/rebill.ts'

  // The project an expense was spent for, to bill on to its client: its
  // choice in the body and filing it under that one in the footer; only
  // its member may. A panel of the expense's overview.
  let { data }: { data: Filed; id: string } = $props()

  const form = $props.id()
  const options = $derived(data.projects.map((p) => ({ value: p.id, label: p.title })))
</script>

<Panel title="Billed on to" icon={icons.Briefcase}>
  <Form id={form} action="rebill" bare reset={false}>
    <Field label="Project" name="project" {options} value={data.project ?? ''} placeholder="the coop’s own" />
  </Form>
  {#snippet actions()}
    <Button type="submit" {form} lead={verb('File')}>File</Button>
  {/snippet}
</Panel>
