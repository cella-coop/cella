<script lang="ts">
  import { Field, Form, Note, Popover } from '@cella/org-ui'
  import { kinds, type Proposing } from '../../models/circles.ts'
  import { usePut } from '../../hooks/usePut.ts'

  // Proposing a change to the circle's powers: a motion put to the
  // circle that decides it, by the procedure its
  // requirements fix, pre-filled with what it decides. Carried out when it passes.
  let { data }: { data: Proposing | null; id: string } = $props()

  const state = usePut()
  const options = <T extends { id: string }>(rows: T[], label: (r: T) => string) => rows.map((r) => ({ value: r.id, label: label(r) }))
  const scopes = (circles: { id: string; name: string }[]) => [{ value: 'own', label: 'its own circle' }, ...options(circles, (c) => c.name)]
  const pers = [
    { value: 'month', label: 'a month' },
    { value: 'year', label: 'a year' },
  ]
</script>

{#if data}
  <Popover label="Propose a motion about this circle" menu={false} wide button>
    {#snippet trigger()}Propose…{/snippet}
    <Form action="put" submit="Propose">
      <Note text="Put to {data.decider.name}, by the procedure what it decides asks, or else by {data.decider.procedure}." />
      <Field label="Proposes to" name="kind" options={kinds} bind:value={state.kind} required wide />
      {#if state.kind === 'grant'}
        <Field label="Role" name="arg.role" options={options(data.roles, (r) => r.name)} placeholder="Choose…" required />
        <Field label="Power" name="arg.power" placeholder="approve-time" required />
        <Field label="Grants" name="arg.text" placeholder="approve timesheets" wide />
        <Field label="Limit per write, €" name="arg.limit" type="number" />
        <Field label="Budget, €" name="arg.budget" type="number" />
        <Field label="Budget per" name="arg.per" options={pers} placeholder="—" />
        <Field label="Covers" name="arg.scope" options={scopes(data.circles)} placeholder="the whole co-op" />
      {:else}
        <Field label="Mandate" name="arg.policy" options={data.mandates.map((m) => ({ value: m.policy, label: m.label }))} placeholder="Choose…" required wide />
      {/if}
      <Field label="Deadline" name="deadline" type="date" required />
      <Field label="Why" name="body" rows={3} wide />
    </Form>
  </Popover>
{/if}
