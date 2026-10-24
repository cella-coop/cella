<script lang="ts">
  import { Field, Form } from '@cella/org-ui'
  import type { Meeting, Offered } from '../../models/meeting.ts'

  // A new meeting of a circle, at a day and time, in a place, online or
  // both. Its agenda is drawn up on its page.
  let { about }: { rows: Meeting[]; about: Offered } = $props()
</script>

<Form action="schedule" submit="Schedule meeting">
  <Field label="Title" name="title" required wide />
  <Field label="Circle" name="circle" list={about.circles} required />
  <Field label="Day" name="day" type="date" required />
  <Field label="Time" name="time" type="time" value="10:00" required />
  <Field label="Place" name="place" />
  <Field label="Link" name="link" type="url" placeholder="https://" />
</Form>
