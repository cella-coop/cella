<script lang="ts">
  import { Button, Field, Form, icons, Panel } from '@cella/org-ui'
  import { stages, type Contact } from '../../models/contact.ts'

  // The client role, a field of its own: a stage of its lifecycle, or none
  // for a contact the coop does not bill, its choice in the body and
  // setting it in the footer. The last writer wins it. The overview's
  // first panel.
  let { data }: { data: Contact; id: string } = $props()

  const form = $props.id()
  const options = [{ value: '', label: 'No client' }, ...stages.map((s) => ({ value: s, label: `Client, ${s}` }))]
</script>

<Panel title="Client" icon={icons.Buildings} status={data.client ? { label: data.client, tone: 'accent' } : null}>
  <Form id={form} action="client" bare>
    <Field label="Client role" name="client" {options} value={data.client ?? ''} />
  </Form>
  {#snippet help()}{#if !data.client}No client: set the role to bill it.{/if}{/snippet}
  {#snippet actions()}
    <Button type="submit" {form} lead={icons.Check}>Set role</Button>
  {/snippet}
</Panel>
