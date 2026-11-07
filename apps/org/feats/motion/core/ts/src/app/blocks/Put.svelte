<script lang="ts">
  import { Field, Form, Note, Popover } from '@cella/org-ui'
  import { kinds, type Proposing } from '../../models/circles.ts'
  import { usePut } from '../../hooks/usePut.ts'

  // Proposing a change to the circle's powers: granting a mandate to one
  // of its roles or to the circle, by motion of the circle chosen to issue
  // it or else the first that may; changing one of its mandates, by
  // motion of the circle that issued it, the form filled with its values;
  // or revoking one. The form shows the sentence the policy will read; the
  // SQL judges it before anything is proposed, and the refusal names the
  // field. Put by the procedure its requirements fix, and carried out
  // when it passes.
  let { data }: { data: Proposing | null; id: string } = $props()

  const state = usePut()
  const options = <T extends { id: string }>(rows: T[], label: (r: T) => string) => rows.map((r) => ({ value: r.id, label: label(r) }))
  const scopes = (circles: { id: string; name: string }[]) => [{ value: 'own', label: 'its own circle' }, ...options(circles, (c) => c.name)]
  const grantees = (p: Proposing) => [
    ...p.roles.map((r) => ({ value: `role:${r.id}`, label: r.name })),
    { value: `circle:${p.circle}`, label: `${p.name} itself, by motion` },
  ]
  const issuers = (p: Proposing) => [{ value: '', label: 'the first that holds a mandate to issue it under' }, ...options(p.issuers, (c) => c.name)]
  const pers = [
    { value: 'month', label: 'a month' },
    { value: 'year', label: 'a year' },
  ]
  const held = (p: Proposing) => p.mandates.map((m) => ({ value: m.policy, label: m.label }))
  const chosen = $derived(data?.mandates.find((m) => m.policy === state.policy) ?? null)
</script>

{#if data}
  <Popover label="Propose a motion about this circle" menu={false} wide button>
    {#snippet trigger()}Propose…{/snippet}
    <Form action="put" submit="Propose">
      <Field label="Proposes to" name="kind" options={kinds} bind:value={state.kind} required wide />
      {#if state.kind === 'revoke' || state.kind === 'change'}
        <Field
          label="Mandate"
          name="arg.policy"
          options={held(data)}
          placeholder="Choose…"
          required
          wide
          bind:value={() => state.policy, (v) => state.choose(String(v), data.mandates)}
        />
      {/if}
      {#if state.kind === 'grant' || state.kind === 'change'}
        {#if state.kind === 'grant'}
          <Field label="Grantee" name="arg.grantee" options={grantees(data)} placeholder="Choose…" required bind:value={state.grantee} />
        {:else}
          <input type="hidden" name="arg.grantee" value={state.grantee} />
        {/if}
        <Field label="Power" name="arg.power" placeholder="approve-time" required bind:value={state.power} />
        <Field label="Grants" name="arg.text" placeholder="approve timesheets" wide bind:value={state.text} />
        <Field label="Limit per write, €" name="arg.limit" type="number" bind:value={state.limit} />
        <Field label="Budget, €" name="arg.budget" type="number" bind:value={state.budget} />
        <Field label="Budget per" name="arg.per" options={pers} placeholder="—" bind:value={state.per} />
        <Field label="Covers" name="arg.scope" options={scopes(data.circles)} placeholder="the whole co-op" bind:value={state.scope} />
        <Field label="From" name="arg.from" type="date" bind:value={state.from} />
        <Field label="Until" name="arg.until" type="date" bind:value={state.until} />
        {#if state.kind === 'grant'}
          <Field label="Issued by" name="arg.issuer" options={issuers(data)} wide />
        {/if}
        {#if state.sentence}<Note text="It will read: {state.sentence}." />{/if}
      {/if}
      {#if state.kind === 'change' && chosen}
        <Note text="Put to {chosen.issuer}, which issued it; replacing it revokes every mandate issued under it the same day." />
      {:else if state.kind === 'revoke' && chosen}
        <Note text="Put to {chosen.issuer}, which issued it; ending it revokes every mandate issued under it the same day." />
      {:else if state.kind === 'grant'}
        <Note text="Put to the circle that issues it, by the procedure what it decides asks." />
      {/if}
      <Field label="Deadline" name="deadline" type="date" required />
      <Field label="Why" name="body" rows={3} wide />
    </Form>
  </Popover>
{/if}
