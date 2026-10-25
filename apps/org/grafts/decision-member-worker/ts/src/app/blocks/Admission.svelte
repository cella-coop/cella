<script lang="ts">
  import { date, Field, Form, Note, Section } from '@cella/org-ui'
  import type { Admission } from '../../models/admission.ts'

  // A candidate's admission: once their probation is over and they are
  // invited, the proposal to admit them, filled in from their candidacy,
  // the shares they pledge and the reason, for the assembly to decide;
  // while one is open, where it stands; before, what comes first.
  let { data }: { data: Admission | null; id: string } = $props()

  const first = $derived(data?.name.split(' ')[0] ?? '')
  const note = $derived(
    !data
      ? ''
      : data.decision && !data.closed
        ? `${data.decision}, “${data.title}”, moves to admit ${first}; it is open until ${date(data.deadline)}.`
        : !data.ended
          ? `${first}'s probation runs to ${date(data.probationEnd)}; the proposal to admit them is filled in once it ends.`
          : data.stage === 'candidate'
            ? `${first}'s probation ended on ${date(data.probationEnd)}: invite them, and the proposal to admit them is filled in on their member's page.`
            : '',
  )
</script>

{#if data}
  <Section title="Admission">
    {#if note}
      <Note text={note} />
    {:else if data.due}
      <Form action="propose" submit="Propose the admission">
        <Field label="Proposes to" name="kind" options={[{ value: 'admit', label: 'Admit as a member' }]} value="admit" required />
        <Field label="Shares" name="shares" type="number" value={data.pledged} required />
        <Field label="Deadline" name="deadline" type="date" value={data.until} required />
        <Field label="Why" name="body" rows={3} value={data.why} wide />
      </Form>
    {/if}
  </Section>
{/if}
