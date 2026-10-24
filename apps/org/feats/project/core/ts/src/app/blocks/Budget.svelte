<script lang="ts">
  import { Field, Form, Section, money } from '@cella/org-ui'
  import type { Detail } from '../../models/project.ts'

  // The pot shares and time are spent against. Setting it is ordered, and
  // refused below what was already shared from it.
  let { data }: { data: Detail; id: string } = $props()
</script>

{#if !data.archived}
  <Section title={data.budget === null ? 'Budget: none set' : `Budget: ${money(data.budget)}`}>
    <Form action="budget" submit={data.budget === null ? 'Set budget' : 'Change budget'} tone="quiet" inline>
      <Field label="Budget, €" name="amount" placeholder="48000" required />
    </Form>
  </Section>
{/if}
