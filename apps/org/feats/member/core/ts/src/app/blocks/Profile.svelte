<script lang="ts">
  import { Field, Form } from '@cella/org-ui'
  import type { Member } from '../../models/member.ts'

  // A member's own name; anyone else's is refused by `member.own_profile`.
  let { data }: { data: Member; id: string } = $props()
</script>

<Form action="profile" submit="Rename" tone="quiet" inline>
  <Field label="Name" name="name" value={data.name} required />
</Form>
