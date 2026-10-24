<script lang="ts">
  import { Field, Form, Section } from '@cella/org-ui'
  import type { Filed } from '../../models/filing.ts'

  // Which project the task is in, and which milestone: filing it there,
  // or moving it. A task in no project stands alone.
  let { data }: { data: Filed; id: string } = $props()

  const here = $derived(data.place ? (data.place.milestone ? `${data.place.project}#${data.place.milestone}` : data.place.project) : '')
  const title = $derived(data.place ? `In ${data.place.title}${data.place.phase ? ` · ${data.place.phase}` : ''}` : 'In no project')
</script>

<Section {title}>
  <Form action="file" submit={data.place ? 'Move' : 'File'} tone="quiet" inline>
    <Field label="Project" name="place" options={data.options} placeholder="Choose a project" value={here} required />
  </Form>
</Section>
