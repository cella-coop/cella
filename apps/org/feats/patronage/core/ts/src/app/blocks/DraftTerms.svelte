<script lang="ts">
  import { Field, Form } from '@cella/org-ui'
  import type { Terms } from '../../models/terms.ts'

  // Terms drafted by finance for the members to adopt, from a year on: how
  // the work share divides, by pay, by time worked and in equal parts,
  // adding up to 100, what of an associate's part buys shares, and the
  // highest interest on capital. Drafting them again replaces the draft
  // until they are adopted.
  let {}: { rows: Terms[]; about: unknown } = $props()
</script>

<Form action="draft" submit="Draft terms">
  <Field label="From" name="from" placeholder="2027" required />
  <Field label="By pay %" name="salary" />
  <Field label="By time worked %" name="hours" />
  <Field label="In equal parts %" name="equal" />
  <Field label="Employed in shares %" name="capital" />
  <Field label="Interest on capital at most %" name="interest" />
</Form>
