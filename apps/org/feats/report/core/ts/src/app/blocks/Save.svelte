<script lang="ts">
  import { Field, Form } from '@cella/org-ui'
  import type { Report } from '../../models/report.ts'

  // Saving a member's own report: its title, what it is about, and its
  // definition, a port report as JSON with how it is charted. The port
  // refuses one reading past the views the slices publish.
  let {}: { rows: Report[]; about: unknown } = $props()
</script>

<Form action="save" submit="Save report">
  <Field label="Title" name="title" required wide />
  <Field label="About" name="caption" wide />
  <Field label="Definition (JSON)" name="definition" rows={8} wide required placeholder={`{"from": {"p": "project.projects"}, "fields": ["p.circle"], "measures": {"budget": {"fn": "sum", "of": "p.budget"}}, "chart": {"by": "p.circle", "value": "budget"}}`} />
</Form>
