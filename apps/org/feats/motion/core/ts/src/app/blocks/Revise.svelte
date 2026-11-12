<script lang="ts">
  import { Form, Hidden, Field, Note, Popover } from '@cella/org-ui'
  import type { Revising } from '../../models/circles.ts'
  import { usePut } from '../../hooks/usePut.ts'
  import Granted from './Granted.svelte'

  // Proposing what becomes of a mandate that stands, from its page, as
  // its circle's Propose… does: Change… fills the form with its values
  // and proposes a policy replacing its own; Revoke… proposes ending its
  // policy. Each is a motion of the circle that issued it, and either
  // revokes every mandate issued under it the same day. The SQL judges a
  // change before anything is proposed, and the refusal names the field.
  let { data }: { data: Revising | null; id: string } = $props()

  const state = usePut(() => data?.held)
</script>

{#if data}
  <Popover label="Propose a motion changing this mandate" menu={false} wide button>
    {#snippet trigger()}Change…{/snippet}
    <Form action="put" submit="Propose">
      <Hidden name="kind" value="change" />
      <Hidden name="arg.policy" value={data.held.policy} />
      <Hidden name="arg.grantee" value={state.grantee} />
      <Granted circles={data.circles} />
      <Note text="Put to {data.held.issuer}, which issued it; replacing it revokes every mandate issued under it the same day." />
      <Field label="Deadline" name="deadline" type="date" required />
      <Field label="Why" name="body" rows={3} wide />
    </Form>
  </Popover>
  <Popover label="Propose a motion revoking this mandate" menu={false} wide button>
    {#snippet trigger()}Revoke…{/snippet}
    <Form action="put" submit="Propose">
      <Hidden name="kind" value="revoke" />
      <Hidden name="arg.policy" value={data.held.policy} />
      <Note text="Put to {data.held.issuer}, which issued it; ending it revokes every mandate issued under it the same day." />
      <Field label="Deadline" name="deadline" type="date" required />
      <Field label="Why" name="body" rows={3} wide />
    </Form>
  </Popover>
{/if}
