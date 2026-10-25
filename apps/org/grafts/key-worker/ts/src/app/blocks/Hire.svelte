<script lang="ts">
  import { Field, Form } from '@cella/org-ui'

  // A hire with the worker's first device: who, the job, the contract and
  // the time it asks a week, and the key their device made, which the
  // hire enrols, so they sign their own time from their first day. A
  // fixed-term contract or an apprenticeship names its last day.
  let { about }: { rows: unknown[]; about: { today: string } } = $props()
</script>

<Form action="hire" submit="Hire">
  <Field label="Name" name="name" required />
  <Field label="Address" name="address" type="email" placeholder="name@lanterne.example" required />
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
  <Field label="Device" name="label" placeholder="laptop" required />
  <Field label="Device key" name="key" placeholder="the 64 hex digits their device shows" required wide />
</Form>
