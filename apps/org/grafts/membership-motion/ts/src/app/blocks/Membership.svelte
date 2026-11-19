<script lang="ts">
  import { Field, Form, Note, Popover } from '@cella/org-ui'
  import type { Standing } from '../../models/asking.ts'
  import { useAsking } from '../../hooks/useAsking.ts'

  // Proposing what becomes of a membership, as it stands: admitting
  // someone invited, with the shares they subscribe; suspending an active
  // member; excluding a member. The assembly decides, by its procedure;
  // the close carries it out. A member's withdrawal, and the erasure of
  // their data once they have left, are their own, on their page, no
  // motion's. On an employee's own page, with no membership or only
  // invited, and no motion open to admit them, applying to join by their
  // right, which puts their admission to the assembly; a year's
  // employment is the guards' to check.
  let { data }: { data: Standing | null; id: string } = $props()

  const offered = $derived(
    !data ? []
    : data.status === 'invited' ? [{ value: 'admit', label: 'Admit as a member' }]
    : data.status === 'active' ? [{ value: 'suspend', label: 'Suspend' }, { value: 'exclude', label: 'Exclude' }]
    : data.status === 'suspended' ? [{ value: 'exclude', label: 'Exclude' }]
    : [],
  )
  const applies = $derived(
    !!data && data.own && data.employee && (data.status === null || (data.status === 'invited' && !data.applied)) && !data.open.length,
  )
  const state = useAsking(() => offered[0]?.value ?? '')
</script>

{#if data && offered.length}
  <Popover label="Propose a motion about this membership" menu={false} wide button>
    {#snippet trigger()}Propose…{/snippet}
    <Form action="propose" submit="Propose">
      <Note text="Put to {data.decider.name}, by {data.decider.procedure}." />
      <Field label="Proposes to" name="kind" options={offered} bind:value={state.kind} required wide />
      {#if state.kind === 'admit'}
        <Field label="Shares" name="shares" type="number" placeholder="20" required />
      {/if}
      <Field label="Deadline" name="deadline" type="date" required />
      <Field label="Why" name="body" rows={3} wide />
    </Form>
  </Popover>
{/if}

{#if data && applies}
  <Popover label="Apply to join the coop" menu={false} wide button>
    {#snippet trigger()}Apply to join…{/snippet}
    <Form action="apply" submit="Apply">
      <Note text="Once employed a year, you may apply by right. Your admission is put to {data.decider.name}, by {data.decider.procedure}, which must rule on it." />
      <Field label="Shares pledged" name="shares" type="number" placeholder="20" required />
      <Field label="Deadline" name="deadline" type="date" value={data.until} required />
      <Field label="Why" name="body" rows={3} wide />
    </Form>
  </Popover>
{/if}
