<script lang="ts">
  import { Field, Form } from '@cella/org-ui'
  import type { Worker } from '../../models/worker.ts'

  // A hire: who, the job, the contract and the time it asks a week. A
  // fixed-term contract or an apprenticeship names its last day.
  let { about }: { rows: Worker[]; about: { today: string } } = $props()
</script>

<Form action="hire" submit="Hire">
  <Field label="Name" name="name" required />
  <Field label="Address" name="address" placeholder="name@lanterne.example" required />
  <Field label="Job" name="job" placeholder="junior developer" required />
  <Field
    label="Contract"
    name="contract"
    options={[
      { value: 'permanent', label: 'Permanent' },
      { value: 'fixed-term', label: 'Fixed-term' },
      { value: 'apprenticeship', label: 'Apprenticeship' },
    ]}
    value="permanent"
    required
  />
  <Field label="Starts" name="start" type="date" value={about.today} required />
  <Field label="Ends" name="until" type="date" />
  <Field label="Hours a week" name="hours" value="35" required />
</Form>
