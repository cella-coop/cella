<script lang="ts">
  import { Field, Form } from '@cella/org-ui'
  import type { Person } from '../../models/person.ts'

  // A person's own name; anyone else's is refused by `person.own_profile`.
  let { data }: { data: Person; id: string } = $props()
</script>

<Form action="profile" submit="Rename" tone="quiet" inline>
  <Field label="Name" name="name" value={data.name} required />
</Form>
