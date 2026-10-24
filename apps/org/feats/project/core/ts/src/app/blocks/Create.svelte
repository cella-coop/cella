<script lang="ts">
  import { Field, Form } from '@cella/org-ui'
  import type { Offered, Project } from '../../models/project.ts'

  // A new project, started on the verdict date; its id is its title's
  // slug. Its budget, milestones and client are set on its page.
  let { about }: { rows: Project[]; about: Offered } = $props()
</script>

<Form action="create" submit="Start project">
  <Field label="Title" name="title" required wide />
  <Field label="Circle" name="circle" list={about.circles} />
  <Field label="Due" name="due" type="date" />
  <Field label="Summary" name="summary" rows={3} wide />
</Form>
