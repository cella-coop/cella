<script lang="ts">
  import { Field, Form, Note } from '@cella/org-ui'
  import { useLink } from '../../hooks/useLink.ts'

  // Someone invited to join, and the link they take it up by: drawn in
  // this browser, its digest in the write, the link itself shown once the
  // invitation settles, to pass on. Opening it, their browser makes their
  // first device. Invited, they hold nothing; a motion admits them.
  let {}: { rows: unknown[]; about: unknown } = $props()

  const link = useLink('membership:member:invite')
</script>

<Form action="invite" submit="Invite" ready={link.digest !== ''}>
  <Field label="Name" name="name" required />
  <Field label="Address" name="address" type="email" placeholder="name@lanterne.example" required />
  <input type="hidden" name="link" value={link.digest} />
</Form>
{#if link.made}
  <Note text="Their link, to pass on; it is shown once, and taken up once: {link.made}" />
{/if}
