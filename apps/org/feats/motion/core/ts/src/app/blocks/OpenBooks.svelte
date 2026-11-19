<script lang="ts">
  import { Explained, Field, Form, Hidden, Note, Section } from '@cella/org-ui'
  import type { Proposing } from '../../models/circles.ts'
  import { useDisclosure } from '../../hooks/useDisclosure.ts'

  // On the assembly's page, what the coop shares with every member of
  // the totals of members' own figures: open books' disclosure rule in
  // force, each setting said in full with whether the value proposed
  // exposes personal data and why, as it is typed; proposing new values
  // as a motion of the assembly, and, where a rule stands, its end.
  let { data }: { data: Proposing | null; id: string } = $props()

  const state = useDisclosure(() => data?.disclosure ?? { policy: null, motion: null, from: null, values: null })
  const disclosure = $derived(data?.disclosure ?? null)
  const figures = "members' own figures, their pay, time, capital, work share and expenses"
</script>

{#if disclosure}
  <Section title="Open books">
    <Note
      text={disclosure.values
        ? `Totals of ${figures} are shared with every member as below, since ${disclosure.from}, by motion ${disclosure.motion}.`
        : `Totals of ${figures} are shared with no member beyond what their own rights open.`}
    />
    <Explained items={state.items} />
    <Form action="put" submit="Propose these values" reset={false}>
      <Hidden name="kind" value="disclose" />
      <Field label="Fewest people in a total" name="arg.contributors" type="number" step="1" bind:value={state.contributors} required />
      <Field label="Most one person may put in, %" name="arg.largest" type="number" step="any" bind:value={state.largest} required />
      <Field label="Most two people may put in, %" name="arg.two" type="number" step="any" bind:value={state.two} required />
      <Field label="Deadline" name="deadline" type="date" required />
      <Field label="Why" name="body" rows={3} wide />
    </Form>
    {#if disclosure.policy}
      <Note text="Or propose sharing none: every member then reads only the totals their own rights open." />
      <Form action="put" submit="Propose sharing none" tone="quiet">
        <Hidden name="kind" value="withhold" />
        <Hidden name="arg.policy" value={disclosure.policy} />
        <Field label="Deadline" name="deadline" type="date" required />
      </Form>
    {/if}
  </Section>
{/if}
