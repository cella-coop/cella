<script lang="ts">
  import { Field, Form, Note, Popover } from '@cella/org-ui'
  import type { Appointing } from '../../models/asking.ts'
  import { useAsking } from '../../hooks/useAsking.ts'

  // Proposing who sits in the circle: a member seated, in one of its roles
  // or as a plain member, or a seat held there ended. The circle above
  // decides, by its procedure; the close carries it out.
  let { data }: { data: Appointing | null; id: string } = $props()

  const kinds = [
    { value: 'seat', label: 'Seat a member' },
    { value: 'unseat', label: 'End a seat' },
  ]
  const state = useAsking(() => 'seat')
  const members = $derived((data?.members ?? []).map((m) => ({ value: m.id, label: m.name })))
  const roles = $derived([{ value: '', label: 'No role: a plain seat' }, ...(data?.roles ?? []).map((r) => ({ value: r.id, label: r.name }))])
  const seats = $derived((data?.seats ?? []).map((s) => ({ value: s.id, label: s.label })))
</script>

{#if data}
  <Popover label="Propose a seat in this circle" menu={false} wide>
    {#snippet trigger()}Appoint…{/snippet}
    <Form action="appoint" submit="Propose">
      <Note text="Put to {data.decider.name}, by {data.decider.procedure}." />
      <Field label="Proposes to" name="kind" options={kinds} bind:value={state.kind} required wide />
      {#if state.kind === 'seat'}
        <Field label="Member" name="member" options={members} placeholder="Choose…" required />
        <Field label="Role" name="role" options={roles} />
      {:else}
        <Field label="Seat" name="seat" options={seats} placeholder="Choose…" required wide />
      {/if}
      <Field label="Deadline" name="deadline" type="date" required />
      <Field label="Why" name="body" rows={3} wide />
    </Form>
  </Popover>
{/if}
