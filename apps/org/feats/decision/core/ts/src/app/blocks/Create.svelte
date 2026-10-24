<script lang="ts">
  import { Field, Form } from '@cella/org-ui'
  import type { Decision, Offered } from '../../models/decision.ts'
  import { useProposal } from '../../hooks/useProposal.ts'

  // A new decision: the circle it is put in, by its rule, open until its
  // deadline, and what it decides beyond its text, a motion of a kind a
  // graft registers, with the arguments that kind takes. Its number and
  // the day it is proposed are the server's.
  let { about }: { rows: Decision[]; about: Offered } = $props()

  const state = useProposal(() => about)
  const circles = $derived((about.circles ?? []).map((c) => ({ value: c.id, label: c.name })))
  const rules = [
    { value: 'consent', label: 'consent' },
    { value: 'majority', label: 'majority' },
  ]
  const kinds = $derived([{ value: '', label: 'Nothing beyond its text' }, ...about.kinds.map((k) => ({ value: k.kind, label: k.label }))])
</script>

<Form action="propose" submit="Propose">
  <Field label="Title" name="title" required wide />
  <Field label="Circle" name="circle" options={circles} placeholder="Choose…" bind:value={state.circle} required />
  <Field label="Rule" name="rule" options={rules} placeholder="Choose…" bind:value={state.rule} required />
  <Field label="Deadline" name="deadline" type="date" required />
  <Field label="Decides" name="kind" options={kinds} bind:value={state.kind} />
  {#each state.fields as f (f.name)}
    <Field label={f.label} name="arg.{f.name}" type={f.type} options={state.choices(f)} placeholder={state.choices(f) ? 'Choose…' : undefined} required={!f.optional} />
  {/each}
  <Field label="Proposal" name="body" rows={4} wide />
</Form>
