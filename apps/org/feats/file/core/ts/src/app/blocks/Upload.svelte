<script lang="ts">
  import { Field, Form } from '@cella/org-ui'
  import type { File } from '../../models/file.ts'

  // A file of the co-op's own, such as its statutes as signed, uploaded
  // as the acting member. Receipts, contracts and members' records come
  // in where they belong, on the expense, the worker or the member.
  let props: { rows: File[]; about: unknown } = $props()
</script>

<Form action="upload" submit="Upload">
  <Field label="File" name="file" type="file" required wide />
</Form>
