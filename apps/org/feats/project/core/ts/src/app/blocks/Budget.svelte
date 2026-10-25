<script lang="ts">
  import { Field, Form, Note, Section, Stats } from '@cella/org-ui'
  import type { Detail } from '../../models/project.ts'

  // The pot shares and time are spent against, as a figure. Setting it is
  // ordered, and refused below what was already shared from it.
  let { data }: { data: Detail; id: string } = $props()
</script>

{#if !data.archived}
  <Section title="Budget">
    {#if data.budget === null}
      <Note text="No budget set." />
    {:else}
      <Stats items={[{ label: 'Budget', value: data.budget, kind: 'money' }]} />
    {/if}
    <Form action="budget" submit={data.budget === null ? 'Set budget' : 'Change budget'} tone="quiet" inline>
      <Field label="Budget, €" name="amount" placeholder="48000" required />
    </Form>
  </Section>
{/if}
