<script lang="ts">
  import { useSettings } from '../hooks/useSettings.ts'
  import { useWrites } from '../hooks/useWrites.ts'
  import { took } from '../post.ts'
  import Dialog from './Dialog.svelte'
  import Field from './Field.svelte'

  // The motion a setting's change needs, offered as the change commits: a
  // `Dialog` saying plainly that a motion of the deciding circle makes
  // it, the change from the value in force to the one typed, and why, in
  // the guard's own words; and the motions' New form, prefilled, which
  // the reader may change before it posts to the page's `action`, by the
  // page's `send`. Cancel, Escape or a click outside it takes the change
  // back.
  let { action }: { action: string } = $props()

  const state = useSettings()
  const writes = useWrites()

  async function onsubmit(fields: [string, string][]) {
    if (!state.propose()) {
      return
    }
    let proposed = false
    let reason: string | undefined
    try {
      const result = await writes.shown(writes.send(action, fields))
      proposed = took(result)
      reason = !proposed && 'done' in result ? result.done?.reason : undefined
    } finally {
      state.answered(proposed, reason)
    }
  }
</script>

<Dialog
  bind:dialog={state.dialog}
  title={state.offered ? `${state.offered.name} changes it by motion` : ''}
  submit={state.offered ? `Propose to ${state.offered.name}` : 'Propose'}
  busy={state.proposing}
  problem={state.problem}
  {onsubmit}
  oncancel={() => state.close()}
  onclose={() => state.closed()}
>
  {#snippet lead()}
    {#if state.offered}
      {const o = $derived(state.offered)}
      <p class="change">
        <span class="label">{o.change.label}</span>
        <s class="was">{o.change.was || 'Empty'}</s>
        <span aria-hidden="true">→</span><span class="visually-hidden">to</span>
        <span class="value">{o.change.value || 'Empty'}</span>
      </p>
      <p class="why">{o.reason}</p>
      <p class="lead">Propose it as written here, or change it first.</p>
    {/if}
  {/snippet}
  {#if state.offered}
    {const o = $derived(state.offered)}
    <Field label="Title" name="title" value={o.title} required wide />
    <Field label="Circle" name="circle" options={[{ value: o.circle, label: o.name }]} value={o.circle} required />
    <Field label="Deadline" name="deadline" type="date" value={o.deadline} required />
    <input type="hidden" name="kind" value={o.kind} />
    {#each o.args as a (a.name)}
      {#if a.label}
        <Field label={a.label} name="arg.{a.name}" value={a.value} wide />
      {:else}
        <input type="hidden" name="arg.{a.name}" value={a.value} />
      {/if}
    {/each}
    <Field label="Proposal" name="body" rows={3} wide />
  {/if}
</Dialog>

<style>
  .change {
    margin: 0;
    display: flex;
    flex-wrap: wrap;
    align-items: baseline;
    gap: var(--space-2);
    font-size: var(--text-sm);
  }
  .change .label {
    color: var(--text-muted);
  }
  .was {
    color: var(--text-subtle);
  }
  .value {
    font-weight: 500;
  }
  .why {
    margin: 0;
    padding: var(--space-2) var(--space-3);
    border-radius: var(--radius-control);
    background: var(--sunk);
    font-size: var(--text-sm);
  }
  .lead {
    margin: 0;
    color: var(--text-muted);
    font-size: var(--text-sm);
  }
</style>
