<script lang="ts">
  import { Field, Form } from '@cella/org-ui'
  import type { Entry } from '../../models/timesheet.ts'

  // Time the acting member worked: always their own, never into a month
  // already approved.
  let { about }: { rows: Entry[]; about: { today: string } } = $props()

  const kinds = [
    { value: 'billable', label: 'billable' },
    { value: 'internal', label: 'internal' },
  ]
</script>

<Form action="log" submit="Log time">
  <Field label="Day" name="day" type="date" value={about.today} required />
  <Field label="Hours" name="hours" placeholder="7" required />
  <Field label="Kind" name="billable" options={kinds} value="billable" />
  <Field label="Note" name="note" wide />
</Form>
