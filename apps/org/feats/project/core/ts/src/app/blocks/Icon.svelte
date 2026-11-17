<script lang="ts">
  import { Form, IconPicker, Section } from '@cella/org-ui'
  import type { Detail } from '../../models/project.ts'

  // A project's own icon, replacing the collection's before its title, in
  // its cells, its chips and its header: picked from the curated set, or
  // none, which wears the collection's instead.
  let { data }: { data: Detail; id: string } = $props()
</script>

<Section title="Icon">
  <Form action="icon" submit={data.icon ? 'Change icon' : 'Set icon'} tone="quiet" inline>
    <IconPicker name="icon" label="Icon" title={data.title} value={data.icon} />
  </Form>
</Section>
