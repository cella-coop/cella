<script lang="ts">
  import { Field, Form } from '@cella/org-ui'

  // Someone invited to join, with their first device: the key their
  // device made, which their admission enrols, so they sign from the day
  // they are a member. Invited, they hold nothing; a decision admits them.
  let {}: { rows: unknown[]; about: unknown } = $props()
</script>

<Form action="invite" submit="Invite">
  <Field label="Name" name="name" required />
  <Field label="Address" name="address" type="email" placeholder="name@lanterne.example" required />
  <Field label="Device" name="label" placeholder="laptop" required />
  <Field label="Device key" name="key" placeholder="the 64 hex digits their device shows" required wide />
</Form>
