<script lang="ts">
  import { Form, IconPicker, Section } from '@cella/org-ui'
  import type { Detail } from '../../models/circle.ts'

  // A circle's own icon, replacing the collection's before its title, in
  // its cells, its chips, its group bars and its header: picked from the
  // curated set, or none, which wears the collection's instead. At once
  // by a holder of `arrange-features` over it; a reader without it is
  // refused there, with no motion's fallback drawn.
  let { data }: { data: Detail; id: string } = $props()
</script>

<Section title="Icon">
  <Form action="icon" submit={data.icon ? 'Change icon' : 'Set icon'} tone="quiet" inline>
    <IconPicker name="icon" label="Icon" title={data.name} value={data.icon} />
  </Form>
</Section>
