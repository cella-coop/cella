<script lang="ts">
  import { Field, Form } from '@cella/org-ui'
  import { priorities, type Task } from '../../models/task.ts'

  // A new task, to do, numbered by the server. Who does it and its project
  // are set on its page.
  let props: { rows: Task[]; about: unknown } = $props()

  const options = priorities.map((p) => ({ value: p, label: p }))
</script>

<Form action="create" submit="Create task">
  <Field label="Title" name="title" required wide />
  <Field label="Priority" name="priority" {options} value="normal" />
  <Field label="Due" name="due" type="date" />
</Form>
