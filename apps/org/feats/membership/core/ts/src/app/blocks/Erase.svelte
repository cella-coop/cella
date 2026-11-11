<script lang="ts">
  import { Field, Form, Section } from '@cella/org-ui'
  import type { Membership } from '../../models/member.ts'

  // Erasing one's own personal data, by one's right: offered on one's own
  // page alone, once one has left, and asked once more before it is
  // signed. What the law keeps is restricted, not erased, until its clock
  // runs out.
  let { data }: { data: Membership; id: string } = $props()

  const offered = $derived(data.own && data.member?.status === 'exited')
</script>

{#if offered}
  <Section title="Erase my data">
    <Form action="erase" submit="Erase my personal data" tone="danger">
      <Field
        label="Your name and contact details are erased at once; your payslips, receipts and books are kept, unread, as long as the law requires, then erased"
        name="sure"
        options={[{ value: 'yes', label: 'I erase my personal data' }]}
        placeholder="Choose to confirm"
        required
      />
    </Form>
  </Section>
{/if}
