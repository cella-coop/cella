<script lang="ts">
  import { Field, Form, Section } from '@cella/org-ui'
  import type { Membership } from '../../models/member.ts'

  // A member's own withdrawal, by their right: offered on their own page
  // alone, while they are active or suspended, and asked once more before
  // it is signed. The freeze and the withdrawal of their capital follow it.
  let { data }: { data: Membership; id: string } = $props()

  const offered = $derived(data.own && (data.member?.status === 'active' || data.member?.status === 'suspended'))
</script>

{#if offered}
  <Section title="Withdraw">
    <Form action="withdraw" submit="Withdraw from the coop" tone="danger">
      <Field
        label="Leaving ends your membership today; your capital is frozen and repaid as the capital's terms say"
        name="sure"
        options={[{ value: 'yes', label: 'I withdraw from the coop' }]}
        placeholder="Choose to confirm"
        required
      />
    </Form>
  </Section>
{/if}
