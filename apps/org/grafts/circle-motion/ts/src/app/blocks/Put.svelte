<script lang="ts">
  import { Field, Form, Note, Popover } from '@cella/org-ui'
  import { kinds, type Proposing } from '../../models/index.ts'
  import { usePut } from '../../hooks/usePut.ts'

  // Proposing a change to the circle's place or powers: a motion put to
  // the circle that decides it, its parent, by the procedure its
  // requirements fix, pre-filled with what it decides. Carried out when it passes.
  let { data }: { data: Proposing | null; id: string } = $props()

  const state = usePut()
  const options = <T extends { id: string }>(rows: T[], label: (r: T) => string) => rows.map((r) => ({ value: r.id, label: label(r) }))
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
      {#if state.kind === 'nest'}
        <Field label="Under" name="arg.parent" options={options(data.under, (c) => c.name)} placeholder="Choose…" required />
      {:else if state.kind === 'grant'}
        <Field label="Role" name="arg.role" options={options(data.roles, (r) => r.name)} placeholder="Choose…" required />
        <Field label="Power" name="arg.power" placeholder="approve-time" required />
        <Field label="Grants" name="arg.text" placeholder="approve timesheets" wide />
        <Field label="Limit per write, €" name="arg.limit" type="number" />
        <Field label="Budget, €" name="arg.budget" type="number" />
        <Field label="Budget per" name="arg.per" options={pers} placeholder="—" />
      {:else}
        <Field label="Mandate" name="arg.policy" options={data.mandates.map((m) => ({ value: m.policy, label: m.label }))} placeholder="Choose…" required wide />
      {/if}
      <Field label="Deadline" name="deadline" type="date" required />
      <Field label="Why" name="body" rows={3} wide />
    </Form>
  </Popover>
{/if}
