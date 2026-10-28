<script lang="ts">
  import { Field, Form } from '@cella/org-ui'
  import type { Distribution } from '../../models/distribution.ts'

  // A year's split, drafted by finance for the assembly to approve: its
  // surplus, and each share's percent of it, which add up to 100. Drafting
  // a year again replaces its draft until it is approved; the law's floors
  // are judged at the approval.
  let { about }: { rows: Distribution[]; about: { year: number } } = $props()
</script>

<Form action="draft" submit="Draft the split">
  <Field label="Year" name="year" value={String(about.year)} required />
  <Field label="Surplus €" name="surplus" required />
  <Field label="Work share %" name="work" placeholder="45" required />
  <Field label="Legal reserve %" name="legal" placeholder="15" />
  <Field label="Development fund %" name="development" />
  <Field label="Interest on capital %" name="interest" />
</Form>
