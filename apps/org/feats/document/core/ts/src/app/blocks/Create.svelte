<script lang="ts">
  import { Field, Form } from '@cella/org-ui'
  import type { Listed } from '../../models/document.ts'

  // A new document, empty, named by its title's slug; it is written on
  // its page.
  let {}: { rows: Listed[]; about: unknown } = $props()
</script>

<Form action="create" submit="Start document">
  <Field label="Title" name="title" required wide />
</Form>
